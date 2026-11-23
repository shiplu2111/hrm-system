import React, { useState } from 'react';
import {
  AlertCircle,
  Bell,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  FileCheck,
  FileText,
  Key,
  Layers,
  Lock,
  Mail,
  Shield,
  Smartphone,
  Sparkles,
  Tag,
  UserCheck,
  Users,
} from 'lucide-react';
import type {
  DefaultDocumentTypeItem,
  DefaultLeavePolicyItem,
  DefaultNotificationTemplateItem,
  DefaultOnboardingChecklistTemplate,
  DefaultRoleItem,
  PlatformTemplateCategory,
} from '@hrm/shared-types';

interface TemplatePayloadViewerProps {
  category: PlatformTemplateCategory;
  payload: any;
  showRawToggle?: boolean;
}

export function TemplatePayloadViewer({
  category,
  payload,
  showRawToggle = true,
}: TemplatePayloadViewerProps) {
  const [showRaw, setShowRaw] = useState(false);

  if (!payload) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 italic">
        No template payload defined.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showRawToggle && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="text-[11px] font-mono text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            {showRaw ? 'Show Formatted View' : 'View Raw JSON'}
          </button>
        </div>
      )}

      {showRaw ? (
        <div className="rounded-xl bg-slate-900 text-slate-100 p-4 font-mono text-xs overflow-x-auto max-h-96 border border-slate-800">
          <pre>{JSON.stringify(payload, null, 2)}</pre>
        </div>
      ) : (
        <>
          {category === 'document_types' && (
            <DocumentTypesViewer items={Array.isArray(payload) ? payload : []} />
          )}

          {category === 'leave_policies' && (
            <LeavePoliciesViewer items={Array.isArray(payload) ? payload : []} />
          )}

          {category === 'notification_templates' && (
            <NotificationTemplatesViewer items={Array.isArray(payload) ? payload : []} />
          )}

          {category === 'default_roles' && (
            <RolesPermissionsViewer items={Array.isArray(payload) ? payload : []} />
          )}

          {category === 'onboarding_checklists' && (
            <OnboardingChecklistViewer checklist={payload} />
          )}
        </>
      )}
    </div>
  );
}

// 1. Document Types Viewer
function DocumentTypesViewer({ items }: { items: DefaultDocumentTypeItem[] }) {
  if (!items || items.length === 0) {
    return <div className="text-xs text-slate-400 italic">No document types in template.</div>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
          <tr>
            <th className="py-2.5 px-3.5">Document Type</th>
            <th className="py-2.5 px-3">Scope</th>
            <th className="py-2.5 px-3">Verification</th>
            <th className="py-2.5 px-3">Expiry Tracking</th>
            <th className="py-2.5 px-3">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((doc, idx) => (
            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
              <td className="py-2.5 px-3.5 font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                {doc.name}
              </td>
              <td className="py-2.5 px-3">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {doc.scope ?? 'employee'}
                </span>
              </td>
              <td className="py-2.5 px-3">
                {doc.requiresVerification ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mandatory
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">Optional</span>
                )}
              </td>
              <td className="py-2.5 px-3">
                {doc.tracksExpiry ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                    Expiry Tracked
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400">No Expiry</span>
                )}
              </td>
              <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                {doc.description || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 2. Leave Policies Viewer
function LeavePoliciesViewer({ items }: { items: DefaultLeavePolicyItem[] }) {
  if (!items || items.length === 0) {
    return <div className="text-xs text-slate-400 italic">No leave policies in template.</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((lt, idx) => (
        <div
          key={idx}
          className="rounded-xl p-3.5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-500" />
                {lt.name}
              </div>
              <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase">
                {lt.code}
              </span>
            </div>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                lt.isPaid
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/60'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {lt.isPaid ? 'Paid Leave' : 'Unpaid'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 block">Baseline Days</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                {lt.entitlementDays} days
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Accrual Cycle</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize">
                {lt.accrualType ?? 'yearly'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Carry Forward</span>
              <span className="text-slate-600 dark:text-slate-400">
                {lt.carryForwardMax !== undefined && lt.carryForwardMax !== null
                  ? `Max ${lt.carryForwardMax}d`
                  : 'Unlimited'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Encashment</span>
              <span className="text-slate-600 dark:text-slate-400">
                {lt.encashmentAllowed ? 'Allowed' : 'Not Allowed'}
              </span>
            </div>
          </div>

          {lt.approvalSteps && lt.approvalSteps.length > 0 && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1">
              <span className="font-medium text-slate-400">Approvals:</span>
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {lt.approvalSteps.map((s) => s.roleName).join(' → ')}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 3. Notification Templates Viewer
function NotificationTemplatesViewer({
  items,
}: {
  items: DefaultNotificationTemplateItem[];
}) {
  if (!items || items.length === 0) {
    return <div className="text-xs text-slate-400 italic">No notification templates.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((notif, idx) => (
        <div
          key={idx}
          className="rounded-xl p-3.5 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 border border-amber-200/50">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 dark:text-white text-xs block">
                  {notif.title || notif.key}
                </span>
                <span className="font-mono text-[10px] text-slate-400">{notif.key}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {(notif.channels || ['in_app']).map((ch, cIdx) => (
                <span
                  key={cIdx}
                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/50 flex items-center gap-1"
                >
                  {ch === 'email' ? (
                    <Mail className="w-3 h-3" />
                  ) : ch === 'push' || ch === 'sms' ? (
                    <Smartphone className="w-3 h-3" />
                  ) : (
                    <Bell className="w-3 h-3" />
                  )}
                  {ch}
                </span>
              ))}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-700 dark:text-slate-300 space-y-1 border border-slate-100 dark:border-slate-800">
            <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
              <span className="text-slate-400 text-[10px] font-normal uppercase">Subject:</span>
              {notif.subject}
            </div>
            <div className="text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
              {notif.body}
            </div>
          </div>

          {notif.variables && notif.variables.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-slate-400 font-medium">Variables:</span>
              {notif.variables.map((v, vIdx) => (
                <span
                  key={vIdx}
                  className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-400"
                >
                  {'{{' + v + '}}'}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 4. Default Roles & Permissions Viewer
function RolesPermissionsViewer({ items }: { items: DefaultRoleItem[] }) {
  const [expandedRole, setExpandedRole] = useState<string | null>(items[0]?.name ?? null);

  if (!items || items.length === 0) {
    return <div className="text-xs text-slate-400 italic">No role definitions in template.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((role, idx) => {
        const isExpanded = expandedRole === role.name;
        return (
          <div
            key={idx}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setExpandedRole(isExpanded ? null : role.name)}
              className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 border border-indigo-200/50">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {role.name}
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Scope: {role.dataScope}
                    </span>
                  </div>
                  {role.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {role.description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">
                  {role.permissions ? `${role.permissions.length} modules` : 'All modules'}
                </span>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                )}
              </div>
            </button>

            {isExpanded && (
              <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
                  Role Permission Matrix
                </span>
                {role.permissions && role.permissions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {role.permissions.map((p, pIdx) => (
                      <div
                        key={pIdx}
                        className="p-2 rounded-lg bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs space-y-1"
                      >
                        <span className="font-bold text-slate-800 dark:text-slate-200 capitalize block">
                          {p.module}
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {p.actions.map((act, aIdx) => (
                            <span
                              key={aIdx}
                              className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/50"
                            >
                              {act}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">
                    Full super-user permissions across all tenant modules.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 5. Onboarding Checklist Viewer
function OnboardingChecklistViewer({
  checklist,
}: {
  checklist: DefaultOnboardingChecklistTemplate;
}) {
  const items = checklist?.items ?? (Array.isArray(checklist) ? checklist : []);

  return (
    <div className="space-y-3">
      {checklist?.name && (
        <div className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
          <h4 className="text-sm font-bold text-indigo-950 dark:text-indigo-200">
            {checklist.name}
          </h4>
          {checklist.description && (
            <p className="text-xs text-indigo-800/80 dark:text-indigo-300/80 mt-0.5">
              {checklist.description}
            </p>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="py-2.5 px-3 w-12 text-center">Step</th>
              <th className="py-2.5 px-3">Task Title & Details</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Task Type</th>
              <th className="py-2.5 px-3">Assignee</th>
              <th className="py-2.5 px-3">Due Target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-400">
                  {idx + 1}
                </td>
                <td className="py-2.5 px-3">
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {item.title}
                  </div>
                  {item.description && (
                    <div className="text-[11px] text-slate-400 leading-snug mt-0.5 max-w-sm">
                      {item.description}
                    </div>
                  )}
                  {item.documentTypeName && (
                    <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5 flex items-center gap-1">
                      <FileCheck className="w-3 h-3" />
                      Links to Doc Type: {item.documentTypeName}
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 capitalize">
                    {item.category?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 capitalize">
                    {item.taskType?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="py-2.5 px-3 font-medium text-slate-700 dark:text-slate-300">
                  {item.assigneeLabel ?? 'Employee'}
                </td>
                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  {item.dueDaysOffset !== undefined
                    ? item.dueDaysOffset === 0
                      ? 'Day 1 (Hire date)'
                      : item.dueDaysOffset > 0
                        ? `Day +${item.dueDaysOffset}`
                        : `Day ${item.dueDaysOffset} (Pre-boarding)`
                    : 'Day 1'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
