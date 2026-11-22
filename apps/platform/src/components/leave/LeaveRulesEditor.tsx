import { useEffect, useMemo, useState } from 'react';
import type {
  CountryConfiguration,
  CountrySummary,
  LeaveRulePayload,
  RuleVersionView,
  StateProvinceView,
  StatutoryLeaveRuleItem,
} from '@hrm/shared-types';
import {
  evaluateLeavePolicyCompliance,
  getDefaultStatutoryLeavesForCountry,
  normalizeLegacyLeavePayload,
  validateLeaveRulePayload,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Info,
  Layers,
  Loader2,
  Lock,
  Palmtree,
  Plus,
  RotateCcw,
  Save,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
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
import { StatutoryLeaveTable } from './StatutoryLeaveTable';

interface LeaveRulesEditorProps {
  country: CountrySummary;
  states?: StateProvinceView[];
  configuration: CountryConfiguration | null;
  completeness: { isComplete: boolean; label: string; tone: 'green' | 'amber' | 'slate' };
  onRefresh: () => Promise<void>;
}

export function LeaveRulesEditor({
  country,
  states = [],
  configuration,
  completeness,
  onRefresh,
}: LeaveRulesEditorProps) {
  // Scope selection
  const [selectedStateId, setSelectedStateId] = useState<string>('');

  // Version management
  const [versions, setVersions] = useState<RuleVersionView[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Core statutory leave state
  const [statutoryLeaves, setStatutoryLeaves] = useState<StatutoryLeaveRuleItem[]>(() =>
    getDefaultStatutoryLeavesForCountry(country.isoCode),
  );
  const [legalJurisdictionBaseline, setLegalJurisdictionBaseline] = useState<string>(
    country.isoCode === 'AUS'
      ? 'Fair Work Act 2009 — National Employment Standards (NES)'
      : `${country.name} Statutory Employment Regulations`,
  );
  const [probationEntitlementRestricted, setProbationEntitlementRestricted] = useState(false);
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(false);
  const [notes, setNotes] = useState('');

  // Version Metadata Form
  const [effectiveFrom, setEffectiveFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [effectiveTo, setEffectiveTo] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [changeNote, setChangeNote] = useState('');

  // Modals state
  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
  const [newVersionEffectiveFrom, setNewVersionEffectiveFrom] = useState(
    `${new Date().getFullYear() + 1}-01-01`,
  );
  const [newVersionEffectiveTo, setNewVersionEffectiveTo] = useState('');
  const [newVersionSourceReference, setNewVersionSourceReference] = useState(
    country.isoCode === 'AUS'
      ? 'Fair Work Act 2009 (NES)'
      : `${country.name} Statutory Employment Act`,
  );
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
      const data = await listRuleVersions(country.id, {
        ruleType: 'leave',
        stateProvinceId: selectedStateId || undefined,
      });
      setVersions(data);

      if (data.length > 0) {
        const target = selectId ? data.find((v) => v.id === selectId) : data[0];
        const active = target || data[0];
        setSelectedVersionId(active.id);
        populateFromVersion(active);
      } else {
        setSelectedVersionId(null);
        resetToDefaults();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load statutory leave rule versions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVersions();
  }, [country.id, selectedStateId]);

  const resetToDefaults = () => {
    setStatutoryLeaves(getDefaultStatutoryLeavesForCountry(country.isoCode));
    setLegalJurisdictionBaseline(
      country.isoCode === 'AUS'
        ? 'Fair Work Act 2009 — National Employment Standards (NES)'
        : `${country.name} Statutory Employment Regulations`,
    );
    setProbationEntitlementRestricted(false);
    setAllowNegativeBalance(false);
    setEffectiveFrom(`${new Date().getFullYear()}-01-01`);
    setEffectiveTo('');
    setSourceReference(
      country.isoCode === 'AUS'
        ? 'Fair Work Act 2009 (NES)'
        : `${country.name} Statutory Employment Act`,
    );
    setChangeNote('Initial statutory leave rules baseline version');
  };

  const populateFromVersion = (v: RuleVersionView) => {
    setEffectiveFrom(v.effectiveFrom);
    setEffectiveTo(v.effectiveTo || '');
    setSourceReference(v.sourceReference);
    setChangeNote(v.changeNote);

    const payload = (v.payload as unknown as Record<string, unknown>) || {};
    if (Array.isArray(payload.statutoryLeaves) && payload.statutoryLeaves.length > 0) {
      setStatutoryLeaves(payload.statutoryLeaves as StatutoryLeaveRuleItem[]);
    } else {
      setStatutoryLeaves(normalizeLegacyLeavePayload(payload, country.isoCode));
    }

    setLegalJurisdictionBaseline(
      typeof payload.legalJurisdictionBaseline === 'string'
        ? payload.legalJurisdictionBaseline
        : country.isoCode === 'AUS'
        ? 'Fair Work Act 2009 — National Employment Standards (NES)'
        : `${country.name} Statutory Employment Regulations`,
    );
    setProbationEntitlementRestricted(Boolean(payload.probationEntitlementRestricted));
    setAllowNegativeBalance(Boolean(payload.allowNegativeBalance));
    setNotes(typeof payload.notes === 'string' ? payload.notes : '');
  };

  const handleVersionChange = (versionId: string) => {
    setSelectedVersionId(versionId);
    const v = versions.find((item) => item.id === versionId);
    if (v) populateFromVersion(v);
  };

  // Build current payload
  const buildCurrentPayload = (): LeaveRulePayload => {
    return {
      statutoryLeaves,
      probationEntitlementRestricted,
      allowNegativeBalance,
      legalJurisdictionBaseline,
      notes: notes.trim() || undefined,
    };
  };

  // Real-time validation
  const validation = useMemo(() => {
    const p = buildCurrentPayload();
    return validateLeaveRulePayload(p);
  }, [statutoryLeaves, probationEntitlementRestricted, allowNegativeBalance, legalJurisdictionBaseline]);

  const handleLoadPreset = () => {
    setStatutoryLeaves(getDefaultStatutoryLeavesForCountry(country.isoCode));
    setSuccessMessage(`Loaded statutory preset for ${country.name} (${country.isoCode}).`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Save changes to active draft or sunset date on published version
  const handleSaveDraft = async () => {
    if (!currentVersion) return;

    if (isPublished) {
      try {
        setSaving(true);
        setError(null);
        await updateRuleVersion(country.id, currentVersion.id, {
          effectiveTo: effectiveTo || null,
        });
        setSuccessMessage('Updated sunset / effectiveTo date for published leave version.');
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
      setError(`Cannot save draft leave rules: ${validation.summaryError}`);
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

      setSuccessMessage('Draft statutory leave rules saved successfully.');
      await loadVersions(currentVersion.id);
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to save draft statutory leave rules.');
    } finally {
      setSaving(false);
    }
  };

  // Publish active version
  const handlePublish = async (versionId: string) => {
    if (!validation.isValid) {
      setError(`Cannot publish leave rule version: ${validation.summaryError}`);
      return;
    }

    try {
      setPublishing(true);
      setError(null);
      await publishRuleVersion(country.id, versionId);
      setSuccessMessage('Statutory leave rule version published and locked.');
      await loadVersions(versionId);
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to publish statutory leave rule version.');
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
      setSuccessMessage('Leave rule version submitted for compliance review.');
      await loadVersions(versionId);
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit for approval.');
    } finally {
      setSaving(false);
    }
  };

  // Handle clone into new version
  const handleCreateNewVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionSourceReference.trim() || !newVersionChangeNote.trim()) {
      setError('Source reference and change note are required to author a new rule version.');
      return;
    }

    try {
      setCreatingVersion(true);
      setError(null);

      const payloadToClone = buildCurrentPayload();

      const created = await createRuleVersion(country.id, {
        ruleType: 'leave',
        stateProvinceId: selectedStateId || null,
        effectiveFrom: newVersionEffectiveFrom,
        effectiveTo: newVersionEffectiveTo || null,
        sourceReference: newVersionSourceReference.trim(),
        changeNote: newVersionChangeNote.trim(),
        payload: payloadToClone as unknown as Record<string, unknown>,
        status: 'draft',
      });

      setIsNewVersionModalOpen(false);
      setSuccessMessage(`Created draft Version ${created.version}! You can now edit statutory leave minimums.`);
      await loadVersions(created.id);
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to create new draft version.');
    } finally {
      setCreatingVersion(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Stage Notice */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              <span>Stage C.04</span>
              <span>•</span>
              <span>Statutory Leave Rules & Legal Entitlements</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
              Statutory Leave Rules & Legal Entitlements
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                completeness.tone === 'green'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
              }`}
            >
              {completeness.label}
            </span>
            <button
              type="button"
              onClick={() =>
                window.open('https://www.fairwork.gov.au/leave', '_blank', 'noopener,noreferrer')
              }
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 transition"
            >
              <span>Fair Work Act (NES)</span>
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 leading-relaxed">
          Configure statutory legal minimums for annual, sick, maternity, paternity, and compassionate leave.
          These are the legal minimums: tenant companies may exceed them in company policies, but cannot go below them.
          Feeds Tenant Admin Panel (Stage F.1) leave policy compliance warnings.
        </p>

        {/* Rule Resolver Chain Breadcrumb */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 font-medium">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Scale className="h-4 w-4 text-indigo-500" />
            <span>Rule Resolver Chain:</span>
          </div>
          <span className="text-slate-400">Global Default</span>
          <span className="text-slate-300 dark:text-slate-600">→</span>
          <span className="font-bold text-indigo-600 dark:text-indigo-400">
            Country ({country.isoCode})
          </span>
          {selectedState && (
            <>
              <span className="text-slate-300 dark:text-slate-600">→</span>
              <span className="font-bold text-purple-600 dark:text-purple-400">
                State ({selectedState.code})
              </span>
            </>
          )}
          <span className="text-slate-300 dark:text-slate-600">→</span>
          <span className="text-slate-500 dark:text-slate-400">Company Policy</span>
          <span className="text-slate-300 dark:text-slate-600">→</span>
          <span className="text-slate-500 dark:text-slate-400">Employee Contract</span>
          <span className="ml-auto text-[11px] text-slate-400 font-mono">
            docs/LEAVE_LOGIC.md &amp; Stage F.1
          </span>
        </div>
      </div>

      {/* 2. Scope Switcher (National vs State/Province) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-400" />
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Jurisdiction Statutory Scope
            </div>
            <div className="text-[11px] text-slate-500">
              {selectedState
                ? `Regional State/Province statutory rules for ${selectedState.name} (${selectedState.code})`
                : `Federal / National statutory leave baseline applicable across all of ${country.name}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">Scope:</label>
          <select
            value={selectedStateId}
            onChange={(e) => setSelectedStateId(e.target.value)}
            className="h-8 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">National / Federal (All States)</option>
            {states.map((s) => (
              <option key={s.id} value={s.id}>
                State: {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. Rule Version Management Header */}
      <RuleVersionSelector
        versions={versions}
        selectedVersionId={selectedVersionId}
        onSelectVersion={handleVersionChange}
        onCreateNewVersion={() => {
          setNewVersionEffectiveFrom(`${new Date().getFullYear() + 1}-01-01`);
          setNewVersionEffectiveTo('');
          setNewVersionSourceReference(sourceReference || 'Fair Work Act 2009 (NES)');
          setNewVersionChangeNote('');
          setIsNewVersionModalOpen(true);
        }}
        onCompareVersions={() => setIsDiffModalOpen(true)}
        onPublishVersion={handlePublish}
        onSubmitForApproval={handleSubmitForApproval}
        isPublishing={publishing}
      />

      {/* 4. Feedback Messages */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1 font-medium">{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <div className="flex-1 font-medium">{successMessage}</div>
        </div>
      )}

      {/* 5. Statutory Legal Minimums Summary Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                validation.isValid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                  : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
              }`}
            >
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>
                  {validation.isValid ? 'Statutory Leave Baseline Valid' : 'Statutory Validation Incomplete'}
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300">
                  {statutoryLeaves.length} Types Configured
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {statutoryLeaves.length > 0
                  ? `Annual: ${statutoryLeaves.find((l) => l.category === 'annual')?.minimumEntitlementDays ?? '—'}d · Sick: ${statutoryLeaves.find((l) => l.category === 'sick')?.minimumEntitlementDays ?? '—'}d · Maternity: ${statutoryLeaves.find((l) => l.category === 'maternity')?.minimumEntitlementDays ?? '—'}d · Paternity: ${statutoryLeaves.find((l) => l.category === 'paternity')?.minimumEntitlementDays ?? '—'}d`
                  : 'No statutory leave types configured.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[11px] font-bold text-slate-500">Legal Baseline Jurisdiction</div>
              <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate max-w-xs">
                {legalJurisdictionBaseline}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Jurisdiction Baseline Details & Policy Restraints */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Statutory Framework &amp; General Leave Policy Bounds
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Legal Jurisdiction Baseline Reference *
            </label>
            <input
              type="text"
              disabled={isPublished}
              value={legalJurisdictionBaseline}
              onChange={(e) => setLegalJurisdictionBaseline(e.target.value)}
              placeholder="e.g. Fair Work Act 2009 (NES)"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-800"
            />
          </div>

          <div className="flex items-center gap-6 pt-5">
            <label
              className={`flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 ${
                isPublished ? 'cursor-not-allowed opacity-60' : ''
              }`}
            >
              <input
                type="checkbox"
                disabled={isPublished}
                checked={probationEntitlementRestricted}
                onChange={(e) => setProbationEntitlementRestricted(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
              />
              <span>Statutory Probation Restriction Allowed</span>
            </label>

            <label
              className={`flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 ${
                isPublished ? 'cursor-not-allowed opacity-60' : ''
              }`}
            >
              <input
                type="checkbox"
                disabled={isPublished}
                checked={allowNegativeBalance}
                onChange={(e) => setAllowNegativeBalance(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
              />
              <span>Permit Negative Balances by Default</span>
            </label>
          </div>
        </div>

        {/* Version Governance Dates */}
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
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
              Effective To (Optional)
            </label>
            <input
              type="date"
              disabled={false} // Can set sunset date on published version
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
              placeholder="e.g. Fair Work Act 2009 (Cth) Division 6"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
            Change Note &amp; Legislative Background *
          </label>
          <input
            type="text"
            disabled={isPublished}
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="e.g. Annual statutory indexing of NES leave baselines"
            className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:bg-slate-50 dark:disabled:bg-slate-800"
          />
        </div>
      </div>

      {/* 7. Statutory Leave Types Breakdown Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <StatutoryLeaveTable
          leaves={statutoryLeaves}
          isReadOnly={isPublished}
          countryIso={country.isoCode}
          onChange={setStatutoryLeaves}
          onLoadPreset={handleLoadPreset}
        />
      </div>

      {/* 8. Bottom Action Bar */}
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
        title={`Author New Leave Rule Version (${country.isoCode})`}
        size="md"
      >
        <form onSubmit={handleCreateNewVersionSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Create an incremental draft leave rule version for <strong>{country.name}</strong>.
            Published versions remain immutable; new versions increment version numbers and can be reviewed before publishing.
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
              placeholder="e.g. Fair Work Legislation Amendment Act 2026"
              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Change Note &amp; Audit Summary *
            </label>
            <textarea
              required
              rows={3}
              value={newVersionChangeNote}
              onChange={(e) => setNewVersionChangeNote(e.target.value)}
              placeholder="Explain statutory entitlement adjustments, carry-forward rules, and legal rationale..."
              className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
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
