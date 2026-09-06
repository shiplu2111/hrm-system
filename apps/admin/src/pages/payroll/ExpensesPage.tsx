import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  FileText,
  Upload,
  ArrowRight,
  Check,
  X,
  Clock,
  DollarSign,
  Loader2,
} from 'lucide-react';
import type { ExpenseCategoryRecord, ExpenseClaimRecord } from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { listEmployees } from '@/lib/employees-api';
import {
  approveExpenseClaim,
  createExpenseClaim,
  formatReceiptSize,
  listExpenseCategories,
  listExpenseClaims,
  rejectExpenseClaim,
  reimburseExpenseClaim,
  submitExpenseClaim,
  uploadExpenseReceipt,
} from '@/lib/expenses-api';
import { ApiError } from '@/lib/tenant-api-client';

const STATUS_FILTERS = [
  'All',
  'Pending Manager',
  'Pending Finance',
  'Approved for Payroll',
  'Reimbursed',
  'Rejected',
] as const;

function statusTone(
  displayStatus: string,
): 'success' | 'warning' | 'error' | 'neutral' {
  if (displayStatus === 'Reimbursed' || displayStatus === 'Approved for Payroll') {
    return 'success';
  }
  if (displayStatus === 'Rejected') return 'error';
  if (displayStatus.startsWith('Pending')) return 'warning';
  return 'neutral';
}

function ExpensesContent({ companyId }: { companyId: string }) {
  const [claims, setClaims] = useState<ExpenseClaimRecord[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [employees, setEmployees] = useState<
    { id: string; fullName: string; employeeNumber: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_FILTERS)[number]>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [employeeId, setEmployeeId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState(350);
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [claimRows, categoryRows, employeeRows] = await Promise.all([
        listExpenseClaims(companyId),
        listExpenseCategories(companyId),
        listEmployees(companyId),
      ]);
      setClaims(claimRows);
      setCategories(categoryRows);
      setEmployees(
        employeeRows.map((e) => ({
          id: e.id,
          fullName: `${e.firstName} ${e.lastName}`.trim(),
          employeeNumber: e.employeeNumber,
        })),
      );
      setEmployeeId((current) => current || employeeRows[0]?.id || '');
      setCategoryId((current) => current || categoryRows[0]?.id || '');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load expense claims',
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredClaims = useMemo(() => {
    const q = search.toLowerCase();
    return claims.filter((c) => {
      const matchesSearch =
        (c.employeeName ?? '').toLowerCase().includes(q) ||
        (c.employeeNumber ?? '').toLowerCase().includes(q) ||
        (c.categoryName ?? '').toLowerCase().includes(q) ||
        c.referenceNumber.toLowerCase().includes(q) ||
        (c.description ?? '').toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'All' || c.displayStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [claims, search, statusFilter]);

  const totalClaimed = claims.reduce((s, c) => s + c.amount, 0);
  const pendingManagerCount = claims.filter(
    (c) => c.displayStatus === 'Pending Manager',
  ).length;
  const pendingFinanceCount = claims.filter(
    (c) => c.displayStatus === 'Pending Finance',
  ).length;
  const readyForPayroll = claims.filter(
    (c) => c.displayStatus === 'Approved for Payroll',
  ).length;

  const handleCreateClaim = async () => {
    if (!employeeId || !categoryId) return;
    if (!receiptFile && selectedCategory?.receiptRequired) {
      setError('Please attach a receipt before submitting.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const draft = await createExpenseClaim(companyId, {
        employeeId,
        categoryId,
        amount,
        expenseDate,
        description: description.trim() || undefined,
        submit: false,
      });

      if (receiptFile) {
        await uploadExpenseReceipt(draft.id, receiptFile);
      }

      await submitExpenseClaim(draft.id);
      setModalOpen(false);
      setReceiptFile(null);
      setDescription('');
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to submit expense claim',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (claimId: string) => {
    setActionId(claimId);
    setError(null);
    try {
      await approveExpenseClaim(claimId);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to approve claim',
      );
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (claimId: string) => {
    setActionId(claimId);
    setError(null);
    try {
      await rejectExpenseClaim(claimId);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to reject claim',
      );
    } finally {
      setActionId(null);
    }
  };

  const handleReimburse = async (claimId: string) => {
    setActionId(claimId);
    setError(null);
    try {
      await reimburseExpenseClaim(claimId);
      await loadData();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to queue reimbursement',
      );
    } finally {
      setActionId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading expense claims…
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">
            Expense Claims & Reimbursements
          </h1>
          <p className="text-sm text-secondary mt-0.5">
            Submit business expenses with receipts, route through Manager →
            Finance approval, and queue reimbursements for payroll.
          </p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Submit Expense Claim
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              ${totalClaimed.toFixed(2)}
            </div>
            <div className="text-xs text-secondary">Total Claims Submitted</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {pendingManagerCount}
            </div>
            <div className="text-xs text-secondary">Pending Manager Review</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {pendingFinanceCount}
            </div>
            <div className="text-xs text-secondary">Pending Finance Audit</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {readyForPayroll}
            </div>
            <div className="text-xs text-secondary">Queued for Next Pay Run</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search claims by employee, claim #, or category..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-accent-600 text-white shadow-sm'
                  : 'surface border border-base text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Expense Claims & Approval Pipeline</CardTitle>
          <Badge tone="neutral">{filteredClaims.length} Claims</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Claim # / Employee
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Category & Details
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Receipt
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Approval Pipeline
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filteredClaims.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-8 text-center text-secondary text-sm"
                    >
                      No expense claims found.
                    </td>
                  </tr>
                ) : (
                  filteredClaims.map((claim) => {
                    const receipt = claim.receipts[0];
                    const steps = claim.workflow?.steps ?? [];
                    const isBusy = actionId === claim.id;

                    return (
                      <tr
                        key={claim.id}
                        className="hover:bg-[rgb(var(--bg-hover))] transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={claim.employeeName ?? 'Employee'}
                              size="sm"
                            />
                            <div>
                              <div className="font-semibold text-primary text-sm">
                                {claim.employeeName}
                              </div>
                              <div className="text-xs text-muted font-mono">
                                {claim.referenceNumber} · {claim.employeeNumber}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-xs">
                          <div className="font-semibold text-primary">
                            {claim.categoryName}
                          </div>
                          <div className="text-secondary line-clamp-1">
                            {claim.description ?? '—'}
                          </div>
                          <div className="text-[11px] text-muted mt-0.5">
                            {claim.expenseDate}
                          </div>
                        </td>

                        <td className="px-5 py-3.5 font-bold text-primary text-sm">
                          ${claim.amount.toFixed(2)}
                          {claim.amount > 1000 && (
                            <div className="text-[10px] text-warning-600 font-medium">
                              High-value route
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-xs">
                          {receipt ? (
                            <div className="flex items-center gap-1.5 p-1.5 rounded-lg border border-base bg-[rgb(var(--bg-muted))] w-fit">
                              <FileText className="h-3.5 w-3.5 text-accent-500" />
                              <span className="font-mono text-[11px] text-primary truncate max-w-[120px]">
                                {receipt.originalName}
                              </span>
                              <span className="text-[10px] text-muted">
                                ({formatReceiptSize(receipt.sizeBytes)})
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted">No receipt</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 text-xs">
                          {steps.length > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {steps.map((step, idx) => (
                                <span key={step.order} className="flex items-center gap-1">
                                  {idx > 0 && (
                                    <ArrowRight className="h-3 w-3 text-muted" />
                                  )}
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                      step.status === 'approved'
                                        ? 'bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-300'
                                        : step.status === 'pending'
                                          ? 'bg-warning-100 dark:bg-warning-950/40 text-warning-700 dark:text-warning-300'
                                          : 'bg-[rgb(var(--bg-muted))] text-muted'
                                    }`}
                                  >
                                    {step.roleName}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5">
                          <Badge tone={statusTone(claim.displayStatus)} dot>
                            {claim.displayStatus}
                          </Badge>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          {claim.status === 'pending_approval' && (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => void handleApprove(claim.id)}
                              >
                                {isBusy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}{' '}
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                disabled={isBusy}
                                onClick={() => void handleReject(claim.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                          {claim.status === 'approved' && (
                            <Button
                              variant="primary"
                              size="sm"
                              disabled={isBusy}
                              onClick={() => void handleReimburse(claim.id)}
                            >
                              Queue to Pay
                            </Button>
                          )}
                          {(claim.status === 'reimbursed' ||
                            claim.status === 'rejected') && (
                            <span className="text-xs font-medium text-success-600 dark:text-success-400">
                              ✓ Closed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Submit New Expense Claim"
        description="Upload a receipt and submit for Manager & Finance approval via the configured workflow."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={saving || !employeeId || !categoryId}
              onClick={() => void handleCreateClaim()}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                'Submit Claim'
              )}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Employee</Label>
              <Select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeNumber})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Expense Category</Label>
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </Select>
              {selectedCategory && (
                <p className="text-[11px] text-muted mt-1">
                  Limit: $
                  {selectedCategory.maxAmountPerClaim?.toLocaleString() ?? '—'}{' '}
                  / claim · $
                  {selectedCategory.maxAmountPerMonth?.toLocaleString() ?? '—'}{' '}
                  / month
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Claim Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              />
              {amount > 1000 && (
                <p className="text-[11px] text-warning-600 mt-1">
                  Claims over $1,000 use the high-value approval chain (Manager →
                  Finance → Owner).
                </p>
              )}
            </div>
            <div>
              <Label>Expense Date</Label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Business Justification / Description</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State client, project, or purpose..."
            />
          </div>

          <div
            className="border-2 border-dashed border-base rounded-xl p-4 text-center space-y-2 hover:border-accent-500/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-6 w-6 text-accent-500 mx-auto" />
            <div className="text-xs font-semibold text-primary">
              Upload Receipt / Tax Invoice
            </div>
            <div className="text-[11px] text-muted">
              PDF, PNG, JPG up to 10MB
            </div>
            {receiptFile ? (
              <div className="text-xs font-mono text-accent-600 font-medium">
                {receiptFile.name}
              </div>
            ) : (
              <div className="text-xs text-muted">Click to choose file</div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function ExpensesPage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <ExpensesContent companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
