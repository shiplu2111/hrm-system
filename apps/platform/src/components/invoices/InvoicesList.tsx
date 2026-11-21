import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type {
  InvoiceStatus,
  PlatformInvoiceDetailView,
  PlatformInvoiceListItem,
} from '@hrm/shared-types';
import {
  downloadInvoicePdf,
  getPlatformInvoice,
  listPlatformInvoices,
} from '@/lib/invoices-api';
import { InvoiceDetailModal } from './InvoiceDetailModal';

const statusBadges: Record<string, string> = {
  paid: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  open: 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  past_due: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  draft: 'border-slate-500/30 bg-slate-500/10 text-slate-500',
  uncollectible: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
  void: 'border-slate-500/30 bg-slate-500/10 text-slate-400 line-through',
};

export function InvoicesList() {
  const [invoices, setInvoices] = useState<PlatformInvoiceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  // Selected Detail Modal
  const [selectedInvoice, setSelectedInvoice] =
    useState<PlatformInvoiceDetailView | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPlatformInvoices({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search.trim() || undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        minAmount: minAmount ? parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? parseFloat(maxAmount) : undefined,
      });
      setInvoices(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [statusFilter, fromDate, toDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchInvoices();
  };

  const handleResetFilters = () => {
    setStatusFilter('all');
    setSearch('');
    setFromDate('');
    setToDate('');
    setMinAmount('');
    setMaxAmount('');
    setTimeout(fetchInvoices, 0);
  };

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await getPlatformInvoice(id);
      setSelectedInvoice(detail);
    } catch (err: any) {
      alert(`Could not load invoice detail: ${err.message}`);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownloadPdf = async (e: React.MouseEvent, inv: PlatformInvoiceListItem) => {
    e.stopPropagation();
    setDownloadingId(inv.id);
    try {
      await downloadInvoicePdf(inv.id, inv.invoiceNumber);
    } catch (err: any) {
      alert(`PDF download failed: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  // Metrics calculations
  const metrics = useMemo(() => {
    const totalInvoiced = invoices.reduce((s, i) => s + Number(i.total), 0);
    const totalCollected = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
    const totalDue = invoices.reduce((s, i) => s + Number(i.amountDue), 0);
    const pastDueCount = invoices.filter((i) => i.status === 'past_due').length;
    return { totalInvoiced, totalCollected, totalDue, pastDueCount };
  }, [invoices]);

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-indigo-500" /> Total Invoiced
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            ${metrics.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">{invoices.length} invoices generated</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Settled / Collected
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            ${metrics.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Automated + manual wires</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-amber-500" /> Balance Outstanding
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            ${metrics.totalDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Pending collection</p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-rose-500" /> Past Due Invoices
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {metrics.pastDueCount}{' '}
            <span className="text-xs font-semibold text-slate-400">invoices</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Subject to dunning cycle</p>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto pb-1">
          {(['all', 'open', 'paid', 'past_due', 'draft', 'uncollectible', 'void'] as const).map(
            (status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs font-bold rounded-lg border transition ${
                  statusFilter === status
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {status === 'all' ? 'All Invoices' : status.replace('_', ' ').toUpperCase()}
              </button>
            ),
          )}
        </div>

        {/* Inputs row */}
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-6 gap-2 pt-1 text-xs">
          <div className="sm:col-span-2 relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search tenant or invoice #..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <input
              type="date"
              title="From Date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            />
          </div>

          <div>
            <input
              type="date"
              title="To Date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
            />
          </div>

          <div className="flex items-center gap-1">
            <input
              type="number"
              placeholder="Min $"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              className="w-1/2 px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
            <input
              type="number"
              placeholder="Max $"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              className="w-1/2 px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center justify-center gap-1 w-full"
            >
              <Filter className="h-3 w-3" /> Filter
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset all filters"
              className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-xs">Loading tenant invoices...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500 text-xs">
            {error}
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <FileText className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              No invoices match the specified criteria.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-indigo-600 dark:text-indigo-400 underline font-semibold"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3">Invoice Number</th>
                  <th className="px-5 py-3">Tenant Organization</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Total Amount</th>
                  <th className="px-5 py-3">Balance Due</th>
                  <th className="px-5 py-3">Due Date</th>
                  <th className="px-5 py-3">Settlement / Paid</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => handleViewDetail(inv.id)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition"
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-mono font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-indigo-500" />
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {inv.billingReason.replace('_', ' ')}
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {inv.tenantName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {inv.tenantSubdomain}.cmsnbd.com
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          statusBadges[inv.status] ?? 'border-slate-500 text-slate-400'
                        }`}
                      >
                        {inv.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-mono font-bold text-slate-900 dark:text-white">
                      {inv.currency} {Number(inv.total).toFixed(2)}
                    </td>

                    <td className="px-5 py-3.5 font-mono font-bold">
                      <span
                        className={
                          Number(inv.amountDue) > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-400 font-normal'
                        }
                      >
                        {inv.currency} {Number(inv.amountDue).toFixed(2)}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-slate-600 dark:text-slate-300">
                      {new Date(inv.dueDate).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>

                    <td className="px-5 py-3.5 text-slate-500">
                      {inv.paidAt ? (
                        <div>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {new Date(inv.paidAt).toLocaleDateString()}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {inv.paymentMethod?.replace('_', ' ') || 'manual'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleDownloadPdf(e, inv)}
                          disabled={downloadingId === inv.id}
                          title="Download PDF stored via FileStorage"
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                        >
                          <Download className="h-3.5 w-3.5 text-indigo-500" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleViewDetail(inv.id)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition"
                        >
                          View Detail
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onRefresh={fetchInvoices}
        />
      )}
    </div>
  );
}
