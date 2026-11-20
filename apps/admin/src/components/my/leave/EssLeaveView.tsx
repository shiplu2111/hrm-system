import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Plus, X } from 'lucide-react';
import type { LeaveBalanceRecord, LeaveRequestRecord, LeaveTypeRecord } from '@hrm/shared-types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { getLeaveBalances, listMyLeaveRequests, listLeaveTypes } from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';
import { LeaveRequestForm } from './LeaveRequestForm';
import { MyLeaveRequests } from './MyLeaveRequests';
import { useLeaveFormat } from './leave-i18n';

interface EssLeaveViewProps {
  employeeId: string;
  companyId: string;
  onChanged?: () => void;
}

export function EssLeaveView({ employeeId, companyId, onChanged }: EssLeaveViewProps) {
  const { t, days } = useLeaveFormat();
  const [balances, setBalances] = useState<LeaveBalanceRecord[]>([]);
  const [requests, setRequests] = useState<LeaveRequestRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedLeaveTypeId, setSelectedLeaveTypeId] = useState<string | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [bal, reqs, types] = await Promise.all([
        getLeaveBalances(employeeId),
        listMyLeaveRequests(companyId, employeeId),
        listLeaveTypes(companyId),
      ]);
      setBalances(bal);
      setRequests(reqs);
      setLeaveTypes(types);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errors.loadEmployeeData'));
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setSelectedLeaveTypeId(undefined);
  }, []);

  function openForm(leaveTypeId?: string) {
    setNotice(null);
    setSelectedLeaveTypeId(leaveTypeId);
    setFormOpen(true);
  }

  function handleSubmitted() {
    setFormOpen(false);
    setSelectedLeaveTypeId(undefined);
    setNotice(t('leave.form.submitted'));
    void load();
    onChanged?.();
  }

  function handleCancelled(updated: LeaveRequestRecord) {
    setRequests((rows) => rows.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
    void load();
    onChanged?.();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1].map((idx) => (
            <Card key={idx}>
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-14 rounded-md" />
                </div>
                <Skeleton className="h-7 w-28" />
                <Skeleton className="h-2.5 w-full rounded-full" />
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardBody className="space-y-3">
            {[0, 1, 2].map((idx) => (
              <Skeleton key={idx} className="h-14 w-full" />
            ))}
          </CardBody>
        </Card>
      </div>
    );
  }

  const paidBalances = balances.filter((b) => b.isPaid !== false);
  const showOverview = paidBalances.length > 1;
  const totalAvailable = paidBalances.reduce((sum, b) => sum + b.balanceDays, 0);
  const totalUsed = paidBalances.reduce((sum, b) => sum + (b.usedDays ?? 0), 0);
  const totalPending = paidBalances.reduce((sum, b) => sum + (b.pendingDays ?? 0), 0);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
          {error}
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-800 dark:bg-success-900/30 dark:text-success-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button
            type="button"
            className="opacity-70 hover:opacity-100"
            onClick={() => setNotice(null)}
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-primary">{t('leave.balances')}</h2>
        <Button
          variant="primary"
          size="sm"
          className="min-h-[40px]"
          disabled={leaveTypes.length === 0}
          onClick={() => openForm()}
        >
          <Plus className="h-4 w-4" /> {t('leave.requestLeave')}
        </Button>
      </div>

      {showOverview && (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-4 py-3 text-sm">
            <span className="font-medium text-primary">{t('leave.balanceCard.summaryTitle')}</span>
            <div className="flex flex-wrap items-center gap-5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent-600" />
                <span className="text-muted">{t('leave.balanceCard.totalAvailable')}:</span>
                <span className="font-semibold tabular-nums text-primary">{days(totalAvailable)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-400 dark:bg-slate-500" />
                <span className="text-muted">{t('leave.balanceCard.totalUsed')}:</span>
                <span className="font-semibold tabular-nums text-primary">{days(totalUsed)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-warning-400" />
                <span className="text-muted">{t('leave.balanceCard.totalPending')}:</span>
                <span className="font-semibold tabular-nums text-primary">{days(totalPending)}</span>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {balances.length === 0 ? (
        <p className="text-sm text-muted">
          {leaveTypes.length === 0 ? t('leave.noBalanceTypes') : t('dashboard.noLeaveBalances')}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map((balance) => (
            <BalanceCard
              key={balance.id}
              balance={balance}
              canApply={leaveTypes.some((type) => type.id === balance.leaveTypeId)}
              onApply={() => openForm(balance.leaveTypeId)}
            />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('leave.myRequests')}</CardTitle>
        </CardHeader>
        <CardBody className="py-2">
          <MyLeaveRequests
            requests={requests}
            onCancelled={handleCancelled}
            onApply={leaveTypes.length > 0 ? () => openForm() : undefined}
          />
        </CardBody>
      </Card>

      <LeaveRequestForm
        open={formOpen}
        employeeId={employeeId}
        leaveTypes={leaveTypes}
        balances={balances}
        initialLeaveTypeId={selectedLeaveTypeId}
        onClose={closeForm}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}

function BalanceCard({
  balance,
  canApply,
  onApply,
}: {
  balance: LeaveBalanceRecord;
  canApply: boolean;
  onApply: () => void;
}) {
  const { t, days, number, date } = useLeaveFormat();
  const unpaid = balance.isPaid === false;
  const used = Math.max(balance.usedDays ?? 0, 0);
  const pending = Math.max(balance.pendingDays ?? 0, 0);
  const available = balance.balanceDays;
  const netAfterPending = available - pending;
  const totalPool = balance.entitlementDays + balance.carriedForwardDays;
  const barScale = Math.max(totalPool, used + Math.max(available, 0), 1);
  const usedPct = Math.min(100, (used / barScale) * 100);
  const pendingShown = Math.min(pending, Math.max(available, 0));
  const pendingPct = Math.min(100 - usedPct, (pendingShown / barScale) * 100);
  const remainingPct = Math.min(
    100 - usedPct - pendingPct,
    (Math.max(available - pendingShown, 0) / barScale) * 100,
  );
  const low = available <= 0;

  return (
    <Card>
      <CardBody className="flex h-full flex-col justify-between gap-3 text-sm">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-primary">
                {balance.leaveTypeName ?? t('dashboard.leaveFallback')}
              </span>
              <Badge tone={unpaid ? 'neutral' : 'accent'}>
                {unpaid ? t('leave.unpaid') : t('leave.paid')}
              </Badge>
            </div>
            {canApply && (
              <button
                type="button"
                className="shrink-0 text-xs font-medium text-accent-600 hover:text-accent-700 dark:text-accent-400"
                onClick={onApply}
              >
                {t('leave.balanceCard.applyType')}
              </button>
            )}
          </div>

          {unpaid ? (
            <div className="space-y-1">
              <p className="text-xs text-muted">{t('leave.balanceCard.unpaidHint')}</p>
              {(used > 0 || pending > 0) && (
                <div className="flex flex-wrap gap-3 text-xs text-secondary">
                  <span>
                    {t('leave.balanceCard.used')}:{' '}
                    <strong className="tabular-nums text-primary">{days(used)}</strong>
                  </span>
                  {pending > 0 && (
                    <span className="text-warning-700 dark:text-warning-300">
                      {t('leave.balanceCard.pendingLabel')}:{' '}
                      <strong className="tabular-nums">{days(pending)}</strong>
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-2xl font-semibold tabular-nums ${
                      low ? 'text-error-700 dark:text-error-300' : 'text-primary'
                    }`}
                  >
                    {number(available)}
                  </span>
                  <span className="text-xs text-muted">{t('leave.available')}</span>
                </div>
                {balance.entitlementDays > 0 && (
                  <span className="text-xs text-muted">
                    {t('leave.balanceCard.ofEntitlement', { entitlement: number(balance.entitlementDays) })}
                  </span>
                )}
              </div>

              <div
                className="flex h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-muted))]"
                aria-hidden="true"
              >
                {remainingPct > 0 && (
                  <div className="h-full bg-accent-600 transition-all" style={{ width: `${remainingPct}%` }} />
                )}
                {pendingPct > 0 && (
                  <div className="h-full bg-warning-400 transition-all" style={{ width: `${pendingPct}%` }} />
                )}
                {usedPct > 0 && (
                  <div
                    className="h-full bg-slate-400 transition-all dark:bg-slate-500"
                    style={{ width: `${usedPct}%` }}
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs">
                <div>
                  <div className="text-muted">{t('leave.balanceCard.entitlement')}</div>
                  <div className="font-semibold tabular-nums text-primary">
                    {days(balance.entitlementDays)}
                  </div>
                </div>
                <div>
                  <div className="text-muted">{t('leave.balanceCard.used')}</div>
                  <div className="font-semibold tabular-nums text-primary">{days(used)}</div>
                </div>
                <div>
                  <div className="text-muted">{t('leave.balanceCard.pendingLabel')}</div>
                  <div
                    className={`font-semibold tabular-nums ${
                      pending > 0 ? 'text-warning-700 dark:text-warning-300' : 'text-primary'
                    }`}
                  >
                    {days(pending)}
                  </div>
                </div>
              </div>

              {balance.carriedForwardDays > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-secondary">
                  <span>
                    {t('leave.balanceCard.carriedForward')}:{' '}
                    <strong className="tabular-nums text-primary">
                      {days(balance.carriedForwardDays)}
                    </strong>
                  </span>
                  {balance.carriedForwardExpiresAt && (
                    <span className="text-muted">
                      {t('leave.balanceCard.expiresOn', { date: date(balance.carriedForwardExpiresAt) })}
                    </span>
                  )}
                </div>
              )}

              {pending > 0 && (
                <div className="flex items-center justify-between text-xs text-warning-700 dark:text-warning-300">
                  <span>{t('leave.balanceCard.pending', { days: days(pending) })}</span>
                  <span className="tabular-nums">
                    {t('leave.balanceCard.netAfterPending')}: {days(netAfterPending)}
                  </span>
                </div>
              )}

              {balance.negativeBalanceWarning && (
                <p className="text-xs text-error-700 dark:text-error-300">
                  {t('leave.balanceCard.negativeWarning')}
                </p>
              )}
            </>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
