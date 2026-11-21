import { useEffect, useMemo, useState } from 'react';
import type {
  CountryConfiguration,
  CountrySummary,
  FilingStatusTaxConfig,
  MinimumTaxConfig,
  RuleVersionView,
  StateProvinceView,
  TaxBracketRow,
  TaxRebateAllowance,
  TaxRulePayload,
} from '@hrm/shared-types';
import {
  calculateCumulativeFixedAmounts,
  validateTaxBrackets,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Copy,
  ExternalLink,
  Layers,
  Loader2,
  Lock,
  Plus,
  Receipt,
  Save,
  ShieldAlert,
  Sparkles,
  Split,
  Trash2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  createRuleVersion,
  listRuleVersions,
  publishRuleVersion,
  updateRuleVersion,
} from '@/lib/platform-countries-api';
import { RuleVersionDiffModal } from '../rules/RuleVersionDiffModal';
import { RuleVersionSelector } from '../rules/RuleVersionSelector';
import { MinimumTaxSection } from './MinimumTaxSection';
import { TaxBracketTable } from './TaxBracketTable';
import { TaxRebatesSection } from './TaxRebatesSection';

interface TaxRulesEditorProps {
  country: CountrySummary;
  states?: StateProvinceView[];
  configuration: CountryConfiguration | null;
  completeness: { isComplete: boolean; label: string; tone: 'green' | 'amber' | 'slate' };
  onRefresh: () => Promise<void>;
}

const DEFAULT_FILING_STATUSES: { key: string; label: string }[] = [
  { key: 'single', label: 'Single / Individual' },
  { key: 'married_joint', label: 'Married Filing Jointly' },
  { key: 'married_separate', label: 'Married Filing Separately' },
  { key: 'head_of_household', label: 'Head of Household' },
  { key: 'non_resident', label: 'Foreign / Non-Resident' },
];

export function TaxRulesEditor({
  country,
  states = [],
  configuration,
  completeness,
  onRefresh,
}: TaxRulesEditorProps) {
  // Scope: null = Federal/National; string = stateProvinceId
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);

  // Versions state
  const [versions, setVersions] = useState<RuleVersionView[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active Version Tax Payload State
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());
  const [hasFilingStatuses, setHasFilingStatuses] = useState(false);
  const [activeFilingStatusKey, setActiveFilingStatusKey] = useState('single');

  // Unified brackets, rebates, minimum tax
  const [brackets, setBrackets] = useState<TaxBracketRow[]>([
    { from: 0, to: 18200, rate: 0, fixedAmount: 0 },
    { from: 18200, to: 45000, rate: 16, fixedAmount: 0 },
    { from: 45000, to: 135000, rate: 30, fixedAmount: 4288 },
    { from: 135000, to: 190000, rate: 37, fixedAmount: 31288 },
    { from: 190000, to: null, rate: 45, fixedAmount: 51638 },
  ]);
  const [rebates, setRebates] = useState<TaxRebateAllowance[]>([
    {
      id: 'rebate-lito',
      name: 'Low Income Tax Offset',
      code: 'LITO',
      type: 'tapered',
      amount: 700,
      threshold: 37500,
      phaseOutRate: 0.015,
      description: 'Statutory offset phased out at 1.5 cents per dollar above $37,500',
    },
  ]);
  const [minimumTax, setMinimumTax] = useState<MinimumTaxConfig>({
    enabled: false,
    amount: 0,
    description: '',
  });

  // Multiple Filing Statuses collection
  const [filingStatuses, setFilingStatuses] = useState<FilingStatusTaxConfig[]>([
    {
      statusKey: 'single',
      label: 'Single / Individual',
      brackets: [
        { from: 0, to: 18200, rate: 0, fixedAmount: 0 },
        { from: 18200, to: 45000, rate: 16, fixedAmount: 0 },
        { from: 45000, to: 135000, rate: 30, fixedAmount: 4288 },
        { from: 135000, to: 190000, rate: 37, fixedAmount: 31288 },
        { from: 190000, to: null, rate: 45, fixedAmount: 51638 },
      ],
      rebates: [],
      minimumTax: { enabled: false, amount: 0 },
    },
  ]);

  // Version Metadata Form
  const [effectiveFrom, setEffectiveFrom] = useState(
    `${new Date().getFullYear()}-07-01`,
  );
  const [effectiveTo, setEffectiveTo] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [changeNote, setChangeNote] = useState('');

  // Modals state
  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
  const [newVersionEffectiveFrom, setNewVersionEffectiveFrom] = useState(
    `${new Date().getFullYear()}-07-01`,
  );
  const [newVersionEffectiveTo, setNewVersionEffectiveTo] = useState('');
  const [newVersionSourceReference, setNewVersionSourceReference] = useState('');
  const [newVersionChangeNote, setNewVersionChangeNote] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);

  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [isAddStatusModalOpen, setIsAddStatusModalOpen] = useState(false);
  const [customStatusKey, setCustomStatusKey] = useState('');
  const [customStatusLabel, setCustomStatusLabel] = useState('');

  // Load versions
  const loadVersions = async (selectId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const list = await listRuleVersions(country.id, {
        ruleType: 'tax',
        stateProvinceId: selectedStateId || undefined,
      });
      setVersions(list);

      const targetId = selectId || selectedVersionId;
      const preferred =
        (targetId ? list.find((v) => v.id === targetId) : null) ||
        list.find((v) => v.status === 'draft') ||
        list.find((v) => v.status === 'published') ||
        list[0] ||
        null;

      if (preferred) {
        setSelectedVersionId(preferred.id);
        populateFromVersion(preferred);
      } else {
        setSelectedVersionId(null);
        // Default sample data for country
        resetToDefaultCountryTaxSchedule();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load tax rule versions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVersions();
  }, [country.id, selectedStateId]);

  const resetToDefaultCountryTaxSchedule = () => {
    setTaxYear(new Date().getFullYear());
    setHasFilingStatuses(false);
    setEffectiveFrom(`${new Date().getFullYear()}-07-01`);
    setEffectiveTo('');
    setSourceReference(`Statutory Tax Act (${country.name})`);
    setChangeNote('Initial progressive tax rate schedule');
    setBrackets([
      { from: 0, to: 18200, rate: 0, fixedAmount: 0 },
      { from: 18200, to: 45000, rate: 16, fixedAmount: 0 },
      { from: 45000, to: 135000, rate: 30, fixedAmount: 4288 },
      { from: 135000, to: 190000, rate: 37, fixedAmount: 31288 },
      { from: 190000, to: null, rate: 45, fixedAmount: 51638 },
    ]);
    setRebates([]);
    setMinimumTax({ enabled: false, amount: 0 });
  };

  const populateFromVersion = (v: RuleVersionView) => {
    setEffectiveFrom(v.effectiveFrom);
    setEffectiveTo(v.effectiveTo || '');
    setSourceReference(v.sourceReference);
    setChangeNote(v.changeNote);

    const payload = (v.payload as unknown as TaxRulePayload) || {};
    if (typeof payload.taxYear === 'number') {
      setTaxYear(payload.taxYear);
    }
    setHasFilingStatuses(Boolean(payload.hasFilingStatuses));

    if (Array.isArray(payload.brackets) && payload.brackets.length > 0) {
      setBrackets(payload.brackets);
    }
    if (Array.isArray(payload.rebates)) {
      setRebates(payload.rebates);
    }
    if (payload.minimumTax) {
      setMinimumTax(payload.minimumTax);
    }
    if (Array.isArray(payload.filingStatuses) && payload.filingStatuses.length > 0) {
      setFilingStatuses(payload.filingStatuses);
      setActiveFilingStatusKey(payload.filingStatuses[0].statusKey);
    }
  };

  const currentVersion = versions.find((v) => v.id === selectedVersionId) || null;
  const isPublished = currentVersion?.status === 'published';

  // Active brackets/rebates/minimum tax depending on filing status toggle
  const activeFilingStatusConfig = useMemo(() => {
    if (!hasFilingStatuses) return null;
    return filingStatuses.find((fs) => fs.statusKey === activeFilingStatusKey) || filingStatuses[0] || null;
  }, [hasFilingStatuses, filingStatuses, activeFilingStatusKey]);

  const activeBrackets = hasFilingStatuses && activeFilingStatusConfig ? activeFilingStatusConfig.brackets : brackets;
  const activeRebates = hasFilingStatuses && activeFilingStatusConfig ? activeFilingStatusConfig.rebates : rebates;
  const activeMinimumTax = hasFilingStatuses && activeFilingStatusConfig ? activeFilingStatusConfig.minimumTax : minimumTax;

  const handleUpdateActiveBrackets = (newBrackets: TaxBracketRow[]) => {
    if (isPublished) return;
    if (hasFilingStatuses && activeFilingStatusConfig) {
      setFilingStatuses(
        filingStatuses.map((fs) =>
          fs.statusKey === activeFilingStatusConfig.statusKey
            ? { ...fs, brackets: newBrackets }
            : fs,
        ),
      );
    } else {
      setBrackets(newBrackets);
    }
  };

  const handleUpdateActiveRebates = (newRebates: TaxRebateAllowance[]) => {
    if (isPublished) return;
    if (hasFilingStatuses && activeFilingStatusConfig) {
      setFilingStatuses(
        filingStatuses.map((fs) =>
          fs.statusKey === activeFilingStatusConfig.statusKey
            ? { ...fs, rebates: newRebates }
            : fs,
        ),
      );
    } else {
      setRebates(newRebates);
    }
  };

  const handleUpdateActiveMinimumTax = (newMinTax: MinimumTaxConfig) => {
    if (isPublished) return;
    if (hasFilingStatuses && activeFilingStatusConfig) {
      setFilingStatuses(
        filingStatuses.map((fs) =>
          fs.statusKey === activeFilingStatusConfig.statusKey
            ? { ...fs, minimumTax: newMinTax }
            : fs,
        ),
      );
    } else {
      setMinimumTax(newMinTax);
    }
  };

  // Compile full JSON payload
  const buildCurrentPayload = (): TaxRulePayload => {
    return {
      taxYear: Number(taxYear) || new Date().getFullYear(),
      currency: country.currency,
      hasFilingStatuses,
      brackets,
      rebates,
      minimumTax,
      ...(hasFilingStatuses ? { filingStatuses } : {}),
      notes: `${country.name} Statutory Progressive Income Tax Rules`,
    };
  };

  // Validation check across all configured schedules
  const allBracketsValid = useMemo(() => {
    if (!hasFilingStatuses) {
      return validateTaxBrackets(brackets).isValid;
    }
    return filingStatuses.every((fs) => validateTaxBrackets(fs.brackets).isValid);
  }, [hasFilingStatuses, brackets, filingStatuses]);

  // Save changes to active draft
  const handleSaveDraft = async () => {
    if (!currentVersion || isPublished) return;
    if (!allBracketsValid) {
      setError('Cannot save draft with non-contiguous or overlapping tax brackets. Resolve inline validation errors first.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const payload = buildCurrentPayload();

      await updateRuleVersion(country.id, currentVersion.id, {
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        sourceReference,
        changeNote,
        payload: payload as unknown as Record<string, unknown>,
      });

      setSuccessMessage('Draft tax rules saved successfully.');
      await loadVersions();
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to save draft tax rules.');
    } finally {
      setSaving(false);
    }
  };

  // Publish active version
  const handlePublish = async (versionId: string) => {
    if (!allBracketsValid) {
      setError('Cannot publish tax rules with non-contiguous or overlapping brackets.');
      return;
    }

    try {
      setPublishing(true);
      setError(null);
      setSuccessMessage(null);

      await publishRuleVersion(country.id, versionId);
      setSuccessMessage('Tax rule version published successfully! Sync updated to PostgreSQL.');
      await loadVersions();
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to publish tax rule version.');
    } finally {
      setPublishing(false);
    }
  };

  // Submit for approval
  const handleSubmitForApproval = async (versionId: string) => {
    try {
      setSaving(true);
      setError(null);
      await updateRuleVersion(country.id, versionId, {
        status: 'pending_approval',
      });
      setSuccessMessage('Tax rule version submitted for compliance review.');
      await loadVersions();
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit for approval.');
    } finally {
      setSaving(false);
    }
  };

  // Create new version from modal
  const handleCreateNewVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingVersion(true);
      setError(null);

      const payloadToClone = currentVersion
        ? currentVersion.payload
        : (buildCurrentPayload() as unknown as Record<string, unknown>);

      const created = await createRuleVersion(country.id, {
        ruleType: 'tax',
        stateProvinceId: selectedStateId || null,
        effectiveFrom: newVersionEffectiveFrom,
        effectiveTo: newVersionEffectiveTo || null,
        sourceReference: newVersionSourceReference.trim(),
        changeNote: newVersionChangeNote.trim(),
        payload: payloadToClone,
        status: 'draft',
      });

      setIsNewVersionModalOpen(false);
      setSelectedVersionId(created.id);
      setSuccessMessage(`Created draft Version ${created.version}! You can now edit tax thresholds.`);
      await loadVersions(created.id);
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to create new rule version.');
    } finally {
      setCreatingVersion(false);
    }
  };

  // Add filing status
  const handleAddFilingStatus = (e: React.FormEvent) => {
    e.preventDefault();
    const key = customStatusKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key || !customStatusLabel.trim()) return;

    if (filingStatuses.some((fs) => fs.statusKey === key)) {
      alert('A filing status with this key already exists.');
      return;
    }

    // Clone current brackets as starting point
    const newStatus: FilingStatusTaxConfig = {
      statusKey: key,
      label: customStatusLabel.trim(),
      brackets: brackets.map((b) => ({ ...b })),
      rebates: [],
      minimumTax: { enabled: false, amount: 0 },
    };

    setFilingStatuses([...filingStatuses, newStatus]);
    setActiveFilingStatusKey(key);
    setIsAddStatusModalOpen(false);
  };

  const selectedState = states.find((s) => s.id === selectedStateId);

  return (
    <div className="space-y-6">
      {/* 1. Stage C.01 Linked Stage Specification Card */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded">
                  Stage C.01
                </span>
                <span className="text-xs font-semibold text-slate-400">•</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Statutory Tax Rules & Progressive Engine
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                Progressive Tax Engine & Statutory Brackets
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Completeness Badge */}
            <div
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
                completeness.tone === 'green'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : completeness.tone === 'amber'
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                  : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
              }`}
            >
              {completeness.tone === 'green' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <span>{completeness.label}</span>
            </div>

            <button
              type="button"
              onClick={() => alert('Viewing statutory payroll calculation engine specification (PAYROLL_LOGIC.md §10).')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition"
            >
              <span>PAYROLL_LOGIC.md §10</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">
          Configure statutory income tax brackets, marginal rate tiers, personal allowances/offsets, and minimum tax rules. Calculations resolve effective versions based on payroll period dates with strict mathematical contiguity.
        </p>

        {/* Rule Resolver Notice */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            Rule Resolver Chain: Global Default → <strong>Country Tax ({country.isoCode})</strong> →{' '}
            {selectedState ? <strong>State Tax ({selectedState.code})</strong> : 'State Tax'} → Company Policy → Employee Profile
          </span>
          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            DATABASE_SCHEMA.md §8 (tax_brackets)
          </span>
        </div>
      </div>

      {/* 2. Scope Selector Bar (Country vs State) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Jurisdiction Tax Scope
            </div>
            <div className="text-[11px] text-slate-500">
              {selectedState
                ? `Regional State/Province tax rules for ${selectedState.name} (${selectedState.code})`
                : `Federal / National tax rules applicable across all of ${country.name}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-500">Scope:</label>
          <select
            value={selectedStateId || ''}
            onChange={(e) => setSelectedStateId(e.target.value ? e.target.value : null)}
            className="h-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">National / Federal (All States)</option>
            {states.map((st) => (
              <option key={st.id} value={st.id}>
                State: {st.name} ({st.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Reusable RuleVersion Selector Toolbar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <RuleVersionSelector
          versions={versions}
          selectedVersionId={selectedVersionId}
          onSelectVersion={(vId) => {
            setSelectedVersionId(vId);
            const found = versions.find((v) => v.id === vId);
            if (found) populateFromVersion(found);
          }}
          onCreateNewVersion={() => {
            setNewVersionSourceReference(currentVersion?.sourceReference || '');
            setNewVersionChangeNote('');
            setIsNewVersionModalOpen(true);
          }}
          onCompareVersions={() => setIsDiffModalOpen(true)}
          onPublishVersion={handlePublish}
          onSubmitForApproval={handleSubmitForApproval}
          isPublishing={publishing}
        />

        {/* Feedback Banners */}
        {error && (
          <div className="p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 text-xs flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 4. General Tax Parameters Card */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Applicable Tax Year *
            </label>
            <input
              type="number"
              disabled={isPublished}
              value={taxYear}
              onChange={(e) => setTaxYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Statutory Currency
            </label>
            <div className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
              {country.currency}
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 cursor-pointer select-none h-8">
              <input
                type="checkbox"
                disabled={isPublished}
                checked={hasFilingStatuses}
                onChange={(e) => setHasFilingStatuses(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
              />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Multiple Filing Status Schedules
              </span>
            </label>
          </div>
        </div>

        {/* Effective Dating & Source Reference Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Effective From *
            </label>
            <input
              type="date"
              disabled={isPublished}
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Effective To (Optional)
            </label>
            <input
              type="date"
              disabled={false} // effectiveTo can be closed even on published version
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Mandatory Source Reference *
            </label>
            <input
              type="text"
              disabled={isPublished}
              value={sourceReference}
              onChange={(e) => setSourceReference(e.target.value)}
              placeholder="e.g. Income Tax Rates Act 1986 / IRS Notice 1036"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
            Change Note & Legislative Background *
          </label>
          <input
            type="text"
            disabled={isPublished}
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="e.g. Annual indexing of statutory tax brackets and low-income tax offset"
            className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
          />
        </div>
      </div>

      {/* 5. Multiple Filing Status Variants Navigation (if enabled) */}
      {hasFilingStatuses && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Split className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                Filing Status Variant Schedules
              </span>
            </div>

            {!isPublished && (
              <button
                type="button"
                onClick={() => setIsAddStatusModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Filing Status</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {filingStatuses.map((fs) => {
              const isActive = fs.statusKey === activeFilingStatusKey;
              const fsValidation = validateTaxBrackets(fs.brackets);

              return (
                <button
                  key={fs.statusKey}
                  type="button"
                  onClick={() => setActiveFilingStatusKey(fs.statusKey)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                    isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>{fs.label}</span>
                  {!fsValidation.isValid && (
                    <span className="h-2 w-2 rounded-full bg-red-400" title="Validation errors in this bracket schedule" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Bracket Table with Inline Validation */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Progressive Tax Bracket Table{' '}
            {hasFilingStatuses && activeFilingStatusConfig ? `(${activeFilingStatusConfig.label})` : ''}
          </h3>
          <span className="text-[11px] text-slate-400">
            Contiguous, ascending, non-overlapping sequence enforced.
          </span>
        </div>

        <TaxBracketTable
          brackets={activeBrackets}
          currency={country.currency}
          isReadOnly={isPublished}
          onChange={handleUpdateActiveBrackets}
        />
      </div>

      {/* 7. Rebates and Allowances Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <TaxRebatesSection
          rebates={activeRebates}
          currency={country.currency}
          isReadOnly={isPublished}
          onChange={handleUpdateActiveRebates}
        />
      </div>

      {/* 8. Minimum Tax Floor Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <MinimumTaxSection
          config={activeMinimumTax}
          currency={country.currency}
          isReadOnly={isPublished}
          onChange={handleUpdateActiveMinimumTax}
        />
      </div>

      {/* 9. Save Draft Action Footer */}
      {!isPublished && (
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {!allBracketsValid ? (
              <span className="text-amber-600 font-semibold flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Resolve bracket sequence validation warnings before saving draft.
              </span>
            ) : (
              <span>Draft versions are mutable. Once published, versions become permanently immutable.</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || !allBracketsValid}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span>Save Draft Tax Rules</span>
          </button>
        </div>
      )}

      {/* New Version Modal */}
      <Modal
        open={isNewVersionModalOpen}
        onClose={() => setIsNewVersionModalOpen(false)}
        title={`Author New Tax Rule Version (${country.isoCode})`}
        size="md"
      >
        <form onSubmit={handleCreateNewVersionSubmit} className="space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            In accordance with statutory payroll determinism, published rule versions are immutable. Creating a new version clones current parameters into an editable draft with incremental version numbering.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Effective From *
              </label>
              <input
                type="date"
                required
                value={newVersionEffectiveFrom}
                onChange={(e) => setNewVersionEffectiveFrom(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Effective To (Optional)
              </label>
              <input
                type="date"
                value={newVersionEffectiveTo}
                onChange={(e) => setNewVersionEffectiveTo(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Mandatory Source Reference *
            </label>
            <input
              type="text"
              required
              value={newVersionSourceReference}
              onChange={(e) => setNewVersionSourceReference(e.target.value)}
              placeholder="e.g. ATO Tax Laws Amendment Act 2025 / https://ato.gov.au/..."
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Change Note *
            </label>
            <textarea
              rows={3}
              required
              value={newVersionChangeNote}
              onChange={(e) => setNewVersionChangeNote(e.target.value)}
              placeholder="Explain statutory amendments, tax threshold adjustments, and legislative rationale..."
              className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsNewVersionModalOpen(false)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingVersion}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition"
            >
              {creatingVersion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              <span>Create Draft Version</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Custom Filing Status Modal */}
      <Modal
        open={isAddStatusModalOpen}
        onClose={() => setIsAddStatusModalOpen(false)}
        title="Add Filing Status Variant"
        size="sm"
      >
        <form onSubmit={handleAddFilingStatus} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Common Presets:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_FILING_STATUSES.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    setCustomStatusKey(preset.key);
                    setCustomStatusLabel(preset.label);
                  }}
                  className="px-2 py-1 rounded-md text-[11px] font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Filing Status Label *
            </label>
            <input
              type="text"
              required
              value={customStatusLabel}
              onChange={(e) => setCustomStatusLabel(e.target.value)}
              placeholder="e.g. Married Filing Jointly"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Status Identifier Key *
            </label>
            <input
              type="text"
              required
              value={customStatusKey}
              onChange={(e) => setCustomStatusKey(e.target.value)}
              placeholder="e.g. married_joint"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAddStatusModalOpen(false)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
            >
              Add Schedule
            </button>
          </div>
        </form>
      </Modal>

      {/* Side-by-Side Diff Modal */}
      {isDiffModalOpen && (
        <RuleVersionDiffModal
          open={isDiffModalOpen}
          onClose={() => setIsDiffModalOpen(false)}
          countryId={country.id}
          versions={versions}
          initialBaseVersionId={versions[1]?.id || versions[0]?.id || ''}
          initialCompareVersionId={versions[0]?.id || ''}
        />
      )}
    </div>
  );
}
