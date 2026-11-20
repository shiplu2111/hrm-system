import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Layers,
  Loader2,
  Plus,
  Search,
  Send,
  XCircle,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type {
  ContractorContractRecord,
  ContractorInvoiceRecord,
  ContractorInvoiceStatus,
  ContractorPaymentBatchRecord,
  ContractorRecord,
} from '@hrm/shared-types';
import {
  ContractorInvoiceModals,
  useContractorInvoiceActions,
} from '@/components/contractors/ContractorInvoiceDetailModals';
import { ContractorInvoiceFormModal } from '@/components/contractors/ContractorInvoiceFormModal';
import { NonEmployeeApBanner } from '@/components/contractors/NonEmployeeApBanner';
import {
  AP_LEDGER_CARD_CLASS,
  AP_PRIMARY_BUTTON_CLASS,
  formatContractorDate,
  formatContractorMoney,
  INVOICE_STATUS_TONE,
  isInvoiceOverdue,
  sumMoneyStrings,
} from '@/components/contractors/contractor-ui.utils';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Form';
import { pathForPage } from '@/config/routes';
import { useCompany } from '@/context/CompanyContext';
import {
  createContractorPaymentBatch,
  INVOICE_STATUS_LABELS,
  listContractorContracts,
  listContractorInvoices,
  listContractorPaymentBatches,
  listContractors,
  markContractorPaymentBatchPaid,
} from '@/lib/contractors-api';
import { ApiError } from '@/lib/tenant-api-client';

type LedgerTab = 'invoices' | 'batches';
type InvoiceStatusFilter = 'all' | ContractorInvoiceStatus;

const BATCH_STATUS_TONE: Record<
  ContractorPaymentBatchRecord['status'],
  'neutral' | 'warning' | 'success' | 'error'
> = {
  draft: 'neutral',
  pending: 'warning',
  paid: 'success',
  failed: 'error',
};

export function ContractorInvoicesPage() {
  const routerNavigate = useNavigate();
  const { companyId } = useCompany();
  const { can } = usePermissions();
  const canCreate = can('contractors', 'create');
  const canEdit = can('contractors', 'edit');
  const canApprove = can('contractors', 'approve');
  const canFinalize = can('contractors', 'finalize');
  const canViewGlExports = can('payroll', 'view');

  const [activeTab, setActiveTab] = useState<LedgerTab>('invoices');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [contractors, setContractors] = useState<ContractorRecord[]>([]);
  const [contracts, setContracts] = useState<ContractorContractRecord[]>([]);
  const [invoices, setInvoices] = useState<ContractorInvoiceRecord[]>([]);
  const [batches, setBatches] = useState<ContractorPaymentBatchRecord[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatusFilter>('all');
  const [contractorFilter, setContractorFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [batchBusy, setBatchBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [contractorRows, contractRows, invoiceRows, batchRows] = await Promise.all([
        listContractors(companyId),
        listContractorContracts(companyId),
        listContractorInvoices(companyId),
        listContractorPaymentBatches(companyId),
      ]);
      setContractors(contractorRows);
      setContracts(contractRows);
      setInvoices(invoiceRows);
      setBatches(batchRows);
      setSelectedIds((prev) =>
        prev.filter((id) => invoiceRows.some((inv) => inv.id === id && inv.status === 'approved')),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load contractor invoices & batches',
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const invoiceActions = useContractorInvoiceActions({
    onSuccess: async () => {
      await load();
    },
    onError: (msg) => setError(msg),
  });

  const filteredInvoices = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
      if (contractorFilter && inv.contractorId !== contractorFilter) return false;
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.contractorName.toLowerCase().includes(q) ||
        inv.contractNumber.toLowerCase().includes(q) ||
        (inv.periodLabel ?? '').toLowerCase().includes(q) ||
        (inv.paymentReference ?? '').toLowerCase().includes(q)
      );
    });
  }, [contractorFilter, invoices, search, statusFilter]);

  const approvedInvoices = useMemo(
    () => invoices.filter((inv) => inv.status === 'approved'),
    [invoices],
  );

  const filteredApprovedIds = useMemo(
    () =>
      filteredInvoices
        .filter((inv) => inv.status === 'approved')
        .map((inv) => inv.id),
    [filteredInvoices],
  );

  const metrics = useMemo(() => {
    const submitted = invoices.filter((i) => i.status === 'submitted');
    const approved = invoices.filter((i) => i.status === 'approved');
    const scheduled = invoices.filter((i) => i.status === 'scheduled');
    const paid = invoices.filter((i) => i.status === 'paid');
    const overdue = invoices.filter(isInvoiceOverdue);
    return {
      submittedCount: submitted.length,
      submittedTotal: sumMoneyStrings(submitted.map((i) => i.amount)),
      approvedCount: approved.length,
      approvedTotal: sumMoneyStrings(approved.map((i) => i.amount)),
      scheduledTotal: sumMoneyStrings(scheduled.map((i) => i.amount)),
      pendingBatches: batches.filter((b) => b.status === 'pending').length,
      paidTotal: sumMoneyStrings(paid.map((i) => i.amount)),
      paidCount: paid.length,
      overdueCount: overdue.length,
    };
  }, [batches, invoices]);

  const selectedTotal = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return sumMoneyStrings(
      invoices.filter((inv) => selectedSet.has(inv.id)).map((inv) => inv.amount),
    );
  }, [invoices, selectedIds]);

  const toggleInvoiceSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAllApproved = () => {
    const allSelected =
      filteredApprovedIds.length > 0 &&
      filteredApprovedIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      const drop = new Set(filteredApprovedIds);
      setSelectedIds((prev) => prev.filter((id) => !drop.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredApprovedIds])));
    }
  };

  const handleCreateBatch = async (invoiceIds?: string[]) => {
    if (!companyId) return;
    setBatchBusy('create');
    setError(null);
    setNotice(null);
    try {
      const batch = await createContractorPaymentBatch(companyId, invoiceIds);
      setNotice(
        `Created AP payment batch ${batch.referenceNumber} (${batch.itemCount} invoice(s), ${formatContractorMoney(batch.totalAmount, batch.currency)}).`,
      );
      setSelectedIds([]);
      setActiveTab('batches');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create AP payment batch');
    } finally {
      setBatchBusy(null);
    }
  };

  const handleMarkBatchPaid = async (batch: ContractorPaymentBatchRecord) => {
    setBatchBusy(batch.id);
    setError(null);
    setNotice(null);
    try {
      const updated = await markContractorPaymentBatchPaid(batch.id);
      setNotice(
        `Batch ${updated.referenceNumber} marked paid (${formatContractorMoney(updated.totalAmount, updated.currency)})${
          updated.journalExportId
            ? ` · Contractor GL export ${updated.journalExportId.slice(0, 8)} queued`
            : ''
        }.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to mark AP batch paid');
    } finally {
      setBatchBusy(null);
    }
  };

  if (loading && invoices.length === 0 && batches.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[320px]">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <NonEmployeeApBanner
        activeScreen="invoices"
        title="Contractor Invoices & Payments"
        subtitle="Non-employee AP workflow: submit, verify, approve, batch, and settle external vendor payables"
        actions={
          <>
            {canViewGlExports && (
              <Button
                variant="secondary"
                onClick={() =>
                  routerNavigate(`${pathForPage('accounting-exports')}?kind=contractor`)
                }
              >
                <ExternalLink className="h-4 w-4" /> GL Exports (Contractor Expense)
              </Button>
            )}
            {canFinalize && approvedInvoices.length > 0 && (
              <Button
                variant="secondary"
                disabled={batchBusy === 'create'}
                onClick={() => void handleCreateBatch()}
                className="border-teal-300 text-teal-800 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-200 dark:hover:bg-teal-950/40"
              >
                {batchBusy === 'create' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Layers className="h-4 w-4" />
                )}
                Batch Approved ({approvedInvoices.length})
              </Button>
            )}
            {canCreate && (
              <Button
                className={AP_PRIMARY_BUTTON_CLASS}
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" /> New Invoice
              </Button>
            )}
          </>
        }
      />

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-teal-300 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/40 px-4 py-3 text-sm text-teal-900 dark:text-teal-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-700 dark:text-teal-300" />
          <span>{notice}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'Submitted / Awaiting Approval',
            value: formatContractorMoney(metrics.submittedTotal),
            note: `${metrics.submittedCount} invoice(s) queued`,
            icon: Clock,
            tone: 'text-amber-600 dark:text-amber-400',
          },
          {
            label: 'Approved (Ready for AP Batch)',
            value: formatContractorMoney(metrics.approvedTotal),
            note: `${metrics.approvedCount} approved unbatched`,
            icon: CheckCircle2,
            tone: 'text-teal-700 dark:text-teal-400',
          },
          {
            label: 'Scheduled in AP Batches',
            value: formatContractorMoney(metrics.scheduledTotal),
            note: `${metrics.pendingBatches} pending batch(es)`,
            icon: Layers,
            tone: 'text-sky-600 dark:text-sky-400',
          },
          {
            label: 'Settled B2B Payables',
            value: formatContractorMoney(metrics.paidTotal),
            note:
              metrics.overdueCount > 0
                ? `${metrics.paidCount} paid · ${metrics.overdueCount} overdue alert`
                : `${metrics.paidCount} invoice(s) settled`,
            icon: CreditCard,
            tone: metrics.overdueCount > 0 ? 'text-error-600' : 'text-emerald-600',
          },
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label} className={AP_LEDGER_CARD_CLASS}>
              <CardBody className="p-4 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted">{metric.label}</p>
                  <p className="text-xl font-bold font-mono text-primary mt-1">{metric.value}</p>
                  <p className="text-[11px] text-secondary mt-0.5">{metric.note}</p>
                </div>
                <Icon className={`h-5 w-5 shrink-0 ${metric.tone}`} />
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-base">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('invoices')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'invoices'
                ? 'border-teal-700 text-teal-800 dark:text-teal-300'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Vendor Invoices ({invoices.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('batches')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'batches'
                ? 'border-teal-700 text-teal-800 dark:text-teal-300'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Layers className="h-4 w-4" />
            AP Settlement Batches ({batches.length})
          </button>
        </div>
      </div>

      {activeTab === 'invoices' ? (
        <Card className={AP_LEDGER_CARD_CLASS}>
          <CardHeader className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <CardTitle>Commercial Invoice Ledger</CardTitle>
                <p className="text-xs text-muted mt-0.5">
                  Showing {filteredInvoices.length} of {invoices.length} non-employee payable(s)
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-52">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Invoice #, vendor, ref..."
                    className="h-8 pl-8 py-0 text-xs"
                  />
                </div>
                <Select
                  value={contractorFilter}
                  onChange={(e) => setContractorFilter(e.target.value)}
                  className="h-8 py-0 text-xs w-48"
                >
                  <option value="">All contractors</option>
                  {contractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName ?? c.legalName}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    'all',
                    'draft',
                    'submitted',
                    'approved',
                    'scheduled',
                    'paid',
                    'rejected',
                  ] as const
                ).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                      statusFilter === status
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'border-base text-secondary hover:bg-[rgb(var(--bg-hover))]'
                    }`}
                  >
                    {status === 'all' ? 'All statuses' : INVOICE_STATUS_LABELS[status]}
                  </button>
                ))}
              </div>

              {canFinalize && selectedIds.length > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-teal-300 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/40 px-3 py-1.5">
                  <span className="text-xs font-medium text-teal-900 dark:text-teal-200">
                    {selectedIds.length} approved selected ·{' '}
                    <span className="font-mono font-semibold">
                      {formatContractorMoney(selectedTotal)}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    className={AP_PRIMARY_BUTTON_CLASS}
                    disabled={batchBusy === 'create'}
                    onClick={() => void handleCreateBatch(selectedIds)}
                  >
                    {batchBusy === 'create' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Layers className="h-3.5 w-3.5" />
                    )}
                    Create AP Batch
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          <CardBody className="p-0 overflow-x-auto">
            {filteredInvoices.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted">
                No contractor invoices match your filters.
              </div>
            ) : (
              <table className="w-full min-w-[920px] text-left">
                <thead className="bg-[rgb(var(--bg-muted))] text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    {canFinalize && (
                      <th className="px-4 py-2.5 w-10">
                        <input
                          type="checkbox"
                          aria-label="Select all approved invoices"
                          disabled={filteredApprovedIds.length === 0}
                          checked={
                            filteredApprovedIds.length > 0 &&
                            filteredApprovedIds.every((id) => selectedIds.includes(id))
                          }
                          onChange={toggleSelectAllApproved}
                          className="h-4 w-4 rounded border-strong text-teal-700 focus:ring-teal-500"
                        />
                      </th>
                    )}
                    <th className="px-4 py-2.5 font-medium">Invoice #</th>
                    <th className="px-4 py-2.5 font-medium">Contractor / Contract</th>
                    <th className="px-4 py-2.5 font-medium">Period</th>
                    <th className="px-4 py-2.5 font-medium">Issued / Due</th>
                    <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Payment Ref</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {filteredInvoices.map((invoice) => {
                    const overdue = isInvoiceOverdue(invoice);
                    const isBusy = invoiceActions.busyId === invoice.id;
                    return (
                      <tr key={invoice.id} className="hover:bg-[rgb(var(--bg-hover))]">
                        {canFinalize && (
                          <td className="px-4 py-3">
                            {invoice.status === 'approved' ? (
                              <input
                                type="checkbox"
                                aria-label={`Select invoice ${invoice.invoiceNumber}`}
                                checked={selectedIds.includes(invoice.id)}
                                onChange={() => toggleInvoiceSelection(invoice.id)}
                                className="h-4 w-4 rounded border-strong text-teal-700 focus:ring-teal-500"
                              />
                            ) : (
                              <span className="text-muted text-xs">—</span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => invoiceActions.setDetailInvoice(invoice)}
                            className="font-mono text-sm font-semibold text-teal-700 hover:text-teal-900 dark:text-teal-300 dark:hover:text-teal-200 underline-offset-2 hover:underline"
                          >
                            {invoice.invoiceNumber}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-primary">
                            {invoice.contractorName}
                          </p>
                          <p className="text-[11px] font-mono text-muted">
                            {invoice.contractNumber}
                            {invoice.hoursWorked ? ` · ${invoice.hoursWorked} hrs` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-secondary">
                          {invoice.periodLabel ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <p className="text-secondary">
                            {formatContractorDate(invoice.issuedAt)}
                          </p>
                          <p className={overdue ? 'text-error-600 font-semibold' : 'text-muted'}>
                            Due {formatContractorDate(invoice.dueAt)}
                            {overdue ? ' · OVERDUE' : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono font-semibold text-primary text-right">
                          {formatContractorMoney(invoice.amount, invoice.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={INVOICE_STATUS_TONE[invoice.status]} dot>
                            {INVOICE_STATUS_LABELS[invoice.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-secondary">
                          {invoice.paymentReference ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => invoiceActions.setDetailInvoice(invoice)}
                              title="Inspect invoice"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {canEdit && invoice.status === 'draft' && (
                              <Button
                                size="sm"
                                className={AP_PRIMARY_BUTTON_CLASS}
                                disabled={isBusy}
                                onClick={() => invoiceActions.submitInvoice(invoice)}
                              >
                                <Send className="h-3.5 w-3.5" /> Submit
                              </Button>
                            )}
                            {canApprove && invoice.status === 'submitted' && (
                              <>
                                <Button
                                  size="sm"
                                  className={AP_PRIMARY_BUTTON_CLASS}
                                  disabled={isBusy}
                                  onClick={() => invoiceActions.approveInvoice(invoice)}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="danger"
                                  disabled={isBusy}
                                  onClick={() => invoiceActions.openRejectModal(invoice)}
                                >
                                  <XCircle className="h-3.5 w-3.5" /> Reject
                                </Button>
                              </>
                            )}
                            {canFinalize &&
                              (invoice.status === 'approved' ||
                                invoice.status === 'scheduled') && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={isBusy}
                                  onClick={() => invoiceActions.openPayModal(invoice)}
                                >
                                  <CreditCard className="h-3.5 w-3.5" /> Mark Paid
                                </Button>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      ) : (
        <Card className={AP_LEDGER_CARD_CLASS}>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Commercial AP Payment Batches (Non-Employee)</CardTitle>
              <p className="text-xs text-muted mt-0.5">
                Batches aggregate approved vendor invoices separately from employee salary payment runs and feed Contractor GL Journal exports.
              </p>
            </div>
            {canFinalize && approvedInvoices.length > 0 && (
              <Button
                className={AP_PRIMARY_BUTTON_CLASS}
                disabled={batchBusy === 'create'}
                onClick={() => void handleCreateBatch()}
              >
                {batchBusy === 'create' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                New Batch ({approvedInvoices.length} approved)
              </Button>
            )}
          </CardHeader>
          <CardBody className="p-0 overflow-x-auto">
            {batches.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted">
                No contractor payment batches created yet. Approve vendor invoices first, then batch them for settlement.
              </div>
            ) : (
              <table className="w-full min-w-[780px] text-left">
                <thead className="bg-[rgb(var(--bg-muted))] text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Batch Reference</th>
                    <th className="px-4 py-2.5 font-medium">Invoices</th>
                    <th className="px-4 py-2.5 font-medium text-right">Total Payable</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Paid At</th>
                    <th className="px-4 py-2.5 font-medium">GL Export</th>
                    <th className="px-4 py-2.5 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="hover:bg-[rgb(var(--bg-hover))]">
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-teal-800 dark:text-teal-300">
                        {batch.referenceNumber}
                      </td>
                      <td className="px-4 py-3 text-sm text-secondary">
                        {batch.itemCount} invoice(s)
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-semibold text-primary text-right">
                        {formatContractorMoney(batch.totalAmount, batch.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={BATCH_STATUS_TONE[batch.status]} dot>
                          {batch.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-secondary">
                        {batch.paidAt ? formatContractorDate(batch.paidAt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-muted">
                        {batch.journalExportId ? batch.journalExportId.slice(0, 8) : 'Pending'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canFinalize && batch.status === 'pending' ? (
                          <Button
                            size="sm"
                            className={AP_PRIMARY_BUTTON_CLASS}
                            disabled={batchBusy === batch.id}
                            onClick={() => void handleMarkBatchPaid(batch)}
                          >
                            {batchBusy === batch.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CreditCard className="h-3.5 w-3.5" />
                            )}
                            Mark Batch Paid
                          </Button>
                        ) : (
                          <span className="text-xs text-muted">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      )}

      {companyId && (
        <ContractorInvoiceFormModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          companyId={companyId}
          contractors={contractors}
          contracts={contracts}
          onCreated={async (created) => {
            setNotice(`Created draft invoice ${created.invoiceNumber}.`);
            await load();
          }}
        />
      )}

      <ContractorInvoiceModals
        state={invoiceActions}
        canEdit={canEdit}
        canApprove={canApprove}
        canFinalize={canFinalize}
      />
    </div>
  );
}

