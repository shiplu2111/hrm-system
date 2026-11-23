import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Globe,
  Info,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import type {
  CountrySummary,
  CreatePlatformTemplateInput,
  PlatformDefaultTemplate,
  PlatformTemplateCategory,
  UpdatePlatformTemplateInput,
} from '@hrm/shared-types';
import {
  createPlatformDefaultTemplate,
  updatePlatformDefaultTemplate,
} from '@/lib/platform-countries-api';

interface TemplateEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  countries: CountrySummary[];
  initialCategory?: PlatformTemplateCategory;
  initialCountryId?: string | null;
  editingTemplate?: PlatformDefaultTemplate | null;
}

export function TemplateEditorModal({
  isOpen,
  onClose,
  onSuccess,
  countries,
  initialCategory = 'document_types',
  initialCountryId = null,
  editingTemplate = null,
}: TemplateEditorModalProps) {
  if (!isOpen) return null;

  const isEditing = Boolean(editingTemplate);

  const [category, setCategory] = useState<PlatformTemplateCategory>(
    editingTemplate?.category ?? initialCategory,
  );
  const [countryId, setCountryId] = useState<string | null>(
    editingTemplate ? editingTemplate.countryId ?? null : initialCountryId,
  );
  const [name, setName] = useState(editingTemplate?.name ?? '');
  const [description, setDescription] = useState(editingTemplate?.description ?? '');
  const [effectiveFrom, setEffectiveFrom] = useState(
    editingTemplate?.effectiveFrom ?? new Date().toISOString().slice(0, 10),
  );
  const [changeSummary, setChangeSummary] = useState(
    editingTemplate?.changeSummary ?? '',
  );
  const [sourceReference, setSourceReference] = useState(
    editingTemplate?.sourceReference ?? '',
  );
  const [status, setStatus] = useState<'draft' | 'published'>('draft');

  const [rawPayload, setRawPayload] = useState<string>(() => {
    if (editingTemplate?.payload) {
      return JSON.stringify(editingTemplate.payload, null, 2);
    }
    return '';
  });

  const [jsonError, setJsonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load sample template helper
  const handleLoadSample = () => {
    let sample: any = [];
    if (category === 'document_types') {
      sample = [
        {
          name: 'Passport / Citizen ID',
          description: 'Official government photo identification',
          scope: 'employee',
          requiresVerification: true,
          tracksExpiry: true,
        },
        {
          name: 'Direct Deposit Bank Form',
          description: 'Banking disbursement authorization',
          scope: 'employee',
          requiresVerification: true,
          tracksExpiry: false,
        },
      ];
    } else if (category === 'leave_policies') {
      sample = [
        {
          name: 'Annual Leave',
          code: 'ANNUAL',
          isPaid: true,
          entitlementDays: 20,
          accrualType: 'yearly',
          carryForwardMax: 10,
          expiryMonths: 18,
          encashmentAllowed: true,
          probationRestricted: false,
          allowNegativeBalance: false,
          halfDayAllowed: true,
          deductPublicHolidays: true,
          approvalSteps: [{ roleName: 'Manager' }, { roleName: 'HR Admin' }],
        },
        {
          name: 'Sick / Personal Leave',
          code: 'SICK',
          isPaid: true,
          entitlementDays: 10,
          accrualType: 'yearly',
          carryForwardMax: 10,
          expiryMonths: null,
          encashmentAllowed: false,
          probationRestricted: false,
          allowNegativeBalance: false,
          halfDayAllowed: true,
          deductPublicHolidays: true,
          approvalSteps: [{ roleName: 'Manager' }],
        },
      ];
    } else if (category === 'notification_templates') {
      sample = [
        {
          key: 'leave_request_submitted',
          title: 'Leave Request Submitted',
          channels: ['in_app', 'email'],
          subject: 'Leave request submitted by {{employeeName}}',
          body: 'A new leave request for {{days}} days is waiting for review.',
          variables: ['employeeName', 'days', 'startDate'],
        },
        {
          key: 'payslip_published',
          title: 'Payslip Ready',
          channels: ['in_app', 'email'],
          subject: 'Your payslip for {{period}} is published',
          body: 'Your payslip for {{period}} is now ready for view.',
          variables: ['period', 'employeeName'],
        },
      ];
    } else if (category === 'default_roles') {
      sample = [
        {
          name: 'Company Owner',
          description: 'Full administrative authority',
          dataScope: 'all',
          permissions: [
            { module: 'employee', actions: ['view', 'create', 'edit', 'delete', 'approve', 'finalize'] },
            { module: 'payroll', actions: ['view', 'create', 'edit', 'delete', 'approve', 'finalize'] },
          ],
        },
        {
          name: 'Manager',
          description: 'Team supervisor',
          dataScope: 'team',
          permissions: [
            { module: 'employee', actions: ['view'] },
            { module: 'attendance', actions: ['view', 'create', 'edit', 'approve'] },
            { module: 'leave', actions: ['view', 'create', 'approve'] },
          ],
        },
      ];
    } else if (category === 'onboarding_checklists') {
      sample = {
        name: 'Standard Cross-Functional Onboarding Checklist',
        description: 'Default onboarding workflow for new employees',
        isDefault: true,
        items: [
          {
            title: 'Upload Official Government Identification',
            category: 'document_collection',
            taskType: 'document_collection',
            documentTypeName: 'Passport / Citizen ID',
            assigneeLabel: 'Employee',
            dueDaysOffset: 1,
            isRequired: true,
          },
          {
            title: 'Provide Direct Deposit Details',
            category: 'document_collection',
            taskType: 'document_collection',
            documentTypeName: 'Direct Deposit Bank Form',
            assigneeLabel: 'Employee',
            dueDaysOffset: 2,
            isRequired: true,
          },
          {
            title: 'IT Hardware & Laptop Provisioning',
            category: 'equipment_provisioning',
            taskType: 'provisioning',
            assigneeLabel: 'IT Support',
            dueDaysOffset: 1,
            isRequired: true,
          },
        ],
      };
    }

    setRawPayload(JSON.stringify(sample, null, 2));
    setJsonError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setJsonError(null);

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(rawPayload);
    } catch (err: any) {
      setJsonError(`Invalid JSON format: ${err.message}`);
      return;
    }

    if (!name.trim()) {
      setErrorMsg('Template name is required');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing && editingTemplate) {
        const updateInput: UpdatePlatformTemplateInput = {
          name: name.trim(),
          description: description.trim() || undefined,
          payload: parsedPayload,
          effectiveFrom,
          changeSummary: changeSummary.trim() || undefined,
          sourceReference: sourceReference.trim() || undefined,
        };
        await updatePlatformDefaultTemplate(editingTemplate.id, updateInput);
      } else {
        const createInput: CreatePlatformTemplateInput = {
          countryId: countryId || null,
          category,
          name: name.trim(),
          description: description.trim() || undefined,
          payload: parsedPayload,
          effectiveFrom,
          changeSummary: changeSummary.trim() || undefined,
          sourceReference: sourceReference.trim() || undefined,
          status,
        };
        await createPlatformDefaultTemplate(createInput);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save template');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300">
                Stage C.0
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEditing
                  ? `Edit Draft Template • ${editingTemplate?.name}`
                  : 'Create Platform Default Provisioning Template'}
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isEditing
                ? 'Modify draft template structure. Changes take effect once published.'
                : 'Define a new versioned template baseline from which newly provisioned tenants are seeded.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Important Isolation Warning Banner */}
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="font-semibold block mb-0.5">
                Tenant Provisioning Isolation Policy:
              </strong>
              Changing this default template affects{' '}
              <strong className="underline decoration-amber-400">
                only tenants created afterwards
              </strong>
              , never existing tenants. Existing tenants retain their provisioned configuration independently.
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Template Category *
              </label>
              <select
                disabled={isEditing}
                value={category}
                onChange={(e) => setCategory(e.target.value as PlatformTemplateCategory)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 disabled:opacity-60"
              >
                <option value="document_types">Document Types</option>
                <option value="leave_policies">Leave Policies</option>
                <option value="notification_templates">Notification Templates</option>
                <option value="default_roles">Default Roles & Permissions</option>
                <option value="onboarding_checklists">Onboarding Checklists</option>
              </select>
            </div>

            {/* Jurisdiction */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Country Jurisdiction *
              </label>
              <select
                disabled={isEditing}
                value={countryId ?? 'global'}
                onChange={(e) =>
                  setCountryId(e.target.value === 'global' ? null : e.target.value)
                }
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 disabled:opacity-60"
              >
                <option value="global">🌐 Global Default (Cross-Jurisdiction)</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.isoCode})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Fair Work Australia Leave Baseline"
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            {/* Effective From */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Effective From Date *
              </label>
              <input
                type="date"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Statutory Description / Purpose
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Standard 4 weeks annual leave baseline per Fair Work NES"
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Change Summary */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Change Summary / Audit Note
              </label>
              <input
                type="text"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="e.g., Updated entitlement from 14 to 20 days"
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
              />
            </div>

            {/* Source Reference */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Source Reference (Legislation / Standard)
              </label>
              <input
                type="text"
                value={sourceReference}
                onChange={(e) => setSourceReference(e.target.value)}
                placeholder="e.g. Fair Work Act 2009 (Cth) Part 2-2"
                className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2"
              />
            </div>
          </div>

          {!isEditing && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Initial Status
              </label>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'draft'}
                    onChange={() => setStatus('draft')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Save as Draft (review before publishing)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    checked={status === 'published'}
                    onChange={() => setStatus('published')}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Publish Immediately
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* JSON Payload Editor */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                Template Payload (JSON) *
              </label>
              <button
                type="button"
                onClick={handleLoadSample}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                Load Sample Payload for {category.replace(/_/g, ' ')}
              </button>
            </div>

            <textarea
              required
              rows={10}
              value={rawPayload}
              onChange={(e) => {
                setRawPayload(e.target.value);
                setJsonError(null);
              }}
              placeholder="Paste or edit JSON structure..."
              className="w-full text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 text-slate-100 p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />

            {jsonError && (
              <p className="text-[11px] text-rose-500 font-mono mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {jsonError}
              </p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {isEditing ? 'Editing draft version' : 'Will create versioned template'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving Template...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {isEditing ? 'Save Changes' : status === 'published' ? 'Save & Publish' : 'Save Draft Version'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
