import { useEffect, useState } from 'react';
import type {
  RuleVersionStatus,
  RuleVersionView,
} from '@hrm/shared-types';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  GitCompare,
  Layers,
  Loader2,
  Lock,
  Plus,
  Save,
  ShieldAlert,
  UploadCloud,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  createRuleVersion,
  listRuleVersions,
  publishRuleVersion,
  updateRuleVersion,
} from '@/lib/platform-countries-api';
import { RuleVersionDiffModal } from './RuleVersionDiffModal';
import { RuleVersionSelector } from './RuleVersionSelector';
import { RuleVersionStatusPill } from './RuleVersionStatusPill';

interface RuleVersionEditorProps {
  countryId: string;
  countryName: string;
  ruleType: string;
  ruleTitle: string;
  ruleDescription: string;
  defaultPayloadTemplate?: Record<string, unknown>;
  stateProvinceId?: string | null;
  onVersionChanged?: (version: RuleVersionView) => void;
  onRefresh?: () => Promise<void> | void;
}

export function RuleVersionEditor({
  countryId,
  countryName,
  ruleType,
  ruleTitle,
  ruleDescription,
  defaultPayloadTemplate = {},
  stateProvinceId = null,
  onVersionChanged,
  onRefresh,
}: RuleVersionEditorProps) {
  const [versions, setVersions] = useState<RuleVersionView[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active version form fields
  const [formEffectiveFrom, setFormEffectiveFrom] = useState('');
  const [formEffectiveTo, setFormEffectiveTo] = useState('');
  const [formSourceReference, setFormSourceReference] = useState('');
  const [formChangeNote, setFormChangeNote] = useState('');
  const [formJsonPayload, setFormJsonPayload] = useState('{}');

  // New Version Modal state
  const [isNewVersionModalOpen, setIsNewVersionModalOpen] = useState(false);
  const [newVersionEffectiveFrom, setNewVersionEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [newVersionEffectiveTo, setNewVersionEffectiveTo] = useState('');
  const [newVersionSourceReference, setNewVersionSourceReference] = useState('');
  const [newVersionChangeNote, setNewVersionChangeNote] = useState('');
  const [creatingVersion, setCreatingVersion] = useState(false);

  // Diff Modal state
  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);

  // Load versions from API
  const loadVersions = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await listRuleVersions(countryId, {
        ruleType,
        stateProvinceId: stateProvinceId || undefined,
      });
      setVersions(list);

      // Select active or latest version
      const preferred =
        list.find((v) => v.id === selectedVersionId) ||
        list.find((v) => v.status === 'published') ||
        list[0] ||
        null;

      if (preferred) {
        setSelectedVersionId(preferred.id);
        populateForm(preferred);
        if (onVersionChanged) onVersionChanged(preferred);
      } else {
        // No version exists yet
        setSelectedVersionId(null);
        setFormJsonPayload(JSON.stringify(defaultPayloadTemplate, null, 2));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load rule versions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVersions();
  }, [countryId, ruleType, stateProvinceId]);

  const populateForm = (v: RuleVersionView) => {
    setFormEffectiveFrom(v.effectiveFrom);
    setFormEffectiveTo(v.effectiveTo || '');
    setFormSourceReference(v.sourceReference);
    setFormChangeNote(v.changeNote);
    setFormJsonPayload(JSON.stringify(v.payload, null, 2));
  };

  const handleSelectVersion = (versionId: string) => {
    setSelectedVersionId(versionId);
    const selected = versions.find((v) => v.id === versionId);
    if (selected) {
      populateForm(selected);
      if (onVersionChanged) onVersionChanged(selected);
    }
  };

  const currentVersion =
    versions.find((v) => v.id === selectedVersionId) || null;
  const isPublished = currentVersion?.status === 'published';

  // Save changes to active draft version
  const handleSaveDraft = async () => {
    if (!currentVersion || isPublished) return;
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      let parsedPayload: Record<string, unknown>;
      try {
        parsedPayload = JSON.parse(formJsonPayload);
      } catch (e: any) {
        throw new Error(`Invalid JSON in rule payload: ${e.message}`);
      }

      const updated = await updateRuleVersion(countryId, currentVersion.id, {
        effectiveFrom: formEffectiveFrom,
        effectiveTo: formEffectiveTo || null,
        sourceReference: formSourceReference,
        changeNote: formChangeNote,
        payload: parsedPayload,
      });

      setSuccessMessage('Draft version saved successfully.');
      await loadVersions();
      await onRefresh?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to save rule version.');
    } finally {
      setSaving(false);
    }
  };

  // Publish active version
  const handlePublish = async (versionId: string) => {
    try {
      setPublishing(true);
      setError(null);
      setSuccessMessage(null);

      await publishRuleVersion(countryId, versionId);
      setSuccessMessage('Rule version published successfully!');
      await loadVersions();
      await onRefresh?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to publish rule version.');
    } finally {
      setPublishing(false);
    }
  };

  // Submit draft for approval
  const handleSubmitForApproval = async (versionId: string) => {
    try {
      setSaving(true);
      setError(null);
      await updateRuleVersion(countryId, versionId, {
        status: 'pending_approval',
      });
      setSuccessMessage('Version submitted for review and approval.');
      await loadVersions();
      await onRefresh?.();
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

      let payloadToClone = defaultPayloadTemplate;
      if (currentVersion?.payload) {
        payloadToClone = currentVersion.payload;
      }

      const created = await createRuleVersion(countryId, {
        ruleType,
        stateProvinceId: stateProvinceId || null,
        effectiveFrom: newVersionEffectiveFrom,
        effectiveTo: newVersionEffectiveTo || null,
        sourceReference: newVersionSourceReference.trim(),
        changeNote: newVersionChangeNote.trim(),
        payload: payloadToClone,
        status: 'draft',
      });

      setIsNewVersionModalOpen(false);
      setSelectedVersionId(created.id);
      setSuccessMessage(`Created draft Version ${created.version}!`);
      await loadVersions();
      await onRefresh?.();
    } catch (err: any) {
      setError(err?.message || 'Failed to create new rule version.');
    } finally {
      setCreatingVersion(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Rule Header Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <span>{ruleTitle}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">{ruleDescription}</p>
          </div>
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            {countryName} ({ruleType.toUpperCase()})
          </span>
        </div>

        {/* Reusable Version Selector Bar */}
        <div className="mt-4">
          <RuleVersionSelector
            versions={versions}
            selectedVersionId={selectedVersionId}
            onSelectVersion={handleSelectVersion}
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
        </div>

        {/* Feedback Banners */}
        {error && (
          <div className="mt-4 p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 text-xs flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-4 p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Active Version Parameters Form */}
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            <span>Loading rule version definition...</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <p className="text-xs font-semibold">
              No statutory rule version authored for {ruleTitle}.
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Create Version 1 to establish baseline rules for {countryName}.
            </p>
            <button
              type="button"
              onClick={() => {
                setNewVersionSourceReference('');
                setNewVersionChangeNote('Initial statutory baseline version');
                setIsNewVersionModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500"
            >
              <Plus className="h-3.5 w-3.5" />
              Author Version 1
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {/* Metadata Fields: Effective Dates, Source Reference, Change Note */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/40">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Effective From <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formEffectiveFrom}
                  onChange={(e) => setFormEffectiveFrom(e.target.value)}
                  disabled={isPublished}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-mono font-bold focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Effective To (Optional)
                </label>
                <input
                  type="date"
                  value={formEffectiveTo}
                  onChange={(e) => setFormEffectiveTo(e.target.value)}
                  disabled={isPublished}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-mono font-bold focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Source Reference (URL / Document & Date) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fair Work Act 2009 s.119 / https://legislation.gov.au/..."
                  value={formSourceReference}
                  onChange={(e) => setFormSourceReference(e.target.value)}
                  disabled={isPublished}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Change Note (Reason & Legislative Background) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual indexation adjustment for statutory wage ceilings"
                  value={formChangeNote}
                  onChange={(e) => setFormChangeNote(e.target.value)}
                  disabled={isPublished}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            {/* JSON Schema Payload Textarea */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Rule Payload (JSON Parameter Definition)
                </label>
                <span className="text-[11px] font-mono text-slate-400">
                  {isPublished ? 'Read-Only (Published)' : 'Editable (Draft)'}
                </span>
              </div>
              <textarea
                rows={12}
                value={formJsonPayload}
                onChange={(e) => setFormJsonPayload(e.target.value)}
                disabled={isPublished}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-80"
              />
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">
                Rule Resolver: Global Default → <strong>Country ({countryName})</strong> → State Rules → Company Policy
              </span>

              {!isPublished && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition shadow-xs disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save Draft
                  </button>

                  <button
                    type="button"
                    onClick={() => currentVersion && handlePublish(currentVersion.id)}
                    disabled={publishing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition shadow-xs disabled:opacity-60"
                  >
                    {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
                    Publish Version
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* New Version Creation Modal */}
      <Modal
        open={isNewVersionModalOpen}
        onClose={() => setIsNewVersionModalOpen(false)}
        title={`Create New Version for ${ruleTitle}`}
      >
        <form onSubmit={handleCreateNewVersionSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            Create a new version to propose changes to <strong>{ruleTitle}</strong> for {countryName}.
            Published versions are never mutated; this initiates a new draft with incremental version numbering.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Effective From <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={newVersionEffectiveFrom}
                onChange={(e) => setNewVersionEffectiveFrom(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 text-xs font-mono font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Effective To (Optional)
              </label>
              <input
                type="date"
                value={newVersionEffectiveTo}
                onChange={(e) => setNewVersionEffectiveTo(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 text-xs font-mono font-bold focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Mandatory Source Reference <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Fair Work Ombudsman Notice 2024 / Gazetted Doc #102"
              value={newVersionSourceReference}
              onChange={(e) => setNewVersionSourceReference(e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent px-3 text-xs focus:outline-none"
            />
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Official legislative URL or statutory gazette document name and date.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Change Note <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={2}
              required
              placeholder="Explain what is changing in this version and why..."
              value={newVersionChangeNote}
              onChange={(e) => setNewVersionChangeNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent p-2.5 text-xs focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsNewVersionModalOpen(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creatingVersion}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {creatingVersion ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create Draft Version
            </button>
          </div>
        </form>
      </Modal>

      {/* Side-by-Side Diff Modal */}
      <RuleVersionDiffModal
        open={isDiffModalOpen}
        onClose={() => setIsDiffModalOpen(false)}
        versions={versions}
        countryId={countryId}
        initialBaseVersionId={versions[1]?.id || versions[0]?.id}
        initialCompareVersionId={currentVersion?.id || versions[0]?.id}
      />
    </div>
  );
}
