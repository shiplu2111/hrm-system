import { useEffect, useMemo, useState } from 'react';
import type {
  CountryConfiguration,
  CountryRuleKind,
  CountrySummary,
  RuleVersionView,
  SocialSecurityContributionFrequency,
  SocialSecurityRulePayload,
  StateProvinceView,
  StatutoryFundItem,
} from '@hrm/shared-types';
import { validateSocialSecurityPayload } from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  Copy,
  ExternalLink,
  HeartPulse,
  Landmark,
  Layers,
  Loader2,
  Lock,
  Plus,
  Save,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Split,
  Timer,
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
import { StatutoryFundsTable } from './StatutoryFundsTable';

interface SocialSecurityRulesEditorProps {
  country: CountrySummary;
  states?: StateProvinceView[];
  configuration: CountryConfiguration | null;
  completeness: { isComplete: boolean; label: string; tone: 'green' | 'amber' | 'slate' };
  onRefresh: () => Promise<void>;
  defaultRuleType?: 'social_security' | 'pension';
}

const FREQUENCY_OPTIONS: { key: SocialSecurityContributionFrequency; label: string }[] = [
  { key: 'monthly', label: 'Monthly Remittance (Standard Statutory Calendar)' },
  { key: 'per_pay_period', label: 'Per Pay Period (With Every Active Payroll Run)' },
  { key: 'quarterly', label: 'Quarterly Superannuation Remittance (e.g. AU SG Quarterly)' },
  { key: 'biweekly', label: 'Bi-Weekly / Fortnightly' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'annual', label: 'Annual Statutory Audit & Reconciliation' },
];

export function SocialSecurityRulesEditor({
  country,
  states = [],
  configuration,
  completeness,
  onRefresh,
  defaultRuleType = 'social_security',
}: SocialSecurityRulesEditorProps) {
  // Scope and Rule Type selection
  const [activeRuleType, setActiveRuleType] = useState<'social_security' | 'pension'>(defaultRuleType);
  const [selectedStateId, setSelectedStateId] = useState<string>('');

  useEffect(() => {
    setActiveRuleType(defaultRuleType);
  }, [defaultRuleType]);

  // Version management
  const [versions, setVersions] = useState<RuleVersionView[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Core Social Security & Pension form state
  const [schemeName, setSchemeName] = useState(
    country.isoCode === 'AUS'
      ? 'Superannuation Guarantee'
      : `${country.name} Statutory Social Security & Pension`,
  );
  const [fundCode, setFundCode] = useState(country.isoCode === 'AUS' ? 'SUPER_AU' : 'SOC_SEC');
  const [administratorName, setAdministratorName] = useState(
    country.isoCode === 'AUS' ? 'Australian Taxation Office (ATO)' : 'National Social Security Agency',
  );
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [contributionFrequency, setContributionFrequency] = useState<SocialSecurityContributionFrequency>(
    country.isoCode === 'AUS' ? 'quarterly' : 'monthly',
  );
  const [contributionBase, setContributionBase] = useState<'gross' | 'basic'>('gross');
  const [employerRate, setEmployerRate] = useState<number>(country.isoCode === 'AUS' ? 11.5 : 10.0);
  const [employeeRate, setEmployeeRate] = useState<number>(country.isoCode === 'AUS' ? 0.0 : 5.0);
  const [wageFloor, setWageFloor] = useState<string>(country.isoCode === 'AUS' ? '450' : '');
  const [wageCeiling, setWageCeiling] = useState<string>(country.isoCode === 'AUS' ? '62270' : '');
  const [exemptBelowFloor, setExemptBelowFloor] = useState<boolean>(true);
  const [preTax, setPreTax] = useState<boolean>(true);
  const [voluntaryContributionAllowed, setVoluntaryContributionAllowed] = useState<boolean>(true);
  const [voluntaryContributionMaxRate, setVoluntaryContributionMaxRate] = useState<string>('15');
  const [hasSubFunds, setHasSubFunds] = useState<boolean>(false);
  const [funds, setFunds] = useState<StatutoryFundItem[]>([]);
  const [notes, setNotes] = useState('');

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

  // Active version derived
  const currentVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId) || null,
    [versions, selectedVersionId],
  );

  const isPublished = currentVersion?.status === 'published';
  const selectedState = states.find((s) => s.id === selectedStateId);

  // Load versions from API
  const loadVersions = async (selectId?: string) => {
    try {
      setLoading(true);
      setError(null);
      const list = await listRuleVersions(country.id, {
        ruleType: activeRuleType,
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
        resetToDefaults();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load social security rule versions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVersions();
  }, [country.id, activeRuleType, selectedStateId]);

  const resetToDefaults = () => {
    if (activeRuleType === 'pension' || country.isoCode === 'AUS') {
      setSchemeName(
        country.isoCode === 'AUS'
          ? 'Superannuation Guarantee'
          : `${country.name} Statutory Pension Scheme`,
      );
      setFundCode(country.isoCode === 'AUS' ? 'SUPER_AU' : 'PENSION');
      setAdministratorName(
        country.isoCode === 'AUS'
          ? 'Australian Taxation Office (ATO)'
          : 'National Pension Regulatory Authority',
      );
      setEmployerRate(country.isoCode === 'AUS' ? 11.5 : 10.0);
      setEmployeeRate(country.isoCode === 'AUS' ? 0.0 : 5.0);
      setWageFloor('450');
      setWageCeiling('62270');
      setContributionFrequency(country.isoCode === 'AUS' ? 'quarterly' : 'monthly');
    } else {
      setSchemeName(`${country.name} National Social Security Insurance`);
      setFundCode('SOC_SEC');
      setAdministratorName('National Social Security Agency');
      setEmployerRate(8.0);
      setEmployeeRate(4.0);
      setWageFloor('');
      setWageCeiling('');
      setContributionFrequency('monthly');
    }
    setContributionBase('gross');
    setExemptBelowFloor(true);
    setPreTax(true);
    setVoluntaryContributionAllowed(true);
    setVoluntaryContributionMaxRate('15');
    setHasSubFunds(false);
    setFunds([]);
    setEffectiveFrom(`${new Date().getFullYear()}-07-01`);
    setEffectiveTo('');
    setSourceReference(
      country.isoCode === 'AUS'
        ? 'Superannuation Guarantee (Administration) Act 1992'
        : `Statutory Social Insurance Act (${country.name})`,
    );
    setChangeNote('Initial statutory social security / pension rules baseline');
  };

  const populateFromVersion = (v: RuleVersionView) => {
    setEffectiveFrom(v.effectiveFrom);
    setEffectiveTo(v.effectiveTo || '');
    setSourceReference(v.sourceReference);
    setChangeNote(v.changeNote);

    const payload = (v.payload as unknown as Partial<SocialSecurityRulePayload>) || {};
    if (payload.schemeName) setSchemeName(payload.schemeName);
    if (payload.fundCode) setFundCode(payload.fundCode);
    if (payload.administratorName) setAdministratorName(payload.administratorName);
    if (payload.registrationNumber) setRegistrationNumber(payload.registrationNumber);
    if (payload.contributionFrequency) setContributionFrequency(payload.contributionFrequency);
    if (payload.contributionBase) setContributionBase(payload.contributionBase);

    const empRate = payload.employerContributionRate ?? payload.employerRate;
    if (typeof empRate === 'number') setEmployerRate(empRate);

    const emplRate = payload.employeeContributionRate ?? payload.employeeRate;
    if (typeof emplRate === 'number') setEmployeeRate(emplRate);

    setWageFloor(
      payload.wageFloor !== null && payload.wageFloor !== undefined
        ? String(payload.wageFloor)
        : '',
    );
    setWageCeiling(
      payload.wageCeiling !== null && payload.wageCeiling !== undefined
        ? String(payload.wageCeiling)
        : '',
    );

    setExemptBelowFloor(Boolean(payload.exemptBelowFloor));
    setPreTax(payload.preTax !== undefined ? Boolean(payload.preTax) : true);
    setVoluntaryContributionAllowed(Boolean(payload.voluntaryContributionAllowed));
    setVoluntaryContributionMaxRate(
      payload.voluntaryContributionMaxRate !== null &&
        payload.voluntaryContributionMaxRate !== undefined
        ? String(payload.voluntaryContributionMaxRate)
        : '',
    );

    setHasSubFunds(Boolean(payload.hasSubFunds));
    if (Array.isArray(payload.funds)) {
      setFunds(payload.funds);
    } else {
      setFunds([]);
    }

    if (payload.notes) setNotes(payload.notes);
  };

  // Build current payload
  const buildCurrentPayload = (): SocialSecurityRulePayload => {
    return {
      schemeName: schemeName.trim(),
      fundCode: fundCode.trim() || undefined,
      administratorName: administratorName.trim() || undefined,
      registrationNumber: registrationNumber.trim() || undefined,
      contributionFrequency,
      contributionBase,
      employerContributionRate: employerRate,
      employeeContributionRate: employeeRate,
      employerRate, // compatibility alias
      employeeRate, // compatibility alias
      superannuationGuaranteeRate: employerRate, // AU payroll compatibility alias
      wageFloor: wageFloor !== '' ? parseFloat(wageFloor) : null,
      wageCeiling: wageCeiling !== '' ? parseFloat(wageCeiling) : null,
      exemptBelowFloor,
      preTax,
      voluntaryContributionAllowed,
      voluntaryContributionMaxRate:
        voluntaryContributionMaxRate !== '' ? parseFloat(voluntaryContributionMaxRate) : null,
      hasSubFunds,
      funds: hasSubFunds ? funds : [],
      notes: notes.trim() || `${country.name} Statutory ${activeRuleType === 'pension' ? 'Pension' : 'Social Security'} Rules`,
    };
  };

  // Real-time validation
  const validation = useMemo(() => {
    const p = buildCurrentPayload();
    return validateSocialSecurityPayload(p);
  }, [
    schemeName,
    employerRate,
    employeeRate,
    contributionBase,
    contributionFrequency,
    wageFloor,
    wageCeiling,
    voluntaryContributionAllowed,
    voluntaryContributionMaxRate,
    hasSubFunds,
    funds,
  ]);

  // Auto-sum rates from sub-funds
  const handleAutoSumRates = () => {
    if (funds.length === 0) return;
    const sumEmp = funds.reduce((acc, f) => acc + (f.employerRate || 0), 0);
    const sumEmpl = funds.reduce((acc, f) => acc + (f.employeeRate || 0), 0);
    setEmployerRate(Math.round(sumEmp * 100) / 100);
    setEmployeeRate(Math.round(sumEmpl * 100) / 100);
    setSuccessMessage(`Summed sub-fund contribution rates: Employer ${sumEmp}% | Employee ${sumEmpl}%.`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Save changes to active draft or update sunset date on published version
  const handleSaveDraft = async () => {
    if (!currentVersion) return;

    if (isPublished) {
      try {
        setSaving(true);
        setError(null);
        await updateRuleVersion(country.id, currentVersion.id, {
          effectiveTo: effectiveTo || null,
        });
        setSuccessMessage('Updated sunset / effectiveTo date for published version.');
        await loadVersions(currentVersion.id);
        await onRefresh();
      } catch (err: any) {
        setError(err?.message || 'Failed to update sunset date.');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!validation.isValid) {
      setError(`Cannot save draft rules: ${validation.summaryError}`);
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

      setSuccessMessage('Draft social security / pension rules saved successfully.');
      await loadVersions(currentVersion.id);
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to save draft rule version.');
    } finally {
      setSaving(false);
    }
  };

  // Publish active version
  const handlePublish = async (versionId: string) => {
    if (!validation.isValid) {
      setError(`Cannot publish rule version: ${validation.summaryError}`);
      return;
    }

    try {
      setPublishing(true);
      setError(null);
      await publishRuleVersion(country.id, versionId);
      setSuccessMessage('Statutory social security / pension rule version published and locked.');
      await loadVersions(versionId);
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to publish rule version.');
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
      setSuccessMessage('Rule version submitted for compliance review.');
      await loadVersions(versionId);
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
        ruleType: activeRuleType,
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
      setSuccessMessage(`Created draft Version ${created.version}! You can now edit statutory rates and caps.`);
      await loadVersions(created.id);
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to create new rule version.');
    } finally {
      setCreatingVersion(false);
    }
  };

  const totalCombinedRate = employerRate + employeeRate;

  return (
    <div className="space-y-6">
      {/* 1. Stage C.02 / C.03 Specification Card */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              {activeRuleType === 'pension' ? (
                <Landmark className="h-6 w-6" />
              ) : (
                <ShieldCheck className="h-6 w-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded">
                  {activeRuleType === 'pension' ? 'Stage C.03' : 'Stage C.02'}
                </span>
                <span className="text-xs font-semibold text-slate-400">•</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {activeRuleType === 'pension'
                    ? 'Superannuation & Statutory Pension Schemes'
                    : 'Social Security & Statutory Contributions'}
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                {activeRuleType === 'pension'
                  ? 'Pension & Superannuation Rules Editor'
                  : 'Social Security Rules & Statutory Insurance'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Rule category switcher toggle */}
            <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveRuleType('social_security')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeRuleType === 'social_security'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Social Security (C.02)
              </button>
              <button
                type="button"
                onClick={() => setActiveRuleType('pension')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeRuleType === 'pension'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Pension / Super (C.03)
              </button>
            </div>

            {/* Completeness Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
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
              onClick={() => alert('Feeds Phase 2 Stage 20.1: Statutory deductions & superannuation contribution resolver.')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 transition"
            >
              <span>Feeds Stage 20.1</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 mt-4 leading-relaxed">
          Configure statutory employer and employee contribution rates, statutory wage ceilings and floors, contribution frequency, and fund administrator details. Feeds Phase 2 Stage 20.1 statutory deductions and superannuation guarantee calculations.
        </p>

        {/* Rule Resolver Notice */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Layers className="h-3.5 w-3.5 text-indigo-500" />
            Rule Resolver Chain: Global Default → <strong>Country ({country.isoCode})</strong> →{' '}
            {selectedState ? <strong>State ({selectedState.code})</strong> : 'State'} → Company Policy → Employee Contract
          </span>
          <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            MODULES.md §21 & PAYROLL_LOGIC.md §4
          </span>
        </div>
      </div>

      {/* 2. State / Jurisdiction Scope Switcher */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              Jurisdiction Statutory Scope
            </div>
            <div className="text-[11px] text-slate-500">
              {selectedState
                ? `Regional State/Province statutory rules for ${selectedState.name} (${selectedState.code})`
                : `Federal / National statutory rules applicable across all of ${country.name}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-500">Scope:</span>
          <select
            value={selectedStateId}
            onChange={(e) => setSelectedStateId(e.target.value)}
            className="h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
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

      {/* 3. Reusable RuleVersion Framework Header */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
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

        {/* Validation Status Summary Banner */}
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-3 transition-colors ${
            validation.isValid
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-amber-50/80 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300'
          }`}
        >
          {validation.isValid ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-bold">
                {validation.isValid
                  ? 'Statutory Contribution Parameters Valid'
                  : 'Validation Warning: Contribution Configuration Incomplete'}
              </span>
              <span className="font-mono text-[11px] font-semibold opacity-75">
                Total Liability: {totalCombinedRate.toFixed(2)}%
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed">
              {validation.isValid
                ? `Employer contributes ${employerRate}% and employee contributes ${employeeRate}% calculated on ${contributionBase === 'gross' ? 'gross earnings' : 'basic salary'}. ${wageCeiling ? `Subject to statutory wage ceiling of ${country.currency} ${parseFloat(wageCeiling).toLocaleString()}.` : 'No wage ceiling specified.'}`
                : validation.summaryError}
            </p>
          </div>
        </div>

        {/* 4. Fund & Scheme Identification Details */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Statutory Scheme / Fund Name *
            </label>
            <input
              type="text"
              disabled={isPublished}
              value={schemeName}
              onChange={(e) => setSchemeName(e.target.value)}
              placeholder="e.g. Superannuation Guarantee / National Insurance / FICA"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Fund / Scheme Code
            </label>
            <input
              type="text"
              disabled={isPublished}
              value={fundCode}
              onChange={(e) => setFundCode(e.target.value.toUpperCase())}
              placeholder="e.g. SUPER_AU"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Regulator / Administrator
            </label>
            <input
              type="text"
              disabled={isPublished}
              value={administratorName}
              onChange={(e) => setAdministratorName(e.target.value)}
              placeholder="e.g. ATO / SSA / HMRC"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
            />
          </div>
        </div>

        {/* 5. Contribution Rates and Split */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Employer Contribution Rate (%) *
            </label>
            <div className="relative">
              <input
                type="number"
                disabled={isPublished}
                min={0}
                max={100}
                step="0.01"
                value={employerRate}
                onChange={(e) => setEmployerRate(parseFloat(e.target.value) || 0)}
                className="w-full h-8 pl-3 pr-7 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                %
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Reported on payslip; does not reduce net pay
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Employee Contribution Rate (%) *
            </label>
            <div className="relative">
              <input
                type="number"
                disabled={isPublished}
                min={0}
                max={100}
                step="0.01"
                value={employeeRate}
                onChange={(e) => setEmployeeRate(parseFloat(e.target.value) || 0)}
                className="w-full h-8 pl-3 pr-7 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                %
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Deducted from employee net pay during payroll
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Statutory Contribution Frequency *
            </label>
            <select
              disabled={isPublished}
              value={contributionFrequency}
              onChange={(e) => setContributionFrequency(e.target.value as SocialSecurityContributionFrequency)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
            >
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Reporting and deduction remittance cycle
            </span>
          </div>
        </div>

        {/* 6. Wage Ceilings, Floors & Basis */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Contribution Calculation Base *
            </label>
            <select
              disabled={isPublished}
              value={contributionBase}
              onChange={(e) => setContributionBase(e.target.value as 'gross' | 'basic')}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
            >
              <option value="gross">Gross Salary / Total Earnings</option>
              <option value="basic">Basic Salary Only</option>
            </select>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Determines eligible earnings base
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Wage Floor / Min Threshold ({country.currency})
            </label>
            <input
              type="number"
              disabled={isPublished}
              min={0}
              step="any"
              value={wageFloor}
              onChange={(e) => setWageFloor(e.target.value)}
              placeholder="e.g. 450 (or leave empty)"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Earnings below floor are exempt from contribution
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Wage Ceiling / Statutory Cap ({country.currency})
            </label>
            <input
              type="number"
              disabled={isPublished}
              min={0}
              step="any"
              value={wageCeiling}
              onChange={(e) => setWageCeiling(e.target.value)}
              placeholder="e.g. 62270 (or leave empty for uncapped)"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Maximum earnings subject to contribution
            </span>
          </div>

          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={isPublished}
                checked={preTax}
                onChange={(e) => setPreTax(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Pre-Tax Deduction
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                disabled={isPublished}
                checked={exemptBelowFloor}
                onChange={(e) => setExemptBelowFloor(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Exempt Under Floor
              </span>
            </label>
          </div>
        </div>

        {/* 7. Voluntary Additional Contributions (Salary Sacrifice / AVC) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer select-none mb-1">
              <input
                type="checkbox"
                disabled={isPublished}
                checked={voluntaryContributionAllowed}
                onChange={(e) => setVoluntaryContributionAllowed(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
              />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Allow Voluntary Additional Contributions (Salary Sacrifice / AVC)
              </span>
            </label>
            <p className="text-[11px] text-slate-400">
              Permits employees to nominate voluntary additional superannuation/pension contributions beyond the statutory minimum.
            </p>
          </div>

          {voluntaryContributionAllowed && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Max Voluntary Contribution Rate (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  disabled={isPublished}
                  min={0}
                  max={100}
                  step="0.01"
                  value={voluntaryContributionMaxRate}
                  onChange={(e) => setVoluntaryContributionMaxRate(e.target.value)}
                  placeholder="e.g. 15 (or leave empty)"
                  className="w-full h-8 pl-3 pr-7 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-mono">
                  %
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 8. Effective Dating & Source Reference Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
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
              disabled={false}
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
              placeholder="e.g. Superannuation Guarantee (Administration) Act 1992"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
            />
          </div>
        </div>

        {/* Change Note */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
            Change Note & Legislative Background *
          </label>
          <input
            type="text"
            disabled={isPublished}
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="e.g. Annual statutory indexing of superannuation guarantee rate and maximum contribution base cap"
            className="w-full h-8 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-800"
          />
        </div>
      </div>

      {/* 9. Multi-Component Statutory Sub-Funds Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="subfunds-toggle"
              disabled={isPublished}
              checked={hasSubFunds}
              onChange={(e) => setHasSubFunds(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
            />
            <label htmlFor="subfunds-toggle" className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer select-none">
              Configure Detailed Multi-Component Sub-Funds Breakdown
            </label>
          </div>
          <span className="text-[11px] text-slate-400">
            For multi-tier statutory schemes (Pension + Health + Unemployment + Disability)
          </span>
        </div>

        {hasSubFunds && (
          <StatutoryFundsTable
            funds={funds}
            currency={country.currency}
            isReadOnly={isPublished}
            onChange={setFunds}
            onAutoSumRates={handleAutoSumRates}
          />
        )}
      </div>

      {/* 10. Bottom Action Bar */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {isPublished ? (
            <span className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
              <Lock className="h-4 w-4" />
              Published versions are locked. Click &quot;New Version&quot; above to propose amendments.
            </span>
          ) : (
            <span>
              Draft versions are mutable. Once published, versions become permanently immutable.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isPublished && currentVersion && (
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveDraft}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Update Sunset Date</span>
            </button>
          )}

          {!isPublished && currentVersion && (
            <button
              type="button"
              disabled={saving || !validation.isValid}
              onClick={handleSaveDraft}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Save Draft Rules</span>
            </button>
          )}
        </div>
      </div>

      {/* New Version Creation Modal */}
      <Modal
        open={isNewVersionModalOpen}
        onClose={() => setIsNewVersionModalOpen(false)}
        title={`Author New ${activeRuleType === 'pension' ? 'Pension' : 'Social Security'} Rule Version (${country.isoCode})`}
        size="md"
      >
        <form onSubmit={handleCreateNewVersionSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Create an incremental draft rule version for <strong>{country.name}</strong>. Published versions remain immutable; new versions increment version numbers and can be reviewed before publishing.
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
              placeholder="e.g. Superannuation Guarantee (Administration) Amendment Act 2025"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Change Note & Audit Summary *
            </label>
            <textarea
              required
              rows={3}
              value={newVersionChangeNote}
              onChange={(e) => setNewVersionChangeNote(e.target.value)}
              placeholder="Explain statutory rate adjustments, contribution wage caps, and legal rationale..."
              className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsNewVersionModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingVersion}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs disabled:opacity-50"
            >
              {creatingVersion ? 'Creating Draft...' : 'Create Draft Version'}
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
          initialBaseVersionId={versions[1]?.id || versions[0]?.id}
          initialCompareVersionId={versions[0]?.id}
        />
      )}
    </div>
  );
}
