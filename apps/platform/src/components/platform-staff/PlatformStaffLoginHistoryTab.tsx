import { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  Globe,
  KeyRound,
  Lock,
  Monitor,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import type { PlatformStaffLoginHistoryView } from '@hrm/shared-types';

interface Props {
  logins: PlatformStaffLoginHistoryView[];
  loading: boolean;
  onRefresh: () => void;
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
      second: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function PlatformStaffLoginHistoryTab({ logins, loading, onRefresh }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [twoFactorFilter, setTwoFactorFilter] = useState<string>('All');
  const [unusualOnly, setUnusualOnly] = useState(false);

  const stats = useMemo(() => {
    const total = logins.length;
    const successes = logins.filter((l) => l.status === 'success').length;
    const failures = logins.filter((l) => l.status !== 'success').length;
    const unusual = logins.filter((l) => l.isUnusualLocation).length;
    const twoFactorVerified = logins.filter((l) => l.twoFactorResult === 'verified').length;

    return { total, successes, failures, unusual, twoFactorVerified };
  }, [logins]);

  const filteredLogins = useMemo(() => {
    return logins.filter((item) => {
      if (statusFilter !== 'All' && item.status !== statusFilter) return false;
      if (twoFactorFilter !== 'All' && item.twoFactorResult !== twoFactorFilter) return false;
      if (unusualOnly && !item.isUnusualLocation) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesStaff =
          item.email.toLowerCase().includes(q) ||
          (item.userName && item.userName.toLowerCase().includes(q)) ||
          (item.userRoleName && item.userRoleName.toLowerCase().includes(q));
        const matchesNetwork =
          (item.ipAddress && item.ipAddress.toLowerCase().includes(q)) ||
          item.location.toLowerCase().includes(q) ||
          item.device.toLowerCase().includes(q);
        return matchesStaff || matchesNetwork;
      }

      return true;
    });
  }, [logins, search, statusFilter, twoFactorFilter, unusualOnly]);

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
              <Clock className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Total Logins
            </span>
          </div>
          <div className="text-2xl font-extrabold mt-3 text-slate-900 dark:text-white">
            {stats.total}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            Recorded Login Events
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              MFA Passed
            </span>
          </div>
          <div className="text-2xl font-extrabold mt-3 text-emerald-600 dark:text-emerald-400">
            {stats.twoFactorVerified}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            2FA Verified Successfully
          </div>
        </div>

        <div
          onClick={() => setUnusualOnly((prev) => !prev)}
          className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition-all ${
            stats.unusual > 0
              ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 hover:border-amber-400'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
            </div>
            {stats.unusual > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-600 text-white animate-pulse">
                Action Alert
              </span>
            )}
          </div>
          <div className="text-2xl font-extrabold mt-3 text-amber-600 dark:text-amber-400">
            {stats.unusual}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
            <span>Flagged Unusual Locations</span>
            {unusualOnly && <span className="font-bold text-amber-600">(Active)</span>}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="h-9 w-9 rounded-xl flex items-center justify-center bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold mt-3 text-rose-600 dark:text-rose-400">
            {stats.failures}
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
            Failed / Blocked Attempts
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logins by email, name, IP address, device, location..."
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed Credentials</option>
              <option value="2fa_failed">2FA Verification Failed</option>
              <option value="2fa_challenge">2FA Challenge Issued</option>
              <option value="locked">Account Locked</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setUnusualOnly((prev) => !prev)}
              className={`flex-1 h-10 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                unusualOnly
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Unusual ({stats.unusual})</span>
            </button>

            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Login History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
          <span>
            Showing {filteredLogins.length} login attempts
          </span>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="inline-block w-2 h-2 rounded-full bg-indigo-500"></span>
            <span>Historical authentication audit telemetry</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[1000px]">
            <thead className="bg-slate-50 dark:bg-slate-950/50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-4 py-3.5">Staff Operator</th>
                <th className="px-4 py-3.5">Auth Status</th>
                <th className="px-4 py-3.5">2FA Result</th>
                <th className="px-4 py-3.5">Device & Browser</th>
                <th className="px-4 py-3.5">IP & Geolocation</th>
                <th className="px-5 py-3.5">Location Anomaly</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading platform login history...
                  </td>
                </tr>
              ) : filteredLogins.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    No login events found matching the active filters.
                  </td>
                </tr>
              ) : (
                filteredLogins.map((entry) => {
                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Timestamp */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {formatDate(entry.createdAt)}
                        </div>
                      </td>

                      {/* Staff Operator */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {entry.userName || 'Anonymous / Unregistered'}
                        </div>
                        <div className="text-[11px] text-slate-500">{entry.email}</div>
                        {entry.userRoleName && (
                          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                            {entry.userRoleName}
                          </div>
                        )}
                      </td>

                      {/* Auth Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {entry.status === 'success' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <Check className="h-3.5 w-3.5" />
                            Success
                          </span>
                        )}
                        {entry.status === 'failed' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300" title={entry.failureReason || 'Failed'}>
                            <XCircle className="h-3.5 w-3.5" />
                            Failed
                          </span>
                        )}
                        {entry.status === '2fa_failed' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300" title={entry.failureReason || 'Invalid 2FA code'}>
                            <ShieldAlert className="h-3.5 w-3.5" />
                            2FA Failed
                          </span>
                        )}
                        {entry.status === '2fa_challenge' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                            <KeyRound className="h-3.5 w-3.5" />
                            2FA Challenge
                          </span>
                        )}
                        {entry.status === 'locked' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
                            <Lock className="h-3.5 w-3.5" />
                            Locked
                          </span>
                        )}
                        {entry.failureReason && entry.status !== 'success' && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-xs">
                            {entry.failureReason}
                          </div>
                        )}
                      </td>

                      {/* 2FA Result */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {entry.twoFactorResult === 'verified' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Verified (TOTP)</span>
                          </span>
                        )}
                        {entry.twoFactorResult === 'failed' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                            <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                            <span>Invalid 2FA Code</span>
                          </span>
                        )}
                        {entry.twoFactorResult === 'challenge_issued' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300">
                            <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                            <span>Prompted</span>
                          </span>
                        )}
                        {entry.twoFactorResult === 'setup_required' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300">
                            <Shield className="h-3.5 w-3.5 text-blue-600" />
                            <span>Setup Required</span>
                          </span>
                        )}
                        {entry.twoFactorResult === 'not_applicable' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800">
                            N/A
                          </span>
                        )}
                      </td>

                      {/* Device & Client */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-slate-400 shrink-0" />
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {entry.browser} on {entry.os}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-xs" title={entry.device}>
                              {entry.device}
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
                              {entry.location}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {entry.ipAddress || 'Unknown IP'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Location Anomaly Flag */}
                      <td className="px-5 py-3.5">
                        {entry.isUnusualLocation ? (
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                              <span>Unusual Location</span>
                            </div>
                            {entry.unusualLocationReason && (
                              <div className="text-[10px] text-amber-700 dark:text-amber-300/80 leading-tight max-w-xs">
                                {entry.unusualLocationReason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Standard</span>
                          </div>
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
    </div>
  );
}
