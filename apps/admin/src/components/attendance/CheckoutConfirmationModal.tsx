import { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coffee,
  Hourglass,
  TrendingUp,
  User,
  ShieldAlert,
} from 'lucide-react';
import type { AttendanceDayRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Label, Select, Textarea } from '@/components/ui/Form';
import {
  assessCheckout,
  EARLY_LEAVE_REASONS,
  type CheckoutAssessment,
} from '@/lib/attendance-checkout-helper';

export interface CheckoutConfirmationData {
  reasonId?: string;
  note?: string;
}

export interface CheckoutConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: CheckoutConfirmationData) => Promise<void> | void;
  record: AttendanceDayRecord | null | undefined;
  employeeName?: string;
  overrideTimestamp?: string;
  loading?: boolean;
}

export function CheckoutConfirmationModal({
  open,
  onClose,
  onConfirm,
  record,
  employeeName,
  overrideTimestamp,
  loading = false,
}: CheckoutConfirmationModalProps) {
  const { t, i18n } = useAppTranslation();
  const isBn = i18n.language === 'bn';

  const [reasonId, setReasonId] = useState('');
  const [note, setNote] = useState('');
  const [assessment, setAssessment] = useState<CheckoutAssessment>(() =>
    assessCheckout(record, overrideTimestamp),
  );

  // Recalculate whenever open state, record, or overrideTimestamp changes
  useEffect(() => {
    if (open) {
      setAssessment(assessCheckout(record, overrideTimestamp));
      setReasonId('');
      setNote('');
    }
  }, [open, record, overrideTimestamp]);

  if (!open) return null;

  const {
    isEarlyLeave,
    earlyFormatted,
    isOvertime,
    overtimeFormatted,
    netFormatted,
    grossFormatted,
    breakFormatted,
    isHalfDayRisk,
    halfDayThresholdMinutes,
    shiftName,
    shiftStartTime,
    shiftEndTime,
    graceMinutes,
    checkoutTimeDisplay,
  } = assessment;

  const handleConfirm = async () => {
    await onConfirm({
      reasonId: reasonId.trim() || undefined,
      note: note.trim() || undefined,
    });
  };

  const title = isEarlyLeave
    ? t('attendance.checkoutModal.earlyLeaveTitle', { defaultValue: 'Early Leave Warning' })
    : t('attendance.checkoutModal.title', { defaultValue: 'Confirm Clock Out' });

  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={title}
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
          >
            {t('attendance.checkoutModal.cancelButton', { defaultValue: 'Cancel / Keep Working' })}
          </Button>

          <Button
            variant={isEarlyLeave ? 'primary' : 'primary'}
            className={isEarlyLeave ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
            onClick={() => void handleConfirm()}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Working…
              </span>
            ) : isEarlyLeave ? (
              t('attendance.checkoutModal.confirmEarlyButton', { defaultValue: 'Confirm Early Checkout' })
            ) : (
              t('attendance.checkoutModal.confirmButton', { defaultValue: 'Confirm Clock Out' })
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Status Callout Banner */}
        {isEarlyLeave ? (
          <div className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/80 dark:bg-amber-950/30 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
                    {t('attendance.checkoutModal.earlyLeaveBadge', { defaultValue: 'Early Departure' })}
                  </h3>
                  <Badge tone="warning" className="font-semibold">
                    {earlyFormatted} {isBn ? 'পূর্বে' : 'early'}
                  </Badge>
                </div>
                <p className="text-xs text-amber-800/90 dark:text-amber-300/90 mt-1">
                  {t('attendance.checkoutModal.earlyLeaveNotice', {
                    defaultValue: 'You are clocking out before your scheduled shift end time.',
                  })}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  {isBn
                    ? `শিফট শেষ হওয়ার কথা ${shiftEndTime}-এ (গ্রেইস পিরিয়ড: ${graceMinutes} মি.)।`
                    : `Shift ends at ${shiftEndTime} (Grace period: ${graceMinutes}m).`}
                </p>
              </div>
            </div>
          </div>
        ) : isOvertime ? (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50/80 dark:bg-indigo-950/30 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-indigo-900 dark:text-indigo-200 text-sm">
                    {t('attendance.checkoutModal.overtimeBadge', { defaultValue: 'Overtime Logged' })}
                  </h3>
                  <Badge tone="accent">
                    +{overtimeFormatted} OT
                  </Badge>
                </div>
                <p className="text-xs text-indigo-800/90 dark:text-indigo-300/90 mt-1">
                  {isBn
                    ? `আপনি আজকের শিফট সফলভাবে সম্পন্ন করেছেন এবং অতিরিক্ত ${overtimeFormatted} কাজ করেছেন।`
                    : `You have completed your shift and logged ${overtimeFormatted} of overtime.`}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/80 dark:bg-emerald-950/30 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 text-sm">
                    {t('attendance.checkoutModal.onTimeBadge', { defaultValue: 'Shift Completed' })}
                  </h3>
                  <Badge tone="success">
                    {isBn ? 'অন-টাইম' : 'On Schedule'}
                  </Badge>
                </div>
                <p className="text-xs text-emerald-800/90 dark:text-emerald-300/90 mt-1">
                  {t('attendance.checkoutModal.onTimeNotice', {
                    defaultValue: 'Great job! You have completed your scheduled shift hours.',
                  })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Employee Pill if provided (e.g. in Admin View) */}
        {employeeName && (
          <div className="flex items-center gap-2 text-xs font-medium text-secondary bg-surface-secondary px-3 py-2 rounded-lg border border-base">
            <User className="h-3.5 w-3.5 text-muted" />
            <span>{isBn ? 'কর্মকর্তা / কর্মচারী:' : 'Employee:'} <strong className="text-primary">{employeeName}</strong></span>
          </div>
        )}

        {/* Breakdown Metric Tiles */}
        <div className="grid grid-cols-2 gap-2.5 text-xs">
          <div className="surface border border-base rounded-lg p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-muted">
              <Clock className="h-3.5 w-3.5" />
              <span>{t('attendance.checkoutModal.scheduledShift', { defaultValue: 'Scheduled Shift' })}</span>
            </div>
            <div className="font-semibold text-primary">{shiftName}</div>
            <div className="text-secondary">{shiftStartTime} – {shiftEndTime}</div>
          </div>

          <div className="surface border border-base rounded-lg p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-muted">
              <Hourglass className="h-3.5 w-3.5" />
              <span>{t('attendance.checkoutModal.checkoutTime', { defaultValue: 'Checkout Time' })}</span>
            </div>
            <div className="font-semibold text-primary">{checkoutTimeDisplay}</div>
            <div className="text-secondary">
              {isEarlyLeave ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">-{earlyFormatted} remaining</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Completed</span>
              )}
            </div>
          </div>

          <div className="surface border border-base rounded-lg p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-muted">
              <Clock className="h-3.5 w-3.5" />
              <span>{t('attendance.checkoutModal.workedToday', { defaultValue: 'Worked Today' })}</span>
            </div>
            <div className="font-semibold text-primary text-sm">{netFormatted}</div>
            <div className="text-muted">Gross {grossFormatted}</div>
          </div>

          <div className="surface border border-base rounded-lg p-2.5 space-y-1">
            <div className="flex items-center gap-1.5 text-muted">
              <Coffee className="h-3.5 w-3.5" />
              <span>{t('attendance.checkoutModal.breaksTaken', { defaultValue: 'Breaks Taken' })}</span>
            </div>
            <div className="font-semibold text-primary text-sm">{breakFormatted}</div>
            <div className="text-muted">
              {Array.isArray(record?.breaks) ? `${record?.breaks.length} sessions` : '0 sessions'}
            </div>
          </div>
        </div>

        {/* Half-Day Risk Warning if worked under half day threshold */}
        {isHalfDayRisk && (
          <div className="flex items-start gap-2.5 rounded-lg border border-warning-200 bg-warning-50/70 dark:bg-warning-950/20 px-3 py-2.5 text-xs text-warning-800 dark:text-warning-300">
            <ShieldAlert className="h-4 w-4 shrink-0 text-warning-600 dark:text-warning-400 mt-0.5" />
            <div>
              <p className="font-medium">
                {t('attendance.checkoutModal.halfDayWarning', {
                  defaultValue:
                    'Warning: Net working time is below the standard half-day threshold. This day may be recorded as a Half Day.',
                })}
              </p>
              <p className="text-[11px] text-warning-700/80 dark:text-warning-400/80 mt-0.5">
                {isBn
                  ? `হাফ-ডে ন্যূনতম সময়: ${Math.floor(halfDayThresholdMinutes / 60)} ঘণ্টা। আপনার বর্তমান সময়: ${netFormatted}।`
                  : `Half-day standard threshold: ${Math.floor(halfDayThresholdMinutes / 60)}h. Your current worked time: ${netFormatted}.`}
              </p>
            </div>
          </div>
        )}

        {/* Early Leave Reason Selection (Only visible if leaving early) */}
        {isEarlyLeave && (
          <div className="space-y-3 pt-2 border-t border-base">
            <div>
              <Label htmlFor="early-leave-reason">
                {t('attendance.checkoutModal.selectReason', { defaultValue: 'Reason for early departure (optional)' })}
              </Label>
              <Select
                id="early-leave-reason"
                value={reasonId}
                onChange={(e) => setReasonId(e.target.value)}
              >
                <option value="">
                  {t('attendance.checkoutModal.selectReasonPlaceholder', { defaultValue: 'Select a reason…' })}
                </option>
                {EARLY_LEAVE_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {isBn ? r.labelBn : r.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="early-leave-note">
                {t('attendance.checkoutModal.optionalNotes', { defaultValue: 'Additional remarks or notes (optional)' })}
              </Label>
              <Textarea
                id="early-leave-note"
                rows={2}
                placeholder={t('attendance.checkoutModal.notesPlaceholder', {
                  defaultValue: 'Add any notes for HR / Manager…',
                })}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Bottom confirmation question */}
        <div className="text-center pt-1">
          <p className="text-xs font-medium text-secondary">
            {t('attendance.checkoutModal.confirmQuestion', {
              defaultValue: 'Are you sure you want to clock out now?',
            })}
          </p>
        </div>
      </div>
    </Modal>
  );
}
