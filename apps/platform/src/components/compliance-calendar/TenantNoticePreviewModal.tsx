import { useEffect, useMemo, useState } from 'react';
import type {
  ComplianceEventTenantPreviewResponse,
  PreviewComplianceNoticeTenantsInput,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Info,
  Loader2,
  Mail,
  MapPin,
  Search,
  Shield,
  Users,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import {
  previewComplianceEventTenants,
  previewDraftComplianceEventTenants,
} from '@/lib/platform-countries-api';

interface TenantNoticePreviewModalProps {
  open: boolean;
  onClose: () => void;
  eventId?: string | null;
  countryId: string;
  draftInput?: PreviewComplianceNoticeTenantsInput | null;
  eventTitle?: string;
}

export function TenantNoticePreviewModal({
  open,
  onClose,
  eventId,
  countryId,
  draftInput,
  eventTitle,
}: TenantNoticePreviewModalProps) {
  const [preview, setPreview] = useState<ComplianceEventTenantPreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setError(null);
      setSearchQuery('');
      return;
    }

    const loadPreview = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (eventId) {
          const res = await previewComplianceEventTenants(eventId);
          setPreview(res);
        } else if (countryId && draftInput) {
          const res = await previewDraftComplianceEventTenants(countryId, draftInput);
          setPreview(res);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load tenant notification preview');
      } finally {
        setIsLoading(false);
      }
    };

    loadPreview();
  }, [open, eventId, countryId, draftInput]);

  const filteredTenants = useMemo(() => {
    if (!preview) return [];
    if (!searchQuery.trim()) return preview.tenants;
    const q = searchQuery.toLowerCase();
    return preview.tenants.filter(
      (t) =>
        t.tenantName.toLowerCase().includes(q) ||
        t.tenantSubdomain.toLowerCase().includes(q) ||
        t.companyName.toLowerCase().includes(q) ||
        (t.planId && t.planId.toLowerCase().includes(q)) ||
        t.recipientUsers.some((u) => u.email.toLowerCase().includes(q)),
    );
  }, [preview, searchQuery]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        preview
          ? `Notified Tenants Preview • ${preview.eventTitle}`
          : eventTitle
          ? `Notified Tenants Preview • ${eventTitle}`
          : 'Preview Notified Tenants'
      }
      size="xl"
    >
      <div className="space-y-4">
        {/* Subtitle description */}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Statutory compliance notices are dispatched automatically through the Notification Engine (Phase 1 Stage 9) to all matching tenant organizations in this jurisdiction.
        </p>

        {isLoading ? (
          <div className="py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
            <p className="text-xs text-slate-500 mt-2 font-medium">
              Resolving matching tenants and active staff...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30 p-4 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl p-3 bg-indigo-50/60 dark:bg-slate-800 border border-indigo-100 dark:border-slate-700">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Matching Tenants
                </span>
                <span className="text-xl font-black text-indigo-700 dark:text-indigo-300">
                  {preview.matchingTenantsCount}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Across {preview.matchingCompaniesCount} legal entities
                </span>
              </div>

              <div className="rounded-xl p-3 bg-purple-50/60 dark:bg-slate-800 border border-purple-100 dark:border-slate-700">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Employees Covered
                </span>
                <span className="text-xl font-black text-purple-700 dark:text-purple-300">
                  {preview.totalActiveEmployees}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Active staff headcount
                </span>
              </div>

              <div className="rounded-xl p-3 bg-emerald-50/60 dark:bg-slate-800 border border-emerald-100 dark:border-slate-700">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Next Statutory Due
                </span>
                <span className="text-sm font-mono font-black text-emerald-700 dark:text-emerald-300">
                  {preview.nextDueDate || 'Periodic'}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Authoritative deadline
                </span>
              </div>

              <div className="rounded-xl p-3 bg-amber-50/60 dark:bg-slate-800 border border-amber-100 dark:border-slate-700">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Notice Dispatch
                </span>
                <span className="text-sm font-mono font-black text-amber-700 dark:text-amber-300">
                  {preview.noticeDispatchDate || `${preview.noticeDaysBefore}d advance`}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {preview.noticeDaysBefore} days before deadline
                </span>
              </div>
            </div>

            {/* Filter / Search Bar */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter by tenant name, company, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="text-[11px] font-semibold text-slate-500">
                Showing {filteredTenants.length} of {preview.matchingCompaniesCount} entities
              </div>
            </div>

            {/* Tenants & Companies Table */}
            {filteredTenants.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center">
                <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No matching tenants found
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {searchQuery
                    ? 'No tenant matches your search query'
                    : 'No tenants in this jurisdiction match the specified filters'}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3">Tenant & Company</th>
                        <th className="py-2.5 px-3">Jurisdiction</th>
                        <th className="py-2.5 px-3">Plan</th>
                        <th className="py-2.5 px-3 text-center">Headcount</th>
                        <th className="py-2.5 px-3">Recipient Staff</th>
                        <th className="py-2.5 px-3 text-right">Notice Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredTenants.map((t, idx) => (
                        <tr
                          key={`${t.tenantId}-${t.companyId}-${idx}`}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-900 dark:text-white block">
                              {t.tenantName}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              {t.companyName} ({t.tenantSubdomain}.domain)
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {t.stateProvinceName || preview.countryName}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              {t.planId || 'Standard'}
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                              {t.activeEmployeesCount}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="space-y-0.5">
                              {t.recipientUsers.length > 0 ? (
                                t.recipientUsers.slice(0, 2).map((u) => (
                                  <div
                                    key={u.id}
                                    className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300"
                                  >
                                    <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate max-w-[150px]">{u.email}</span>
                                    {u.roleName && (
                                      <span className="text-[9px] text-slate-400 font-semibold">
                                        ({u.roleName})
                                      </span>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">
                                  Tenant Admin
                                </span>
                              )}
                              {t.recipientUsers.length > 2 && (
                                <span className="text-[10px] text-indigo-600 font-medium block">
                                  +{t.recipientUsers.length - 2} more recipients
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            {t.alreadyNotifiedForNextDue ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Notified</span>
                              </span>
                            ) : t.isNoticeWindowActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Window Open</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-500 font-mono">
                                In {t.daysUntilNotice}d
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : null}

        <div className="flex items-center justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </Modal>
  );
}
