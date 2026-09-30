import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Clock, Lock, Palmtree, RefreshCw } from 'lucide-react';
import {
  findEffectiveLeavePolicy,
  type LeaveBalanceRecord,
  type LeavePolicyRecord,
} from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { OrgErrorBanner } from '@/components/org/OrgScreenParts';
import { useNav } from '@/context/NavContext';
import { getEmployeeLeaveBalances, listLeavePolicies } from '@/lib/leave-api';
import {
  accrualSummary,
  formatDays,
  formatIsoDate,
  todayIso,
} from '@/lib/leave-policy';
import { ApiError } from '@/lib/tenant-api-client';

function round(n: number): number {
  return Number(n.toFixed(2));
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-sm font-semibold text-primary tabular-nums">{value}</p>
      {hint ? <p className="text-[11px] text-muted truncate">{hint}</p> : null}
    </div>
  );
}

function Notice({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'error' | 'warning' | 'neutral';
  icon: typeof AlertTriangle;
  children: ReactNode;
}) {
  const tones = {
    error: 'text-error-700 bg-error-50 dark:bg-error-900/30 dark:text-error-300',
    warning: 'text-warning-700 bg-warning-50 dark:bg-warning-900/30 dark:text-warning-300',
    neutral: 'text-secondary bg-[rgb(var(--bg-muted))]',
  };
  return (
    <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${tones[tone]}`}>
      <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  );
}

/** Used (deducted) | pending (held in the balance until decided) | free. */
function UsageBar({ used, pending, balance }: { used: number; pending: number; balance: number }) {
  const heldPending = Math.max(0, Math.min(pending, balance));
  const free = Math.max(0, balance - pending);
  const total = used + heldPending + free;
  if (total <= 0) return <div className="h-2 w-full rounded-full bg-[rgb(var(--bg-muted))]" />;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className="flex h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-muted))]"
      role="img"
      aria-label={`${round(used)} used, ${round(heldPending)} pending, ${round(free)} free`}
    >
      <div className="bg-accent-500" style={{ width: pct(used) }} />
      <div className="bg-warning-400" style={{ width: pct(heldPending) }} />
      <div className="bg-success-500" style={{ width: pct(free) }} />
    </div>
  );
}

function BalanceCard({
  balance,
  policy,
  inProbation,
  probationEndDate,
}: {
  balance: LeaveBalanceRecord;
  policy: LeavePolicyRecord | undefined;
  inProbation: boolean;
  probationEndDate: string | null;
}) {
  const used = balance.usedDays ?? 0;
  const pending = balance.pendingDays ?? 0;
  const available = balance.balanceDays;
  const afterPending = round(available - pending);
  const isPaid = balance.isPaid ?? true;
  const tracksBalance = isPaid || (policy?.entitlementDays ?? 0) > 0;
  const cap = policy?.negativeBalanceCap ?? null;

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-primary">
                {balance.leaveTypeName ?? 'Leave'}
              </h3>
              {isPaid ? <Badge tone="success">Paid</Badge> : <Badge>Unpaid</Badge>}
            </div>
            <p className="text-xs text-muted mt-0.5">
              {policy ? accrualSummary(policy) : 'No policy in effect'}
            </p>
          </div>
          <div className="text-right shrink-0">
            {tracksBalance ? (
              <>
                <p
                  className={`text-2xl font-bold tabular-nums leading-none ${
                    available < 0 ? 'text-error-600' : 'text-primary'
                  }`}
                >
                  {round(available)}
                </p>
                <p className="text-[11px] text-muted mt-1">days available</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums leading-none text-primary">
                  {round(used)}
                </p>
                <p className="text-[11px] text-muted mt-1">days taken</p>
              </>
            )}
          </div>
        </div>

        {tracksBalance ? <UsageBar used={used} pending={pending} balance={available} /> : null}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat
            label="Entitlement"
            value={policy ? `${round(policy.entitlementDays)} / yr` : '—'}
          />
          <Stat label="Used" value={formatDays(used)} hint="Approved this year" />
          <Stat
            label="Pending"
            value={formatDays(pending)}
            hint={pending > 0 && tracksBalance ? `${afterPending} left if approved` : 'Awaiting approval'}
          />
          <Stat
            label="Carried fwd"
            value={formatDays(balance.carriedForwardDays)}
            hint={
              balance.carriedForwardDays > 0
                ? balance.carriedForwardExpiresAt
                  ? `Expires ${formatIsoDate(balance.carriedForwardExpiresAt)}`
                  : 'No expiry'
                : undefined
            }
          />
        </div>

        {available < 0 ? (
          <Notice tone="error" icon={AlertTriangle}>
            Overdrawn by {formatDays(-available)}.{' '}
            {policy?.allowNegativeBalance
              ? cap !== null
                ? `Policy allows down to −${formatDays(cap)}.`
                : 'Policy allows a negative balance with no cap.'
              : 'The current policy does not allow a negative balance.'}
          </Notice>
        ) : null}
        {inProbation && policy?.probationRestricted ? (
          <Notice tone="warning" icon={Lock}>
            Can't be requested until probation ends on {formatIsoDate(probationEndDate)}.
          </Notice>
        ) : null}
        {!policy ? (
          <Notice tone="neutral" icon={Clock}>
            No policy version covers today, so nothing accrues for this leave type.
          </Notice>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function EmployeeLeaveBalances({
  employeeId,
  companyId,
  probationEndDate = null,
}: {
  employeeId: string;
  companyId: string;
  probationEndDate?: string | null;
}) {
  const { navigate } = useNav();
  const [balances, setBalances] = useState<LeaveBalanceRecord[]>([]);
  const [policies, setPolicies] = useState<LeavePolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [balanceRows, policyRows] = await Promise.all([
        getEmployeeLeaveBalances(employeeId),
        listLeavePolicies(companyId),
      ]);
      setBalances(balanceRows);
      setPolicies(policyRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load leave balances');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employeeId, companyId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const today = todayIso();
  const inProbation = Boolean(probationEndDate && probationEndDate >= today);
  const sorted = useMemo(
    () =>
      [...balances].sort(
        (a, b) =>
          Number(b.isPaid ?? true) - Number(a.isPaid ?? true) ||
          (a.leaveTypeName ?? '').localeCompare(b.leaveTypeName ?? ''),
      ),
    [balances],
  );
  const year = balances.find((b) => b.leaveYearStart && b.leaveYearEnd);

  if (loading) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" aria-busy="true" aria-label="Loading">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-44 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-secondary">
          {year ? (
            <>
              Leave year{' '}
              <span className="font-medium text-primary">
                {formatIsoDate(year.leaveYearStart)} – {formatIsoDate(year.leaveYearEnd)}
              </span>
            </>
          ) : null}
          <p className="text-xs text-muted mt-0.5">
            Accrual is applied up to today. Balance is deducted when leave is approved.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            void load();
          }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error ? <OrgErrorBanner message={error} onRetry={() => void load()} /> : null}

      {!error && sorted.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={Palmtree}
            title="No leave types configured"
            description="Balances appear once the company has leave types with policies."
            action={{ label: 'Set up leave types', onClick: () => navigate('leave-types') }}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {sorted.map((balance) => (
              <BalanceCard
                key={balance.leaveTypeId}
                balance={balance}
                policy={findEffectiveLeavePolicy(policies, balance.leaveTypeId, today)}
                inProbation={inProbation}
                probationEndDate={probationEndDate}
              />
            ))}
          </div>
          {sorted.length > 0 ? (
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent-500" /> Used
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-warning-400" /> Pending approval
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success-500" /> Free to request
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
