import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import type {
  LeaveBalanceRecord,
  LeaveRequestPreview,
  LeaveTypeRecord,
} from '@hrm/shared-types';
import {
  ApiError,
  Button,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
  Toggle,
} from '@hrm/portal-ui';
import { createLeaveRequest, previewLeaveRequest } from '@/lib/ess-api';
import { approverLabel, issueMessage, useLeaveFormat } from './leave-i18n';

const PREVIEW_DEBOUNCE_MS = 250;
const REASON_MAX = 1000;

type PreviewResult =
  | { key: string; startDate: string; endDate: string; preview: LeaveRequestPreview }
  | { key: string; error: true };

interface LeaveRequestFormProps {
  open: boolean;
  employeeId: string;
  leaveTypes: LeaveTypeRecord[];
  balances: LeaveBalanceRecord[];
  onClose: () => void;
  onSubmitted: () => void;
}

export function LeaveRequestForm(props: LeaveRequestFormProps) {
  if (!props.open) return null;
  return <LeaveRequestFormBody {...props} />;
}

function defaultLeaveTypeId(types: LeaveTypeRecord[], balances: LeaveBalanceRecord[]): string {
  const withBalance = types.find((type) =>
    balances.some((b) => b.leaveTypeId === type.id && b.balanceDays > 0),
  );
  return (withBalance ?? types[0])?.id ?? '';
}

function LeaveRequestFormBody({
  employeeId,
  leaveTypes,
  balances,
  onClose,
  onSubmitted,
}: LeaveRequestFormProps) {
  const { t, days, range } = useLeaveFormat();
  const [leaveTypeId, setLeaveTypeId] = useState(() => defaultLeaveTypeId(leaveTypes, balances));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [halfDayChecked, setHalfDayChecked] = useState(false);
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const singleDay = Boolean(startDate) && startDate === endDate;
  const halfDay = singleDay && halfDayChecked;
  const datesChosen = Boolean(leaveTypeId && startDate && endDate);
  const requestKey = datesChosen ? `${leaveTypeId}|${startDate}|${endDate}|${halfDay}` : null;

  const balanceByType = useMemo(
    () => new Map(balances.map((b) => [b.leaveTypeId, b])),
    [balances],
  );
  const selectedType = leaveTypes.find((type) => type.id === leaveTypeId) ?? null;
  const selectedBalance = balanceByType.get(leaveTypeId) ?? null;

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      previewLeaveRequest(
        employeeId,
        { leaveTypeId, startDate, endDate, halfDay },
        controller.signal,
      )
        .then((preview) => {
          if (!controller.signal.aborted) {
            setResult({ key: requestKey, startDate, endDate, preview });
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ key: requestKey, error: true });
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [employeeId, requestKey, leaveTypeId, startDate, endDate, halfDay]);

  const current = result && result.key === requestKey ? result : null;
  const stale = requestKey !== null && current === null;
  const failed = current !== null && 'error' in current;
  const shown = result && 'preview' in result ? result : null;
  const halfDayBlocked = shown?.preview.policy?.halfDayAllowed === false;

  const canSubmit =
    datesChosen &&
    !submitting &&
    current !== null &&
    ('error' in current || current.preview.canSubmit);

  function handleStartDate(value: string) {
    setStartDate(value);
    if (value && (!endDate || endDate < value)) setEndDate(value);
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createLeaveRequest(employeeId, {
        leaveTypeId,
        startDate,
        endDate,
        halfDay,
        reason: reason.trim() || undefined,
        submit: true,
      });
      onSubmitted();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : t('errors.submitLeave'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={t('leave.modalTitle')}
      description={t('leave.form.subtitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={() => void handleSubmit()}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('leave.form.submit')}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-5">
        <div className="space-y-4 md:col-span-3">
          <div>
            <Label htmlFor="leave-type">{t('leave.leaveType')}</Label>
            <Select
              id="leave-type"
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
            >
              {leaveTypes.map((type) => {
                const balance = balanceByType.get(type.id);
                const label = !type.isPaid
                  ? t('leave.form.typeOptionUnpaid', { name: type.name })
                  : balance
                    ? t('leave.form.typeOptionAvailable', {
                        name: type.name,
                        days: days(balance.balanceDays),
                      })
                    : type.name;
                return (
                  <option key={type.id} value={type.id}>
                    {label}
                  </option>
                );
              })}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="leave-start">{t('leave.startDate')}</Label>
              <Input
                id="leave-start"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="leave-end">{t('leave.endDate')}</Label>
              <Input
                id="leave-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {singleDay && (
            <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border border-base px-3 py-2.5">
              <span>
                <span className="block text-sm font-medium text-primary">{t('leave.form.halfDay')}</span>
                <span className="block text-xs text-muted">
                  {halfDayBlocked ? t('leave.form.halfDayNotAllowed') : t('leave.form.halfDayHint')}
                </span>
              </span>
              {!halfDayBlocked && (
                <Toggle checked={halfDayChecked} onChange={setHalfDayChecked} size="sm" />
              )}
            </label>
          )}

          <div>
            <Label htmlFor="leave-reason">{t('leave.reason')}</Label>
            <Textarea
              id="leave-reason"
              rows={3}
              maxLength={REASON_MAX}
              value={reason}
              placeholder={t('leave.form.reasonPlaceholder')}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {submitError}
            </div>
          )}
        </div>

        <aside
          className="rounded-xl bg-[rgb(var(--bg-muted))] p-4 md:col-span-2"
          aria-live="polite"
        >
          {!datesChosen ? (
            <div className="space-y-2 text-sm">
              {selectedType && selectedType.isPaid && selectedBalance && (
                <p className="font-medium text-primary">
                  {t('leave.form.availableNow', {
                    days: days(selectedBalance.balanceDays),
                    type: selectedType.name,
                  })}
                </p>
              )}
              {selectedType && !selectedType.isPaid && (
                <p className="font-medium text-primary">{t('leave.form.unpaidSummary')}</p>
              )}
              <p className="text-muted">{t('leave.form.pickDates')}</p>
            </div>
          ) : failed ? (
            <p className="text-sm text-muted">{t('leave.form.previewFailed')}</p>
          ) : !shown ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('leave.form.calculating')}
            </div>
          ) : (
            <PreviewSummary
              preview={shown.preview}
              stale={stale}
              range={range(shown.startDate, shown.endDate)}
            />
          )}
        </aside>
      </div>
    </Modal>
  );
}

function PreviewSummary({
  preview,
  stale,
  range,
}: {
  preview: LeaveRequestPreview;
  stale: boolean;
  range: string;
}) {
  const { t, days, date, number } = useLeaveFormat();
  const issueFormat = { date, number };
  const weekends = preview.excludedDates.filter((d) => d.reason === 'weekend').length;
  const holidays = preview.excludedDates.length - weekends;
  const errors = preview.issues.filter((issue) => issue.severity === 'error');
  const warnings = preview.issues.filter((issue) => issue.severity === 'warning');
  const balance = preview.balance;

  const excluded = [
    weekends > 0 ? t('leave.form.weekendDays', { count: weekends }) : null,
    holidays > 0 ? t('leave.form.publicHolidays', { count: holidays }) : null,
  ].filter(Boolean);
  const breakdown = [
    t('leave.form.calendarDays', { count: preview.calendarDays }),
    excluded.length > 0
      ? t('leave.form.excludes', { list: excluded.join(t('leave.form.listAnd')) })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`space-y-4 text-sm transition-opacity ${stale ? 'opacity-60' : ''}`}>
      <div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span>{t('leave.form.thisRequest')}</span>
          {stale && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-label={t('leave.form.calculating')} />}
        </div>
        <div className="mt-0.5 text-2xl font-semibold text-primary tabular-nums">
          {days(preview.totalDays)}
        </div>
        <div className="text-xs text-muted">{range}</div>
        {preview.calendarDays > 0 && <div className="mt-0.5 text-xs text-muted">{breakdown}</div>}
      </div>

      {balance ? (
        <BalanceMeter
          available={balance.available}
          requested={preview.totalDays}
          after={balance.afterRequest}
        />
      ) : (
        <p className="text-xs text-secondary">{t('leave.form.unpaidSummary')}</p>
      )}

      {balance && balance.pending > 0 && (
        <p className="text-xs text-secondary">
          {t('leave.form.pendingNote', { days: days(balance.pending) })}
        </p>
      )}

      {(errors.length > 0 || warnings.length > 0) && (
        <ul className="space-y-2">
          {errors.map((issue, i) => (
            <li key={`e${i}`} className="flex gap-2 text-xs text-error-700 dark:text-error-300">
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{issueMessage(t, issue, issueFormat)}</span>
            </li>
          ))}
          {warnings.map((issue, i) => (
            <li key={`w${i}`} className="flex gap-2 text-xs text-warning-700 dark:text-warning-300">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{issueMessage(t, issue, issueFormat)}</span>
            </li>
          ))}
        </ul>
      )}

      {preview.approvalSteps.length > 0 && (
        <div className="border-t border-base pt-3">
          <div className="text-xs text-muted">{t('leave.form.approvalRoute')}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-xs font-medium text-primary">
            {preview.approvalSteps.map((step, i) => (
              <span key={`${step}-${i}`} className="inline-flex items-center gap-1">
                {i > 0 && <ArrowRight className="h-3 w-3 text-muted" />}
                {approverLabel(t, step)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BalanceMeter({
  available,
  requested,
  after,
}: {
  available: number;
  requested: number;
  after: number;
}) {
  const { t, days } = useLeaveFormat();
  const scale = Math.max(available, requested, 1);
  const remainingPct = (Math.max(after, 0) / scale) * 100;
  const coveredPct = (Math.min(requested, Math.max(available, 0)) / scale) * 100;
  const overPct = (Math.max(requested - Math.max(available, 0), 0) / scale) * 100;
  const afterTone =
    after < 0 ? 'text-error-700 dark:text-error-300' : 'text-primary';

  return (
    <div className="space-y-2">
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-base))]"
        role="img"
        aria-label={`${t('leave.form.availableLabel')}: ${days(available)}, ${t('leave.form.afterApproval')}: ${days(after)}`}
      >
        <div className="h-full bg-accent-500 transition-all duration-300" style={{ width: `${remainingPct}%` }} />
        <div className="h-full bg-accent-200 transition-all duration-300 dark:bg-accent-800" style={{ width: `${coveredPct}%` }} />
        <div className="h-full bg-error-400 transition-all duration-300" style={{ width: `${overPct}%` }} />
      </div>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted">{t('leave.form.availableLabel')}</dt>
          <dd className="font-medium text-primary tabular-nums">{days(available)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted">{t('leave.form.thisRequest')}</dt>
          <dd className="font-medium text-primary tabular-nums">− {days(requested)}</dd>
        </div>
        <div className="flex justify-between gap-2 border-t border-base pt-1">
          <dt className="font-medium text-secondary">{t('leave.form.afterApproval')}</dt>
          <dd className={`font-semibold tabular-nums ${afterTone}`}>{days(after)}</dd>
        </div>
      </dl>
    </div>
  );
}
