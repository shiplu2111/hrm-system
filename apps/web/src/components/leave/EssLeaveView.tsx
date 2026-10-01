import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus, X } from 'lucide-react';
import type { LeaveBalanceRecord, LeaveRequestRecord, LeaveTypeRecord } from '@hrm/shared-types';
import {
  ApiError,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ProgressBar,
} from '@hrm/portal-ui';
import { getLeaveBalances, listLeaveRequests, listLeaveTypes } from '@/lib/ess-api';
import { LeaveRequestForm } from './LeaveRequestForm';
import { MyLeaveRequests } from './MyLeaveRequests';
import { useLeaveFormat } from './leave-i18n';

interface EssLeaveViewProps {
  employeeId: string;
  companyId: string;
  onUnauthorized: () => void;
  onChanged?: () => void;
}

export function EssLeaveView({ employeeId, companyId, onUnauthorized, onChanged }: EssLeaveViewProps) {
  const { t } = useLeaveFormat();
  const [balances, setBalances] = useState<LeaveBalanceRecord[]>([]);
  const [requests, setRequests] = useState<LeaveRequestRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [bal, reqs, types] = await Promise.all([
        getLeaveBalances(employeeId),
        listLeaveRequests(companyId, employeeId),
        listLeaveTypes(companyId),
      ]);
      setBalances(bal);
      setRequests(reqs);
      setLeaveTypes(types);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        onUnauthorized();
        return;
      }
      setError(e instanceof ApiError ? e.message : t('errors.loadEmployeeData'));
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId, onUnauthorized, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeForm = useCallback(() => setFormOpen(false), []);

  function handleSubmitted() {
    setFormOpen(false);
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
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

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

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary">{t('leave.balances')}</h2>
        <Button
          variant="primary"
          size="sm"
          disabled={leaveTypes.length === 0}
          onClick={() => {
            setNotice(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> {t('leave.requestLeave')}
        </Button>
      </div>

      {balances.length === 0 ? (
        <p className="text-sm text-muted">
          {leaveTypes.length === 0 ? t('leave.noBalanceTypes') : t('dashboard.noLeaveBalances')}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map((balance) => (
            <BalanceCard key={balance.id} balance={balance} />
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('leave.myRequests')}</CardTitle>
        </CardHeader>
        <CardBody className="py-1">
          <MyLeaveRequests requests={requests} onCancelled={handleCancelled} />
        </CardBody>
      </Card>

      <LeaveRequestForm
        open={formOpen}
        employeeId={employeeId}
        leaveTypes={leaveTypes}
        balances={balances}
        onClose={closeForm}
        onSubmitted={handleSubmitted}
      />
    </div>
  );
}

function BalanceCard({ balance }: { balance: LeaveBalanceRecord }) {
  const { t, days, number } = useLeaveFormat();
  const unpaid = balance.isPaid === false;
  const entitlement = balance.entitlementDays + balance.carriedForwardDays;
  const low = balance.balanceDays <= 0;

  return (
    <Card>
      <CardBody className="space-y-2 text-sm">
        <div className="font-medium text-primary">
          {balance.leaveTypeName ?? t('dashboard.leaveFallback')}
        </div>
        {unpaid ? (
          <p className="text-xs text-muted">{t('leave.balanceCard.unpaidHint')}</p>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-2xl font-semibold tabular-nums ${
                  low ? 'text-error-700 dark:text-error-300' : 'text-primary'
                }`}
              >
                {number(balance.balanceDays)}
              </span>
              <span className="text-xs text-muted">
                {t('leave.available')} ·{' '}
                {t('leave.balanceCard.ofEntitlement', { entitlement: number(balance.entitlementDays) })}
              </span>
            </div>
            {entitlement > 0 && (
              <ProgressBar
                value={Math.max(balance.balanceDays, 0)}
                max={entitlement}
                tone={low ? 'error' : 'accent'}
              />
            )}
            {(balance.pendingDays ?? 0) > 0 && (
              <p className="text-xs text-warning-700 dark:text-warning-300">
                {t('leave.balanceCard.pending', { days: days(balance.pendingDays ?? 0) })}
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
