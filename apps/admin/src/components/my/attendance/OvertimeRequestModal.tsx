import { useEffect, useState } from 'react';
import { AlertCircle, Clock, Loader2 } from 'lucide-react';
import type {
  OvertimeRateType,
  OvertimeRequestRecord,
  WorkflowApprovalRoute,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { createMyOvertimeRequest, getOvertimeApprovalRoute } from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';

const RATE_TYPES: OvertimeRateType[] = ['weekday', 'weekend', 'holiday', 'night'];

function diffHours(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some(Number.isNaN)) return null;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return Math.round((mins / 60) * 100) / 100;
}

interface OvertimeRequestModalProps {
  open: boolean;
  employeeId: string;
  companyId: string;
  onClose: () => void;
  onSubmitted: (created: OvertimeRequestRecord) => void;
}

export function OvertimeRequestModal(props: OvertimeRequestModalProps) {
  if (!props.open) return null;
  return <OvertimeModalBody {...props} />;
}

function OvertimeModalBody({
  employeeId,
  companyId,
  onClose,
  onSubmitted,
}: OvertimeRequestModalProps) {
  const { t } = useAppTranslation();
  const [route, setRoute] = useState<WorkflowApprovalRoute | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [hours, setHours] = useState('2');
  const [rateType, setRateType] = useState<OvertimeRateType>('weekday');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getOvertimeApprovalRoute(companyId)
      .then((r) => {
        if (!cancelled) setRoute(r);
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const parsedHours = Number(hours);
  const canSubmit =
    !submitting &&
    Boolean(date) &&
    Number.isFinite(parsedHours) &&
    parsedHours >= 0.5 &&
    parsedHours <= 24 &&
    reason.trim().length > 0;

  function handleTimeChange(nextStart: string, nextEnd: string) {
    setStartTime(nextStart);
    setEndTime(nextEnd);
    const computed = diffHours(nextStart, nextEnd);
    if (computed !== null && computed >= 0.5 && computed <= 24) {
      setHours(String(computed));
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createMyOvertimeRequest(employeeId, {
        date,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        hours: parsedHours,
        rateType,
        reason: reason.trim(),
      });
      onSubmitted(created);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('common.unknownError'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={t('overtime.modalTitle')}
      description={t('overtime.modalSubtitle')}
      footer={
        <>
          <Button variant="secondary" className="min-h-[44px]" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            className="min-h-[44px]"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('overtime.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="ot-date">{t('overtime.date')}</Label>
            <Input
              id="ot-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ot-rate-type">{t('overtime.rateType')}</Label>
            <Select
              id="ot-rate-type"
              value={rateType}
              onChange={(e) => setRateType(e.target.value as OvertimeRateType)}
            >
              {RATE_TYPES.map((rt) => (
                <option key={rt} value={rt}>
                  {t(`overtime.rateTypes.${rt}`)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="ot-start">{t('overtime.startTime')}</Label>
            <Input
              id="ot-start"
              type="time"
              value={startTime}
              onChange={(e) => handleTimeChange(e.target.value, endTime)}
            />
          </div>
          <div>
            <Label htmlFor="ot-end">{t('overtime.endTime')}</Label>
            <Input
              id="ot-end"
              type="time"
              value={endTime}
              onChange={(e) => handleTimeChange(startTime, e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ot-hours">{t('overtime.hours')}</Label>
            <Input
              id="ot-hours"
              type="number"
              min="0.5"
              max="24"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="ot-reason">{t('overtime.reason')}</Label>
          <Textarea
            id="ot-reason"
            rows={3}
            maxLength={500}
            value={reason}
            placeholder={t('overtime.reasonPlaceholder')}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {route && route.steps.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-600" />
            <div>
              <span className="font-medium text-primary">{t('overtime.approvalRoute')}: </span>
              <span className="text-secondary">
                {route.steps.map((s) => s.roleName).join(' → ')}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

