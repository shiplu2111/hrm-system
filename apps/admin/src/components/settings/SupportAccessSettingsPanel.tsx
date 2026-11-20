import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Key,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';
import type { SupportAccessRequestRecord } from '@hrm/shared-types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import {
  approveSupportAccessRequest,
  getTenantSupportAccessSettings,
  rejectSupportAccessRequest,
  revokeSupportAccessSession,
  updateSupportAccessPreauthorization,
  type TenantSupportAccessData,
} from '@/lib/settings-api';

export function SupportAccessSettingsPanel() {
  const [data, setData] = useState<TenantSupportAccessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingPreauth, setUpdatingPreauth] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getTenantSupportAccessSettings();
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load support access settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleTogglePreauth = async () => {
    if (!data) return;
    const nextVal = !data.settings.preauthorizedSupportAccess;
    try {
      setUpdatingPreauth(true);
      setError(null);
      const updated = await updateSupportAccessPreauthorization(nextVal);
      setData((prev) =>
        prev
          ? {
              ...prev,
              settings: updated,
            }
          : prev,
      );
      setSuccessMessage(
        nextVal
          ? 'Pre-authorised support access enabled. Platform support engineers may now troubleshoot without waiting for manual email approval.'
          : 'Pre-authorised support access disabled. Every support access request will require manual Company Owner approval.',
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update pre-authorisation setting');
    } finally {
      setUpdatingPreauth(false);
    }
  };

  const handleApprove = async (requestId: string, mode: 'read_only' | 'read_write') => {
    try {
      setActionLoadingId(requestId);
      setError(null);
      const updated = await approveSupportAccessRequest(requestId, mode);
      setData((prev) =>
        prev
          ? {
              ...prev,
              requests: prev.requests.map((r) => (r.id === requestId ? updated : r)),
            }
          : prev,
      );
      setSuccessMessage(`Support access approved in ${mode} mode.`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve support access request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setActionLoadingId(requestId);
      setError(null);
      const updated = await rejectSupportAccessRequest(requestId, 'Rejected by workspace owner');
      setData((prev) =>
        prev
          ? {
              ...prev,
              requests: prev.requests.map((r) => (r.id === requestId ? updated : r)),
            }
          : prev,
      );
      setSuccessMessage('Support access request rejected.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevoke = async (requestId: string) => {
    try {
      setActionLoadingId(requestId);
      setError(null);
      const updated = await revokeSupportAccessSession(requestId, 'Revoked by workspace owner');
      setData((prev) =>
        prev
          ? {
              ...prev,
              requests: prev.requests.map((r) => (r.id === requestId ? updated : r)),
            }
          : prev,
      );
      setSuccessMessage('Active support session terminated immediately.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke session');
    } finally {
      setActionLoadingId(null);
    }
  };

  const renderStatusBadge = (status: SupportAccessRequestRecord['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
            <Clock className="h-3 w-3" />
            Pending Approval
          </span>
        );
      case 'revoked':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="h-3 w-3" />
            Revoked
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            Rejected
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-500 border border-slate-500/20">
            Expired
          </span>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Support Access Policy Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-accent-500" />
              <CardTitle>Platform Support Access & Troubleshooting Policy</CardTitle>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="text-secondary hover:text-primary text-xs flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Pre-authorisation Toggle */}
          <div className="surface border border-base rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-semibold text-primary text-sm flex items-center gap-2">
                <Key className="h-4 w-4 text-accent-500" />
                <span>Pre-authorise Platform Support Access</span>
                {data?.settings.preauthorizedSupportAccess && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                )}
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Allow verified platform support engineers to enter your workspace without waiting for manual owner email approval.
                All sessions are capped at <strong>4 hours</strong>, read-only by default, and dual-logged to your Audit Log with the engineer’s real name.
                Payroll finalization, payment batch execution, and full banking credentials remain strictly blocked.
              </p>
            </div>
            <Toggle
              checked={data?.settings.preauthorizedSupportAccess ?? false}
              onChange={() => void handleTogglePreauth()}
              disabled={loading || updatingPreauth}
            />
          </div>

          {/* Security Guarantee Banner */}
          <div className="p-3.5 rounded-xl bg-[rgb(var(--bg-muted))] border border-base text-xs text-secondary flex items-start gap-2.5">
            <Lock className="h-4 w-4 text-accent-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-primary font-medium">Tenant Privacy & Determinism Guarantee:</strong> Platform engineers cannot inspect or modify your workspace data without an approved, time-boxed token. Every API operation performed during support access is tagged with the engineer’s name in your <em>Audit Log</em>.
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Support Access Requests & Session History */}
      <Card>
        <CardHeader>
          <CardTitle>Support Access Requests & Session Audit</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted flex items-center justify-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Loading support access history...</span>
            </div>
          ) : !data?.requests || data.requests.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted space-y-1">
              <UserCheck className="h-6 w-6 mx-auto text-secondary/60 mb-2" />
              <p className="font-semibold text-secondary">No support access requests on record</p>
              <p>Platform support engineers have not requested access to your workspace.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[rgb(var(--bg-muted))] border-b border-base text-xs">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-semibold text-secondary">Engineer</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-secondary">Mode & Duration</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-secondary">Reason</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-secondary">Requested</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-secondary">Status</th>
                    <th className="text-right px-5 py-2.5 font-semibold text-secondary">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))] text-xs">
                  {data.requests.map((req) => (
                    <tr key={req.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-semibold text-primary">{req.staffName}</div>
                        <div className="text-[11px] text-muted">{req.staffEmail}</div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                              req.accessMode === 'read_write'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                            }`}
                          >
                            {req.accessMode === 'read_write' ? 'Read-Write' : 'Read-Only'}
                          </span>
                          <span className="text-muted font-mono">{req.durationMinutes}m</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-secondary max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>
                      <td className="px-5 py-3 text-muted font-mono whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-5 py-3">
                        {renderStatusBadge(req.status)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {req.status === 'pending' && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleApprove(req.id, 'read_only')}
                              disabled={actionLoadingId === req.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReject(req.id)}
                              disabled={actionLoadingId === req.id}
                              className="px-2 py-1 rounded-lg bg-[rgb(var(--bg-muted))] hover:bg-rose-500/20 text-secondary hover:text-rose-500 text-[11px] transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {req.status === 'approved' && req.expiresAt && new Date(req.expiresAt) > new Date() && (
                          <button
                            type="button"
                            onClick={() => void handleRevoke(req.id)}
                            disabled={actionLoadingId === req.id}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-medium text-[11px] transition-colors"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
