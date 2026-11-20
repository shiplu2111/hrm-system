import { useEffect, useMemo, useState } from 'react';
import type {
  AttendanceRegisterDay,
  SubmitAttendanceCorrectionInput,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';

interface MyAttendanceCorrectionModalProps {
  open: boolean;
  onClose: () => void;
  initialDay: AttendanceRegisterDay | null;
  days: AttendanceRegisterDay[];
  todayKey: string;
  onSubmit: (input: SubmitAttendanceCorrectionInput) => Promise<void>;
}

function toTimeValue(displayTime: string | null | undefined): string {
  if (!displayTime) return '';
  const match = displayTime.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : '';
}

export function MyAttendanceCorrectionModal({
  open,
  onClose,
  initialDay,
  days,
  todayKey,
  onSubmit,
}: MyAttendanceCorrectionModalProps) {
  const { t } = useAppTranslation();
  const emDash = t('common.emDash');

  const [date, setDate] = useState(todayKey);
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [clockOutNextDay, setClockOutNextDay] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDayRecord = useMemo(
    () => days.find((d) => d.date === date) ?? null,
    [days, date],
  );

  useEffect(() => {
    if (!open) return;
    const targetDay = initialDay ?? days.find((d) => d.date === todayKey) ?? null;
    setDate(targetDay?.date ?? todayKey);
    setClockIn(toTimeValue(targetDay?.clockInDisplay) || '09:00');
    setClockOut(toTimeValue(targetDay?.clockOutDisplay) || '17:00');
    setClockOutNextDay(false);
    setReason('');
    setError(null);
  }, [open, initialDay, days, todayKey]);

  const presetReasons = [
    t('attendance.myPage.presetReasons.forgot'),
    t('attendance.myPage.presetReasons.biometric'),
    t('attendance.myPage.presetReasons.outdoor'),
    t('attendance.myPage.presetReasons.network'),
  ];

  const handleSubmit = async () => {
    if (!clockIn && !clockOut) {
      setError(t('attendance.myPage.correctionValidationTime'));
      return;
    }
    if (!reason.trim()) {
      setError(t('attendance.myPage.correctionValidationReason'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        date,
        ...(clockIn ? { clockIn } : {}),
        ...(clockOut ? { clockOut } : {}),
        clockOutNextDay,
        reason: reason.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('attendance.myPage.correctionModalTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={submitting}
            onClick={() => void handleSubmit()}
          >
            {submitting
              ? t('common.submitting')
              : t('attendance.myPage.correctionSubmit')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700 dark:border-error-800 dark:bg-error-950/40 dark:text-error-300">
            {error}
          </div>
        ) : null}

        <div>
          <Label htmlFor="my-correction-date">
            {t('attendance.myPage.correctionDate')}
          </Label>
          <Input
            id="my-correction-date"
            type="date"
            value={date}
            max={todayKey}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2.5 text-xs space-y-1">
          <div className="font-semibold text-secondary">
            {t('attendance.myPage.correctionCurrentTimes')}
          </div>
          <div className="flex items-center justify-between text-muted">
            <span>{t('attendance.myPage.colIn')}:</span>
            <span className="font-mono text-primary">
              {selectedDayRecord?.clockInDisplay ?? emDash}
            </span>
          </div>
          <div className="flex items-center justify-between text-muted">
            <span>{t('attendance.myPage.colOut')}:</span>
            <span className="font-mono text-primary">
              {selectedDayRecord?.clockOutDisplay ?? emDash}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="my-correction-in">
              {t('attendance.myPage.correctionClockIn')}
            </Label>
            <Input
              id="my-correction-in"
              type="time"
              value={clockIn}
              onChange={(e) => setClockIn(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="my-correction-out">
              {t('attendance.myPage.correctionClockOut')}
            </Label>
            <Input
              id="my-correction-out"
              type="time"
              value={clockOut}
              onChange={(e) => setClockOut(e.target.value)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={clockOutNextDay}
            onChange={(e) => setClockOutNextDay(e.target.checked)}
            className="rounded border-base text-accent-600 focus:ring-accent-500"
          />
          <span>{t('attendance.myPage.correctionNextDay')}</span>
        </label>

        <div>
          <Label>{t('attendance.myPage.correctionPreset')}</Label>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {presetReasons.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className="px-2.5 py-1 rounded-md border border-base surface text-xs text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="my-correction-reason">
            {t('attendance.myPage.correctionReason')}
          </Label>
          <Textarea
            id="my-correction-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('attendance.myPage.correctionReasonPlaceholder')}
          />
        </div>
      </div>
    </Modal>
  );
}

