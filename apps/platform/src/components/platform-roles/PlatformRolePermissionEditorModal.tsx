import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckSquare,
  Lock,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import type {
  ActiveOwnerCheckResult,
  PlatformPermissionDefinition,
  PlatformRoleRecord,
} from '@hrm/shared-types';
import { createPlatformRole, updatePlatformRole } from '@/lib/platform-staff-api';

interface Props {
  isOpen: boolean;
  role: PlatformRoleRecord | null; // null for Create mode
  definitions: PlatformPermissionDefinition[];
  activeOwnerStatus: ActiveOwnerCheckResult | null;
  currentUserRoleName: string;
  onClose: () => void;
  onSaved: (role: PlatformRoleRecord) => void;
  onDeleteRequest?: (role: PlatformRoleRecord) => void;
}

const ALL_ACTIONS = ['view', 'create', 'edit', 'delete', 'manage', 'impersonate', 'raw_html'] as const;

function grantKey(module: string, action: string) {
  return `${module}:${action}`;
}

export function PlatformRolePermissionEditorModal({
  isOpen,
  role,
  definitions,
  activeOwnerStatus,
  currentUserRoleName,
  onClose,
  onSaved,
  onDeleteRequest,
}: Props) {
  const isCreate = !role;
  const isOwnerRole = role?.name === 'Platform Owner';
  const isSystemRole = Boolean(role?.isSystem);
  const isPlatformOwner = currentUserRoleName === 'Platform Owner';

  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [grants, setGrants] = useState<Set<string>>(new Set());
  const [baseline, setBaseline] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state on role change
  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description ?? '');
      const initial = new Set(role.permissions.map((p) => grantKey(p.module, p.action)));
      setGrants(initial);
      setBaseline(new Set(initial));
    } else {
      setName('');
      setDescription('');
      setGrants(new Set());
      setBaseline(new Set());
    }
    setError(null);
  }, [role, isOpen]);

  // Compute changes from baseline
  const changesCount = useMemo(() => {
    let count = 0;
    for (const g of grants) {
      if (!baseline.has(g)) count++;
    }
    for (const b of baseline) {
      if (!grants.has(b)) count++;
    }
    return count;
  }, [grants, baseline]);

  if (!isOpen) return null;

  // Toggle single grant
  const togglePermission = (module: string, action: string) => {
    const key = grantKey(module, action);
    setGrants((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Toggle row (module)
  const toggleRow = (def: PlatformPermissionDefinition) => {
    const rowKeys = def.actions.map((act) => grantKey(def.key, act));
    const allOn = rowKeys.every((k) => grants.has(k));
    setGrants((prev) => {
      const next = new Set(prev);
      if (allOn) {
        rowKeys.forEach((k) => next.delete(k));
      } else {
        rowKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  // Toggle column (action)
  const toggleColumn = (action: string) => {
    const colKeys = definitions
      .filter((def) => def.actions.includes(action))
      .map((def) => grantKey(def.key, action));
    const allOn = colKeys.every((k) => grants.has(k));
    setGrants((prev) => {
      const next = new Set(prev);
      if (allOn) {
        colKeys.forEach((k) => next.delete(k));
      } else {
        colKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  // Select all / Clear all
  const selectAll = () => {
    const all = new Set<string>();
    definitions.forEach((def) => {
      def.actions.forEach((act) => all.add(grantKey(def.key, act)));
    });
    setGrants(all);
  };

  const clearAll = () => {
    setGrants(new Set());
  };

  const resetToBaseline = () => {
    setGrants(new Set(baseline));
    setError(null);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Role name is required');
      return;
    }

    // Role Hierarchy & Last Active Owner Warning Check
    if (isOwnerRole) {
      const hasPlatformManage = grants.has('platform:manage');
      const hasUserManage = grants.has('user:manage');
      if (!hasPlatformManage || !hasUserManage) {
        setError(
          'Security Policy Violation: The Platform Owner role must retain root platform:manage and user:manage permissions to ensure active platform governance.',
        );
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    const permissionsArray = Array.from(grants).map((key) => {
      const [module, action] = key.split(':');
      return { module, action };
    });

    try {
      let saved: PlatformRoleRecord;
      if (isCreate) {
        saved = await createPlatformRole({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: permissionsArray,
        });
      } else {
        saved = await updatePlatformRole(role.id, {
          name: isSystemRole ? undefined : name.trim(),
          description: description.trim() || undefined,
          permissions: permissionsArray,
        });
      }

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save platform role');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              {isOwnerRole ? <Shield className="h-5 w-5 text-violet-600" /> : <CheckSquare className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {isCreate ? 'Create Custom Platform Role' : `Edit Platform Role: ${role.name}`}
                </h2>
                {role?.isSystem && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    System Protected
                  </span>
                )}
                {role && (
                  <span className="text-xs text-slate-400">({role.userCount} assigned staff)</span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Permission matrix structured by functional module and granted operations (ROLES_PERMISSIONS §3).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Platform Owner Apex Protection Warning */}
          {isOwnerRole && (
            <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/40 text-xs text-violet-900 dark:text-violet-200 flex items-start gap-3">
              <Shield className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm">Platform Owner Apex Role & Last Active Protection</div>
                <p className="leading-relaxed">
                  <strong>Platform Owner</strong> holds full governance authority across all platform subsystems. Modifying
                  this role impacts all current and future Platform Owners. Platform security strictly requires that
                  <strong className="underline"> platform:manage</strong> and <strong className="underline">user:manage</strong> are
                  never removed, ensuring the platform is never orphaned without an active Platform Owner.
                </p>
              </div>
            </div>
          )}

          {/* Active Owner Risk Warning */}
          {activeOwnerStatus?.isAtRisk && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Active Owner Count Alert: </span>
                Only 1 active Platform Owner account exists in the platform. Demoting or deactivating this operator is locked.
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {/* Role Metadata Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Role Name {isSystemRole && <span className="text-slate-400 font-normal">(System Locked)</span>} *
              </label>
              <input
                type="text"
                required
                disabled={isSystemRole}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Operations Specialist"
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:border-indigo-500 font-semibold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Role Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope of responsibilities and operator expectations"
                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Permission Matrix Header Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Permission Matrix</h3>
              <p className="text-xs text-slate-500">
                {grants.size} permissions granted across {definitions.length} platform functional modules
                {changesCount > 0 && (
                  <span className="ml-2 font-bold text-amber-600 dark:text-amber-400">
                    ({changesCount} changes pending save)
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-[11px] font-semibold"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 text-[11px] font-semibold"
              >
                Clear All
              </button>
              {changesCount > 0 && (
                <button
                  type="button"
                  onClick={resetToBaseline}
                  className="px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-[11px] font-bold flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Matrix Editor Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px]">
                <thead className="bg-slate-100/70 dark:bg-slate-800/60 text-[11px] font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 min-w-[200px]">Module</th>
                    {ALL_ACTIONS.map((action) => (
                      <th key={action} className="px-3 py-3 text-center min-w-[80px]">
                        <div className="capitalize">{action}</div>
                        <button
                          type="button"
                          onClick={() => toggleColumn(action)}
                          className="mt-0.5 text-[9px] font-normal text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 underline"
                          title={`Toggle ${action} for all applicable modules`}
                        >
                          Toggle
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right min-w-[80px]">Row</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {definitions.map((def) => {
                    const rowKeys = def.actions.map((act) => grantKey(def.key, act));
                    const allRowChecked = rowKeys.every((k) => grants.has(k));
                    const someRowChecked = rowKeys.some((k) => grants.has(k));

                    return (
                      <tr key={def.key} className="hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors">
                        {/* Module Column */}
                        <td className="px-4 py-3 align-top">
                          <div className="font-bold text-slate-900 dark:text-white">{def.label}</div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">{def.key}</div>
                          <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">{def.description}</div>
                        </td>

                        {/* Action Checkboxes */}
                        {ALL_ACTIONS.map((action) => {
                          const isSupported = def.actions.includes(action);
                          const key = grantKey(def.key, action);
                          const isChecked = grants.has(key);
                          const differsFromBaseline = isChecked !== baseline.has(key);

                          if (!isSupported) {
                            return (
                              <td key={action} className="px-3 py-3 text-center align-middle text-slate-300 dark:text-slate-700">
                                —
                              </td>
                            );
                          }

                          return (
                            <td
                              key={action}
                              className={`px-3 py-3 text-center align-middle ${
                                differsFromBaseline ? 'bg-amber-50/50 dark:bg-amber-950/20' : ''
                              }`}
                            >
                              <label className="inline-flex items-center justify-center cursor-pointer p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => togglePermission(def.key, action)}
                                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </label>
                            </td>
                          );
                        })}

                        {/* Row Quick Action */}
                        <td className="px-3 py-3 text-right align-middle">
                          <button
                            type="button"
                            onClick={() => toggleRow(def)}
                            className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 p-1 rounded"
                            title="Toggle all actions for this module"
                          >
                            {allRowChecked ? 'Clear' : 'All'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center justify-between">
            <div>
              * Note: Permissions marked <span className="text-violet-600 font-bold">manage</span> grant full control over the
              module including deletion and admin overrides.
            </div>
            {role && !isSystemRole && onDeleteRequest && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDeleteRequest(role);
                }}
                className="text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Role</span>
              </button>
            )}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-950/50">
          <div className="text-xs text-slate-500">
            {changesCount > 0 ? (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {changesCount} permission change(s) unsaved
              </span>
            ) : (
              <span>No unsaved changes</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-40 flex items-center gap-2 shadow-sm transition-all"
            >
              {submitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
              <span>{isCreate ? 'Create Role' : 'Save Role Permissions'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
