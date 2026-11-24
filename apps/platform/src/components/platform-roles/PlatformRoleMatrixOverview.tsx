import { useMemo, useState } from 'react';
import {
  Download,
  Edit3,
  Filter,
  Plus,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type {
  ActiveOwnerCheckResult,
  PlatformPermissionDefinition,
  PlatformRoleRecord,
} from '@hrm/shared-types';

interface Props {
  roles: PlatformRoleRecord[];
  definitions: PlatformPermissionDefinition[];
  activeOwnerStatus: ActiveOwnerCheckResult | null;
  onSelectRole: (role: PlatformRoleRecord) => void;
  onCreateRole: () => void;
}

const ACTION_COLORS: Record<string, string> = {
  view: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  create: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  edit: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  delete: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-bold',
  manage: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 border-violet-200 dark:border-violet-800 font-bold',
  impersonate: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-bold',
};

export function PlatformRoleMatrixOverview({
  roles,
  definitions,
  activeOwnerStatus,
  onSelectRole,
  onCreateRole,
}: Props) {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'system' | 'custom'>('all');

  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      const matchesSearch =
        !search.trim() ||
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(search.toLowerCase()));
      const matchesType =
        filterType === 'all' ||
        (filterType === 'system' && r.isSystem) ||
        (filterType === 'custom' && !r.isSystem);
      return matchesSearch && matchesType;
    });
  }, [roles, search, filterType]);

  const exportCsv = () => {
    const headers = ['Platform Role', 'Role Type', 'Assigned Users', ...definitions.map((d) => d.label)];
    const rows = roles.map((role) => {
      const moduleGrants = definitions.map((def) => {
        const actions = role.permissions
          .filter((p) => p.module === def.key)
          .map((p) => p.action);
        return actions.length > 0 ? actions.join('; ') : 'None';
      });
      return [
        `"${role.name.replace(/"/g, '""')}"`,
        role.isSystem ? 'System' : 'Custom',
        role.userCount,
        ...moduleGrants.map((g) => `"${g}"`),
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform-role-permission-matrix-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Active Owner Risk Warning Banner */}
      {activeOwnerStatus?.isAtRisk && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3 shadow-sm animate-in fade-in">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-sm">
              Governance Risk: Single Active Platform Owner ({activeOwnerStatus.activeOwnerCount} active)
            </div>
            <p className="leading-relaxed">
              The platform currently has only 1 active Platform Owner account. Demoting or deactivating this operator is
              strictly locked to guarantee that the platform is never left with zero active Platform Owners.
            </p>
          </div>
        </div>
      )}

      {/* Control Bar: Search, Filters, CSV Export, Create Role */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[220px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter roles by name..."
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(['all', 'system', 'custom'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setFilterType(t)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                  filterType === t
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={onCreateRole}
            className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Create Role</span>
          </button>
        </div>
      </div>

      {/* Cross-Tab Permission Matrix Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>
            Comparing {filteredRoles.length} platform roles across {definitions.length} core functional modules
          </span>
          <span className="text-[11px] font-medium text-slate-400">
            Click any role to edit its permission matrix
          </span>
        </div>

        <div className="overflow-x-auto max-h-[72vh]">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-950/90 backdrop-blur-sm text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-950 px-5 py-3.5 min-w-[240px] border-r border-slate-200 dark:border-slate-800">
                  Platform Role
                </th>
                {definitions.map((def) => (
                  <th key={def.key} className="px-4 py-3.5 whitespace-nowrap min-w-[140px]">
                    <div className="font-bold text-slate-700 dark:text-slate-300">{def.label}</div>
                    <div className="text-[9px] text-slate-400 normal-case font-normal truncate max-w-[130px]">
                      {def.key}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredRoles.map((role) => (
                <tr
                  key={role.id}
                  onClick={() => onSelectRole(role)}
                  className="group hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 cursor-pointer transition-colors"
                >
                  {/* Sticky Role Column */}
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-indigo-50/40 dark:bg-slate-900 dark:group-hover:bg-slate-850 px-5 py-3.5 border-r border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {role.name === 'Platform Owner' && <Shield className="h-3.5 w-3.5 text-violet-600" />}
                          <span>{role.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                          {role.description || 'No description'}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px]">
                          <span
                            className={`px-1.5 py-0.5 rounded font-semibold ${
                              role.isSystem
                                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                            }`}
                          >
                            {role.isSystem ? 'System' : 'Custom'}
                          </span>
                          <span className="text-slate-400 flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{role.userCount} assigned</span>
                          </span>
                        </div>
                      </div>
                      <Edit3 className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  </td>

                  {/* Module Permission Cells */}
                  {definitions.map((def) => {
                    const grants = role.permissions
                      .filter((p) => p.module === def.key)
                      .map((p) => p.action);

                    return (
                      <td key={def.key} className="px-4 py-3.5 align-top">
                        {grants.length === 0 ? (
                          <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {grants.map((act) => (
                              <span
                                key={act}
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] border ${
                                  ACTION_COLORS[act] ||
                                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {act}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
