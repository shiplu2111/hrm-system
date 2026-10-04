import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  Hourglass,
  Loader2,
  Paperclip,
  Plus,
  Receipt,
  Search,
  Settings2,
  Upload,
  UserCheck,
} from 'lucide-react';
import { PermissionGate, usePermissions } from '@hrm/portal-ui';
import type { ExpenseCategoryRecord, ExpenseClaimRecord } from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { SummaryTile } from '@/components/ui/SummaryTile';
import { Avatar } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { pathForPage } from '@/config/routes';
import { listEmployees } from '@/lib/employees-api';
import {
  createExpenseClaim,
  listExpenseCategories,
  listExpenseClaims,
  submitExpenseClaim,
  uploadExpenseReceipt,
} from '@/lib/expenses-api';
import {
  EXPENSE_STATUS_FILTERS,
  EXPENSE_STATUS_LABELS,
  EXPENSE_STATUS_TONE,
  daysWaiting,
  describeLimits,
  expenseStepLabel,
  formatClaimAmount,
  matchesExpenseFilter,
  type ExpenseListFilter,
} from '@/lib/expense-display';
import { formatDate, formatMoney, todayIso } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

const thClass = 'text-left px-3 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';

type EmployeeOption = { id: string; fullName: string; employeeNumber: string };

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function ExpensesContent({ companyId }: { companyId: string }) {
  const routerNavigate = useNavigate();
  const { can } = usePermissions();
  const canApprove = can('payroll', 'approve');
  const [params, setParams] = useSearchParams();

  const statusParam = params.get('status');
  const statusFilter = (
    EXPENSE_STATUS_FILTERS.some((f) => f.value === statusParam) ? statusParam : 'all'
  ) as ExpenseListFilter;
  const categoryFilter = params.get('category') ?? '';
  const employeeFilter = params.get('employee') ?? '';

  const [claims, setClaims] = useState<ExpenseClaimRecord[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [claimRows, categoryRows, employeeRows] = await Promise.all([
        listExpenseClaims(companyId),
        listExpenseCategories(companyId, false),
        listEmployees(companyId),
      ]);
      setClaims(claimRows);
      setCategories(categoryRows);
      setEmployees(
        employeeRows
          .map((e) => ({
            id: e.id,
            fullName: `${e.firstName} ${e.lastName}`.trim(),
            employeeNumber: e.employeeNumber,
          }))
          .sort((a, b) => a.fullName.localeCompare(b.fullName)),
      );
    } catch (err) {
      setError(errorText(err, 'Failed to load expense claims'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const scoped = useMemo(
    () =>
      claims.filter(
        (c) =>
          (!categoryFilter || c.categoryId === categoryFilter) &&
          (!employeeFilter || c.employeeId === employeeFilter),
      ),
    [claims, categoryFilter, employeeFilter],
  );

  const counts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const f of EXPENSE_STATUS_FILTERS) {
      result[f.value] = scoped.filter((c) => matchesExpenseFilter(c, f.value)).length;
    }
    return result;
  }, [scoped]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter(
      (c) =>
        matchesExpenseFilter(c, statusFilter) &&
        (!q ||
          (c.employeeName ?? '').toLowerCase().includes(q) ||
          (c.employeeNumber ?? '').toLowerCase().includes(q) ||
          (c.categoryName ?? '').toLowerCase().includes(q) ||
          (c.description ?? '').toLowerCase().includes(q) ||
          c.referenceNumber.toLowerCase().includes(q)),
    );
  }, [scoped, statusFilter, search]);

  const totals = useMemo(() => {
    const sum = (rows: ExpenseClaimRecord[]) => rows.reduce((s, c) => s + c.amount, 0);
    const pending = scoped.filter((c) => c.status === 'pending_approval');
    const toReimburse = scoped.filter((c) => c.status === 'approved');
    const month = todayIso().slice(0, 7);
    const reimbursedThisMonth = scoped.filter(
      (c) => c.status === 'reimbursed' && (c.reimbursedAt ?? '').slice(0, 7) === month,
    );
    return {
      awaitingMe: scoped.filter((c) => c.canAct).length,
      pendingCount: pending.length,
      pendingAmount: sum(pending),
      toReimburseCount: toReimburse.length,
      toReimburseAmount: sum(toReimburse),
      reimbursedCount: reimbursedThisMonth.length,
      reimbursedAmount: sum(reimbursedThisMonth),
    };
  }, [scoped]);

  const openClaim = (claimId: string) => routerNavigate(pathForPage('expense-detail', { claimId }));
  const hasFilters = !!categoryFilter || !!employeeFilter;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading expense claims…
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Expense Claims</h1>
          <p className="text-sm text-secondary mt-0.5">
            Claims with receipts, routed through the expense approval workflow, then reimbursed.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => routerNavigate(pathForPage('expense-categories'))}>
            <Settings2 className="h-4 w-4" /> Categories & limits
          </Button>
          <PermissionGate module="payroll" action="create">
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New claim
            </Button>
          </PermissionGate>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-3 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryTile
          icon={<UserCheck className="h-5 w-5" />}
          tone={totals.awaitingMe ? 'warning' : 'neutral'}
          value={String(totals.awaitingMe)}
          label="Awaiting your decision"
          hint={canApprove ? (totals.awaitingMe ? 'Claims on a step you can act on' : 'Nothing waiting on you') : 'You cannot approve claims'}
          onClick={totals.awaitingMe ? () => updateParams({ status: 'awaiting_me' }) : undefined}
        />
        <SummaryTile
          icon={<Hourglass className="h-5 w-5" />}
          tone="accent"
          value={String(totals.pendingCount)}
          label="Pending approval"
          hint={totals.pendingCount ? `${formatMoney(totals.pendingAmount)} in review` : 'No claims in review'}
          onClick={totals.pendingCount ? () => updateParams({ status: 'pending_approval' }) : undefined}
        />
        <SummaryTile
          icon={<Receipt className="h-5 w-5" />}
          tone={totals.toReimburseCount ? 'warning' : 'neutral'}
          value={formatMoney(totals.toReimburseAmount)}
          label="Approved, to reimburse"
          hint={`${totals.toReimburseCount} ${totals.toReimburseCount === 1 ? 'claim' : 'claims'} not yet paid back`}
          onClick={totals.toReimburseCount ? () => updateParams({ status: 'approved' }) : undefined}
        />
        <SummaryTile
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
          value={formatMoney(totals.reimbursedAmount)}
          label="Reimbursed this month"
          hint={`${totals.reimbursedCount} ${totals.reimbursedCount === 1 ? 'claim' : 'claims'}`}
        />
      </div>

      <div className="space-y-3">
        <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-base">
          {EXPENSE_STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => updateParams({ status: f.value === 'all' ? null : f.value })}
                className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'border-accent-600 text-accent-700 dark:text-accent-300'
                    : 'border-transparent text-secondary hover:text-primary'
                }`}
              >
                {f.label}
                <span className="ml-1.5 rounded-full bg-[rgb(var(--bg-muted))] px-1.5 text-xs text-muted">
                  {counts[f.value] ?? 0}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-52">
            <Select
              aria-label="Category"
              value={categoryFilter}
              onChange={(e) => updateParams({ category: e.target.value || null })}
              className="h-9 text-sm"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                  {cat.isActive ? '' : ' (inactive)'}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-52">
            <Select
              aria-label="Employee"
              value={employeeFilter}
              onChange={(e) => updateParams({ employee: e.target.value || null })}
              className="h-9 text-sm"
            >
              <option value="">All employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName}
                </option>
              ))}
            </Select>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, employee, description…"
              className="pl-8 h-9 text-sm"
            />
          </div>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={() => updateParams({ category: null, employee: null })}>
              Clear
            </Button>
          ) : null}
        </div>
      </div>

      <Card>
        <CardBody className="p-0">
          {visible.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-primary">
                {statusFilter === 'awaiting_me' ? 'Nothing is waiting on you' : 'No claims match'}
              </p>
              <p className="mt-1 text-sm text-secondary">
                {claims.length === 0
                  ? 'Create an expense claim to get started.'
                  : 'Try another status tab or clear the filters.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className={thClass}>Claim</th>
                    <th className={thClass}>Employee</th>
                    <th className={`${thClass} hidden 2xl:table-cell`}>Category</th>
                    <th className={`${thClass} text-right`}>Amount</th>
                    <th className={thClass}>Approval</th>
                    <th className={thClass}>Status</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {visible.map((claim) => {
                    const step = expenseStepLabel(claim);
                    const waiting = daysWaiting(claim);
                    return (
                      <tr
                        key={claim.id}
                        onClick={() => openClaim(claim.id)}
                        className="cursor-pointer hover:bg-[rgb(var(--bg-hover))] transition-colors"
                      >
                        <td className="px-3 py-3">
                          <div className="font-medium text-primary line-clamp-1">
                            {claim.description || claim.categoryName}
                          </div>
                          <div className="text-xs text-muted">
                            <span className="font-mono">{claim.referenceNumber}</span> · spent{' '}
                            {formatDate(claim.expenseDate)}
                            <span className="2xl:hidden"> · {claim.categoryName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={claim.employeeName ?? 'Employee'} size="sm" />
                            <div className="min-w-0">
                              <div className="text-primary truncate">{claim.employeeName}</div>
                              <div className="text-xs text-muted">{claim.employeeNumber}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-secondary hidden 2xl:table-cell">{claim.categoryName}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="font-semibold text-primary">{formatClaimAmount(claim)}</div>
                          <div
                            className={`text-xs inline-flex items-center gap-1 ${claim.receipts.length ? 'text-muted' : 'text-warning-600'}`}
                          >
                            <Paperclip className="h-3 w-3" />
                            {claim.receipts.length
                              ? `${claim.receipts.length} ${claim.receipts.length === 1 ? 'receipt' : 'receipts'}`
                              : 'No receipt'}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {step ? (
                            <>
                              <div className="text-secondary">{step}</div>
                              {waiting != null ? (
                                <div className={waiting >= 7 ? 'text-warning-600' : 'text-muted'}>
                                  {waiting === 0 ? 'Submitted today' : `Waiting ${waiting} ${waiting === 1 ? 'day' : 'days'}`}
                                </div>
                              ) : null}
                            </>
                          ) : claim.status === 'approved' ? (
                            <span className="text-secondary">Approved {formatDate(claim.approvedAt)}</span>
                          ) : claim.status === 'reimbursed' ? (
                            <span className="text-secondary">Paid {formatDate(claim.reimbursedAt)}</span>
                          ) : claim.status === 'rejected' ? (
                            <span className="text-secondary">Rejected {formatDate(claim.rejectedAt)}</span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <StatusPill tone={EXPENSE_STATUS_TONE[claim.status]}>
                            {claim.status === 'pending_approval'
                              ? claim.displayStatus
                              : EXPENSE_STATUS_LABELS[claim.status]}
                          </StatusPill>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <Button
                            variant={claim.canAct ? 'primary' : 'ghost'}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openClaim(claim.id);
                            }}
                          >
                            {claim.canAct ? 'Review' : 'View'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <CreateClaimModal
        open={createOpen}
        companyId={companyId}
        employees={employees}
        categories={categories.filter((c) => c.isActive)}
        defaultEmployeeId={employeeFilter}
        onClose={() => setCreateOpen(false)}
        onCreated={(claim, warning) => {
          setCreateOpen(false);
          routerNavigate(pathForPage('expense-detail', { claimId: claim.id }), {
            state: warning
              ? { warning }
              : {
                  notice:
                    claim.status === 'draft'
                      ? `${claim.referenceNumber} saved as a draft.`
                      : `${claim.referenceNumber} submitted for approval.`,
                },
          });
        }}
      />
    </div>
  );
}

function CreateClaimModal({
  open,
  companyId,
  employees,
  categories,
  defaultEmployeeId,
  onClose,
  onCreated,
}: {
  open: boolean;
  companyId: string;
  employees: EmployeeOption[];
  categories: ExpenseCategoryRecord[];
  defaultEmployeeId: string;
  onClose: () => void;
  onCreated: (claim: ExpenseClaimRecord, warning?: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [employeeId, setEmployeeId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayIso());
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmployeeId(defaultEmployeeId || '');
    setCategoryId('');
    setAmount('');
    setExpenseDate(todayIso());
    setDescription('');
    setReceipt(null);
    setError(null);
    setSaving(null);
  }, [open, defaultEmployeeId]);

  const category = categories.find((c) => c.id === categoryId) ?? null;
  const amountValue = Number(amount);
  const overClaimLimit =
    category?.maxAmountPerClaim != null && amountValue > category.maxAmountPerClaim;

  const validate = (submit: boolean): string | null => {
    if (!employeeId) return 'Choose the employee who incurred the expense.';
    if (!categoryId) return 'Choose a category.';
    if (!amount || !Number.isFinite(amountValue) || amountValue <= 0) return 'Enter an amount above zero.';
    if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) return 'Use at most two decimal places.';
    if (overClaimLimit) return `${category!.name} claims are limited to ${formatMoney(category!.maxAmountPerClaim)}.`;
    if (!expenseDate) return 'Enter the date the expense was incurred.';
    if (expenseDate > todayIso()) return 'The expense date cannot be in the future.';
    if (submit && category?.receiptRequired && !receipt) return `${category.name} claims need a receipt before they can be submitted.`;
    return null;
  };

  const save = async (submit: boolean) => {
    const problem = validate(submit);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(submit ? 'submit' : 'draft');
    setError(null);
    let draft: ExpenseClaimRecord | null = null;
    try {
      draft = await createExpenseClaim(companyId, {
        employeeId,
        categoryId,
        amount: amountValue,
        expenseDate,
        description: description.trim() || undefined,
      });
      if (receipt) await uploadExpenseReceipt(draft.id, receipt);
      onCreated(submit ? await submitExpenseClaim(draft.id) : draft);
    } catch (err) {
      const message = errorText(err, 'Could not save the claim');
      if (draft) {
        onCreated(draft, `Saved as a draft, but: ${message}`);
      } else {
        setError(message);
      }
    } finally {
      setSaving(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New expense claim"
      description="Submitting sends the claim into the expense approval workflow."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving !== null}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => void save(false)} disabled={saving !== null}>
            {saving === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save as draft
          </Button>
          <Button variant="primary" onClick={() => void save(true)} disabled={saving !== null}>
            {saving === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit for approval
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="claim-employee">Employee *</Label>
            <Select id="claim-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeNumber})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="claim-category">Category *</Label>
            <Select id="claim-category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Select category…</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
            {category ? (
              <p className="text-xs text-muted mt-1">
                {describeLimits(category)} · {category.receiptRequired ? 'receipt required' : 'receipt optional'}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="claim-amount">Amount (AUD) *</Label>
            <Input
              id="claim-amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
            {overClaimLimit ? (
              <p className="text-xs text-error-600 mt-1">
                Above the {formatMoney(category!.maxAmountPerClaim)} per-claim limit.
              </p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="claim-date">Expense date *</Label>
            <Input
              id="claim-date"
              type="date"
              max={todayIso()}
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="claim-description">Description</Label>
          <Textarea
            id="claim-description"
            rows={2}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was it for? Client, project or purpose"
          />
        </div>

        <div>
          <Label>Receipt{category?.receiptRequired ? ' *' : ''}</Label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-lg border-2 border-dashed border-base p-4 text-center hover:border-accent-500/50 transition-colors"
          >
            <Upload className="h-5 w-5 text-accent-500 mx-auto" />
            <div className="mt-1 text-sm text-primary">{receipt ? receipt.name : 'Choose a file'}</div>
            <div className="text-xs text-muted">PDF, PNG or JPG up to 10 MB</div>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              e.target.value = '';
              if (file && file.size > 10 * 1024 * 1024) {
                setError('Receipts must be 10 MB or smaller.');
                return;
              }
              setReceipt(file);
            }}
          />
        </div>

        {error ? <p className="text-sm text-error-600">{error}</p> : null}
      </div>
    </Modal>
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
