import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Hourglass,
  Paperclip,
  Plus,
  Receipt,
  Search,
  Send,
  Wallet,
} from 'lucide-react';
import type {
  ExpenseCategoryRecord,
  ExpenseClaimRecord,
  ExpenseClaimStatus,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { ExpenseClaimDetailModal } from '@/components/my/expenses/ExpenseClaimDetailModal';
import { ExpenseClaimSubmitModal } from '@/components/my/expenses/ExpenseClaimSubmitModal';
import { useMyEmployee } from '@/components/my/useMyEmployee';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Form';
import { Progress } from '@/components/ui/Progress';
import { StatusPill } from '@/components/ui/StatusPill';
import { SummaryTile } from '@/components/ui/SummaryTile';
import {
  cancelExpenseClaim,
  listExpenseCategories,
  listExpenseClaims,
  submitExpenseClaim,
} from '@/lib/expenses-api';
import {
  EXPENSE_STATUS_TONE,
  describeLimits,
  expenseStepLabel,
  formatClaimAmount,
  monthlyClaimedForCategory,
} from '@/lib/expense-display';
import { formatDate, formatMoney, todayIso } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

type StatusFilter = 'all' | ExpenseClaimStatus;

const STATUS_FILTERS: StatusFilter[] = [
  'all',
  'pending_approval',
  'approved',
  'reimbursed',
  'rejected',
  'draft',
  'cancelled',
];

export function MyExpensesPage() {
  const { t } = useAppTranslation();
  const {
    employeeId,
    companyId,
    loading: profileLoading,
    error: profileError,
  } = useMyEmployee();

  const [claims, setClaims] = useState<ExpenseClaimRecord[]>([]);
  const [categories, setCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [presetCategoryId, setPresetCategoryId] = useState<string | null>(null);
  const [detailClaimId, setDetailClaimId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!employeeId || !companyId) {
      if (!profileLoading) setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [categoryRows, claimRows] = await Promise.all([
        listExpenseCategories(companyId, true),
        listExpenseClaims(companyId, { employeeId }),
      ]);
      setCategories(categoryRows);
      setClaims(claimRows);
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('common.error'),
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId, companyId, profileLoading, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentMonth = todayIso().slice(0, 7);
  const defaultCurrency = claims[0]?.currency ?? 'AUD';

  const summary = useMemo(() => {
    const sum = (rows: ExpenseClaimRecord[]) =>
      rows.reduce((total, c) => total + c.amount, 0);
    const pending = claims.filter((c) => c.status === 'pending_approval');
    const approved = claims.filter((c) => c.status === 'approved');
    const reimbursed = claims.filter((c) => c.status === 'reimbursed');
    return {
      pendingCount: pending.length,
      pendingTotal: sum(pending),
      approvedCount: approved.length,
      approvedTotal: sum(approved),
      reimbursedCount: reimbursed.length,
      reimbursedTotal: sum(reimbursed),
    };
  }, [claims]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: claims.length,
      draft: 0,
      pending_approval: 0,
      approved: 0,
      rejected: 0,
      cancelled: 0,
      reimbursed: 0,
    };
    for (const c of claims) {
      counts[c.status] += 1;
    }
    return counts;
  }, [claims]);

  const visibleClaims = useMemo(() => {
    const q = search.trim().toLowerCase();
    return claims.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (categoryFilter && c.categoryId !== categoryFilter) return false;
      if (q) {
        const haystack = [
          c.referenceNumber,
          c.categoryName ?? '',
          c.description ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [claims, statusFilter, categoryFilter, search]);

  const openSubmitModal = (categoryId?: string) => {
    setPresetCategoryId(categoryId ?? null);
    setModalOpen(true);
  };

  const handleRowSubmit = async (claim: ExpenseClaimRecord) => {
    setBusyId(claim.id);
    setError(null);
    try {
      const updated = await submitExpenseClaim(claim.id);
      setNotice(
        t('myExpenses.submittedSuccess', { ref: updated.referenceNumber }),
      );
      setWarning(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('common.error'),
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleRowCancel = async (claim: ExpenseClaimRecord) => {
    setBusyId(claim.id);
    setError(null);
    try {
      const updated = await cancelExpenseClaim(claim.id);
      setConfirmCancelId(null);
      setNotice(
        t('myExpenses.cancelledSuccess', { ref: updated.referenceNumber }),
      );
      setWarning(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : t('common.error'),
      );
    } finally {
      setBusyId(null);
    }
  };

  const pageError = error ?? profileError;

  return (
    <MyPageLayout
      title={t('myExpenses.title')}
      subtitle={t('myExpenses.subtitle')}
      loading={profileLoading || (loading && claims.length === 0 && categories.length === 0)}
      error={pageError && claims.length === 0 && categories.length === 0 ? pageError : null}
      onRetry={() => void load()}
      actions={
        employeeId && companyId ? (
          <Button
            variant="primary"
            onClick={() => openSubmitModal()}
            disabled={categories.length === 0}
          >
            <Plus className="h-4 w-4" />
            {t('myExpenses.newClaim')}
          </Button>
        ) : null
      }
    >
      {notice ? (
        <div className="rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-4 py-3 text-sm text-success-700 dark:text-success-300">
          {notice}
        </div>
      ) : null}

      {warning ? (
        <div className="rounded-lg border border-warning-200 bg-warning-50 dark:bg-warning-950/30 px-4 py-3 text-sm text-warning-800 dark:text-warning-300">
          {warning}
        </div>
      ) : null}

      {pageError && (claims.length > 0 || categories.length > 0) ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {pageError}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryTile
          icon={<Hourglass className="h-5 w-5" />}
          tone="warning"
          value={`${formatMoney(summary.pendingTotal)} ${defaultCurrency}`}
          label={t('myExpenses.summaryPending')}
          hint={t('myExpenses.claimsCount', { count: summary.pendingCount })}
          onClick={() => setStatusFilter('pending_approval')}
        />
        <SummaryTile
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="accent"
          value={`${formatMoney(summary.approvedTotal)} ${defaultCurrency}`}
          label={t('myExpenses.summaryApproved')}
          hint={t('myExpenses.claimsCount', { count: summary.approvedCount })}
          onClick={() => setStatusFilter('approved')}
        />
        <SummaryTile
          icon={<Wallet className="h-5 w-5" />}
          tone="success"
          value={`${formatMoney(summary.reimbursedTotal)} ${defaultCurrency}`}
          label={t('myExpenses.summaryReimbursed')}
          hint={t('myExpenses.claimsCount', { count: summary.reimbursedCount })}
          onClick={() => setStatusFilter('reimbursed')}
        />
        <SummaryTile
          icon={<Receipt className="h-5 w-5" />}
          tone="neutral"
          value={String(categories.length)}
          label={t('myExpenses.summaryCategories')}
          hint={
            categories.some((c) => c.receiptRequired)
              ? t('myExpenses.receiptRequired')
              : t('myExpenses.receiptOptional')
          }
          onClick={() => setStatusFilter('all')}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('myExpenses.categoriesHeading')}</CardTitle>
        </CardHeader>
        <CardBody>
          {categories.length === 0 ? (
            <p className="text-sm text-muted">{t('myExpenses.noCategories')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {categories.map((cat) => {
                const spent =
                  cat.usage?.monthToDateAmount ??
                  monthlyClaimedForCategory(claims, cat.id, currentMonth);
                const monthlyCap = cat.maxAmountPerMonth;
                const remaining =
                  monthlyCap != null ? Math.max(0, monthlyCap - spent) : null;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => openSubmitModal(cat.id)}
                    className="text-left rounded-xl border border-base p-3.5 hover:border-accent-400 hover:bg-[rgb(var(--bg-subtle))] transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-primary">
                        {cat.name}
                      </span>
                      <Badge tone={cat.receiptRequired ? 'warning' : 'neutral'}>
                        {cat.receiptRequired
                          ? t('myExpenses.receiptRequired')
                          : t('myExpenses.receiptOptional')}
                      </Badge>
                    </div>
                    {cat.description ? (
                      <p className="text-xs text-muted line-clamp-2">
                        {cat.description}
                      </p>
                    ) : null}
                    <div className="text-xs text-secondary font-medium">
                      {describeLimits(cat)}
                    </div>
                    {monthlyCap != null ? (
                      <div className="space-y-1 pt-0.5">
                        <Progress
                          value={spent}
                          max={monthlyCap}
                          tone={
                            spent > monthlyCap
                              ? 'error'
                              : spent > monthlyCap * 0.8
                                ? 'warning'
                                : 'accent'
                          }
                        />
                        <div className="flex items-center justify-between text-[11px] text-muted">
                          <span>
                            {t('myExpenses.monthUsage', {
                              spent: `${formatMoney(spent)} ${defaultCurrency}`,
                              limit: `${formatMoney(monthlyCap)} ${defaultCurrency}`,
                            })}
                          </span>
                          <span>
                            {t('myExpenses.remainingMonth', {
                              remaining: `${formatMoney(remaining)} ${defaultCurrency}`,
                            })}
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>{t('myExpenses.historyTitle')}</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative">
              <Search className="h-4 w-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('myExpenses.searchPlaceholder')}
                className="pl-9 w-full sm:w-60"
              />
            </div>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-48"
            >
              <option value="">{t('myExpenses.allCategories')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>

        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((key) => {
              const active = statusFilter === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-accent-600 text-white'
                      : 'bg-[rgb(var(--bg-muted))] text-secondary hover:text-primary'
                  }`}
                >
                  <span>{t(`myExpenses.status.${key}`)}</span>
                  <span className="opacity-80">({statusCounts[key]})</span>
                </button>
              );
            })}
          </div>

          {visibleClaims.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={t('myExpenses.emptyTitle')}
              description={
                claims.length === 0
                  ? t('myExpenses.emptyDescription')
                  : t('myExpenses.emptyFiltered')
              }
              action={
                claims.length === 0 && categories.length > 0
                  ? {
                      label: t('myExpenses.newClaim'),
                      onClick: () => openSubmitModal(),
                      icon: Plus,
                    }
                  : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base text-xs font-semibold text-secondary uppercase tracking-wider">
                    <th className="text-left px-3 py-2.5">Ref</th>
                    <th className="text-left px-3 py-2.5">
                      {t('myExpenses.expenseDate')}
                    </th>
                    <th className="text-left px-3 py-2.5">
                      {t('myExpenses.category')}
                    </th>
                    <th className="text-left px-3 py-2.5">
                      {t('myExpenses.receipt')}
                    </th>
                    <th className="text-left px-3 py-2.5">Status</th>
                    <th className="text-right px-3 py-2.5">Amount</th>
                    <th className="text-right px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {visibleClaims.map((claim) => {
                    const stepLabel = expenseStepLabel(claim);
                    const isDraft = claim.status === 'draft';
                    const isPending = claim.status === 'pending_approval';
                    const isBusy = busyId === claim.id;

                    return (
                      <tr
                        key={claim.id}
                        className="hover:bg-[rgb(var(--bg-hover))] transition-colors"
                      >
                        <td className="px-3 py-3 font-mono text-xs text-primary whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setDetailClaimId(claim.id)}
                            className="font-semibold text-accent-600 hover:underline"
                          >
                            {claim.referenceNumber}
                          </button>
                        </td>
                        <td className="px-3 py-3 text-secondary whitespace-nowrap">
                          {formatDate(claim.expenseDate)}
                        </td>
                        <td className="px-3 py-3 min-w-[180px]">
                          <div className="font-medium text-primary">
                            {claim.categoryName}
                          </div>
                          {claim.description ? (
                            <div className="text-xs text-muted truncate max-w-[260px]">
                              {claim.description}
                            </div>
                          ) : null}
                          {claim.status === 'rejected' && claim.rejectionReason ? (
                            <div className="text-xs text-error-600 truncate max-w-[260px]">
                              {claim.rejectionReason}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-xs text-secondary">
                            <Paperclip className="h-3.5 w-3.5" />
                            {claim.receipts.length}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 items-start">
                            <StatusPill tone={EXPENSE_STATUS_TONE[claim.status]}>
                              {t(`myExpenses.status.${claim.status}`)}
                            </StatusPill>
                            {stepLabel ? (
                              <span className="text-[11px] text-muted">
                                {stepLabel}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-primary whitespace-nowrap">
                          {formatClaimAmount(claim)}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            {isDraft ? (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() => void handleRowSubmit(claim)}
                                disabled={isBusy}
                              >
                                <Send className="h-3.5 w-3.5" />
                                {t('myExpenses.submitNow')}
                              </Button>
                            ) : null}

                            {(isDraft || isPending) &&
                              (confirmCancelId === claim.id ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => void handleRowCancel(claim)}
                                    disabled={isBusy}
                                  >
                                    {t('myExpenses.confirmCancel')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setConfirmCancelId(null)}
                                    disabled={isBusy}
                                  >
                                    {t('myExpenses.keepClaim')}
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setConfirmCancelId(claim.id)}
                                  disabled={isBusy}
                                >
                                  {t('myExpenses.cancel')}
                                </Button>
                              ))}

                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setDetailClaimId(claim.id)}
                            >
                              {t('myExpenses.viewDetails')}
                            </Button>
                          </div>
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

      {employeeId && companyId ? (
        <ExpenseClaimSubmitModal
          open={modalOpen}
          companyId={companyId}
          employeeId={employeeId}
          currency={defaultCurrency}
          categories={categories}
          existingClaims={claims}
          initialCategoryId={presetCategoryId}
          onClose={() => setModalOpen(false)}
          onSaved={async (saved, draftWarn) => {
            setModalOpen(false);
            if (draftWarn) {
              setWarning(draftWarn);
              setNotice(null);
            } else {
              setWarning(null);
              setNotice(
                saved.status === 'draft'
                  ? t('myExpenses.draftSavedSuccess', {
                      ref: saved.referenceNumber,
                    })
                  : t('myExpenses.submittedSuccess', {
                      ref: saved.referenceNumber,
                    }),
              );
            }
            await load();
          }}
        />
      ) : null}

      <ExpenseClaimDetailModal
        claimId={detailClaimId}
        onClose={() => setDetailClaimId(null)}
        onUpdated={async (msg) => {
          if (msg) {
            setNotice(msg);
            setWarning(null);
          }
          await load();
        }}
      />
    </MyPageLayout>
  );
}

