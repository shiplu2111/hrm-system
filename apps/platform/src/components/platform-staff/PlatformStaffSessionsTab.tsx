import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Globe,
  Laptop,
  Monitor,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  Smartphone,
  Trash2,
  UserX,
  Users,
  XCircle,
} from 'lucide-react';
import type { PlatformStaffSessionView } from '@hrm/shared-types';
import { PlatformRevokeSessionModal } from './PlatformRevokeSessionModal';

interface Props {
  sessions: PlatformStaffSessionView[];
  loading: boolean;
  onRefresh: () => void;
  currentUserRoleName: string;
  currentUserId?: string;
  onRevokeSession: (sessionId: string) => void;
  onRevokeAllUserSessions?: (userId: string) => void;
}

function formatDate(isoString: string) {
  try {
    const d = new Date(isoString);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function PlatformStaffSessionsTab({
  sessions,
  loading,
  onRefresh,
  currentUserRoleName,
  currentUserId,
  onRevokeSession,
}: Props) {
  const isPlatformOwner = currentUserRoleName === 'Platform Owner';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'revoked'>('active');
  const [unusualOnly, setUnusualOnly] = useState(false);
  const [selectedSessionForRevoke, setSelectedSessionForRevoke] = useState<PlatformStaffSessionView | null>(null);

  const stats = useMemo(() => {
    const active = sessions.filter((s) => !s.isRevoked && new Date(s.expiresAt) > new Date());
    const revoked = sessions.filter((s) => s.isRevoked);
    const unusual = active.filter((s) => s.isUnusualLocation);
    const distinctUsers = new Set(active.map((s) => s.userId)).size;

    return {
      activeCount: active.length,
      revokedCount: revoked.length,
      unusualCount: unusual.length,
      distinctUsers,
    };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const isSessionActive = !s.isRevoked && new Date(s.expiresAt) > new Date();

      if (statusFilter === 'active' && !isSessionActive) return false;
      if (statusFilter === 'revoked' && !s.isRevoked) return false;
      if (unusualOnly && !s.isUnusualLocation) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesUser =
          s.userName.toLowerCase().includes(q) ||
          s.userEmail.toLowerCase().includes(q) ||
          s.userRoleName.toLowerCase().includes(q);
        const matchesNetwork =
          (s.ipAddress && s.ipAddress.toLowerCase().includes(q)) ||
          s.location.toLowerCase().includes(q) ||
          s.device.toLowerCase().includes(q);
        return matchesUser || matchesNetwork;
      }

      return true;
    });
  }, [sessions, search, statusFilter, unusualOnly]);

  return (
    <div className="space-y-4">
      {/* Top Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Laptop className="h-4 w-4" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Live Active
            </span>
          </div>
          <div className="text-2xl font-extrabold mt-3 text-slate-900 dark:text-white">
            {stats.activeCount}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            Active Staff Sessions
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold mt-3 text-indigo-600 dark:text-indigo-400">
            {stats.distinctUsers}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            Distinct Operators Online
          </div>
        </div>

        <div
          onClick={() => setUnusualOnly((prev) => !prev)}
          className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition-all ${
            stats.unusualCount > 0
              ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 hover:border-amber-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
            </div>
            {stats.unusualCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-600 text-white animate-pulse">
                Anomaly Flagged
              </span>
            )}
          </div>
          <div className="text-2xl font-extrabold mt-3 text-amber-600 dark:text-amber-400">
            {stats.unusualCount}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
            <span>Unusual Location Sessions</span>
            {unusualOnly && <span className="font-bold text-amber-600">(Filtered)</span>}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <UserX className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold mt-3 text-slate-700 dark:text-slate-300">
            {stats.revokedCount}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            Revoked / Inactive Sessions
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter sessions by staff name, email, IP address, device, location..."
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status pills */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'active'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Active Only
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All Sessions
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('revoked')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'revoked'
                    ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Revoked
              </button>
            </div>

            {/* Unusual Locations Toggle */}
            <button
              type="button"
              onClick={() => setUnusualOnly((prev) => !prev)}
              className={`h-10 px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                unusualOnly
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Unusual Locations ({stats.unusualCount})</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
          <span>
            Displaying {filteredSessions.length} staff sessions
          </span>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Platform Auth Guard enforces immediate revocation on future requests</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[960px]">
            <thead className="bg-slate-50 dark:bg-slate-950/50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Staff Operator</th>
                <th className="px-4 py-3.5">Device & Browser</th>
                <th className="px-4 py-3.5">IP & Geolocation</th>
                <th className="px-4 py-3.5">Location Safety</th>
                <th className="px-4 py-3.5">Created / Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading staff sessions...
                  </td>
                </tr>
              ) : filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    No staff sessions found matching the active filters.
                  </td>
                </tr>
              ) : (
                filteredSessions.map((sess) => {
                  const isCurrent = sess.isCurrent || currentUserId === sess.userId;
                  const isTargetOwner = sess.userRoleName === 'Platform Owner';
                  const canRevoke = !sess.isRevoked && (isPlatformOwner || !isTargetOwner);

                  return (
                    <tr
                      key={sess.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Operator Info */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span>{sess.userName}</span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                              Your Session
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">{sess.userEmail}</div>
                        <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
                          {sess.userRoleName}
                        </div>
                      </td>

                      {/* Device & Client */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-slate-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {sess.browser} on {sess.os}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-xs" title={sess.device}>
                              {sess.device}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* IP & Geolocation */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-indigo-500 shrink-0" />
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {sess.location}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {sess.ipAddress || 'Unknown IP'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Location Safety Assessment */}
                      <td className="px-4 py-3.5">
                        {sess.isUnusualLocation ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            <span title={sess.unusualLocationReason || 'Unusual location detected'}>
                              Unusual Location
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Verified Baseline</span>
                          </div>
                        )}
                        {sess.isUnusualLocation && sess.unusualLocationReason && (
                          <div className="text-[10px] text-amber-700 dark:text-amber-300/80 mt-1 max-w-xs leading-tight">
                            {sess.unusualLocationReason}
                          </div>
                        )}
                      </td>

                      {/* Timestamps & Status */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {sess.isRevoked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                              <XCircle className="h-3 w-3" /> Revoked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Started: {formatDate(sess.createdAt)}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        {sess.isRevoked ? (
                          <span className="text-[11px] text-slate-400 italic">Revoked</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedSessionForRevoke(sess)}
                            disabled={!canRevoke}
                            title={
                              !canRevoke
                                ? 'Only a Platform Owner can revoke another Platform Owner session'
                                : 'Revoke this session immediately'
                            }
                            className="h-8 px-3 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            Revoke Session
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revoke Confirmation Modal */}
      <PlatformRevokeSessionModal
        session={selectedSessionForRevoke}
        onClose={() => setSelectedSessionForRevoke(null)}
        onRevoked={(id) => {
          onRevokeSession(id);
          setSelectedSessionForRevoke(null);
        }}
      />
    </div>
  );
}
