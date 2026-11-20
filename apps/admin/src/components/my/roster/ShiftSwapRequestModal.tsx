import { useEffect, useState } from 'react';
import { AlertCircle, ArrowRightLeft, Loader2 } from 'lucide-react';
import type {
  EmployeeDirectoryEntry,
  RosterRecord,
  ShiftSwapRequestRecord,
  WorkflowApprovalRoute,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import {
  createMyShiftSwap,
  getShiftSwapApprovalRoute,
  listColleagues,
} from '@/lib/my-api';
import { ApiError } from '@/lib/tenant-api-client';

interface ShiftSwapRequestModalProps {
  open: boolean;
  employeeId: string;
  companyId: string;
  rosters: RosterRecord[];
  presetRosterId?: string | null;
  onClose: () => void;
  onSubmitted: (created: ShiftSwapRequestRecord) => void;
}

export function ShiftSwapRequestModal(props: ShiftSwapRequestModalProps) {
  if (!props.open) return null;
  return <ShiftSwapModalBody {...props} />;
}

function ShiftSwapModalBody({
  employeeId,
  companyId,
  rosters,
  presetRosterId,
  onClose,
  onSubmitted,
}: ShiftSwapRequestModalProps) {
  const { t } = useAppTranslation();
  const [colleagues, setColleagues] = useState<EmployeeDirectoryEntry[]>([]);
  const [route, setRoute] = useState<WorkflowApprovalRoute | null>(null);
  const [selectedRosterId, setSelectedRosterId] = useState<string>(presetRosterId ?? '');
  const [swapDate, setSwapDate] = useState<string>(() => {
    const matched = rosters.find((r) => r.id === presetRosterId);
    return matched?.date ?? rosters[0]?.date ?? new Date().toISOString().slice(0, 10);
  });
  const [targetDate, setTargetDate] = useState<string>(() => {
    const matched = rosters.find((r) => r.id === presetRosterId);
    return matched?.date ?? rosters[0]?.date ?? new Date().toISOString().slice(0, 10);
  });
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listColleagues(companyId).catch(() => [] as EmployeeDirectoryEntry[]),
      getShiftSwapApprovalRoute(companyId).catch(() => null),
    ]).then(([cols, r]) => {
      if (cancelled) return;
      const others = cols.filter((c) => c.id !== employeeId);
      setColleagues(others);
      setRoute(r);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId, employeeId]);

  const canSubmit =
    !submitting &&
    Boolean(targetEmployeeId) &&
    Boolean(swapDate) &&
    reason.trim().length > 0;

  function handleRosterSelect(rosterId: string) {
    setSelectedRosterId(rosterId);
    const matched = rosters.find((r) => r.id === rosterId);
    if (matched) {
      setSwapDate(matched.date);
      setTargetDate(matched.date);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createMyShiftSwap(employeeId, {
        targetEmployeeId,
        swapDate,
        targetDate: targetDate || swapDate,
        requesterRosterId: selectedRosterId || undefined,
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
      title={t('shiftSwap.modalTitle')}
      description={t('shiftSwap.modalSubtitle')}
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
            {t('shiftSwap.submit')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="swap-colleague">{t('shiftSwap.colleague')}</Label>
          <Select
            id="swap-colleague"
            value={targetEmployeeId}
            onChange={(e) => setTargetEmployeeId(e.target.value)}
          >
            <option value="">
              {colleagues.length === 0 ? t('shiftSwap.noColleagues') : t('shiftSwap.selectColleague')}
            </option>
            {colleagues.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
                {c.designation?.name ? ` — ${c.designation.name}` : ''}
              </option>
            ))}
          </Select>
        </div>

        {rosters.length > 0 && (
          <div>
            <Label htmlFor="swap-roster-select">{t('shiftSwap.yourShift')}</Label>
            <Select
              id="swap-roster-select"
              value={selectedRosterId}
              onChange={(e) => handleRosterSelect(e.target.value)}
            >
              <option value="">{t('shiftSwap.customDateOption')}</option>
              {rosters.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.display?.date ?? r.date} · {r.shift?.name ?? t('attendance.shiftFallback')} (
                  {r.display?.shiftStartTime ?? r.shift?.startTime} –{' '}
                  {r.display?.shiftEndTime ?? r.shift?.endTime})
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="swap-date">{t('shiftSwap.swapDate')}</Label>
            <Input
              id="swap-date"
              type="date"
              value={swapDate}
              disabled={Boolean(selectedRosterId)}
              onChange={(e) => {
                setSwapDate(e.target.value);
                if (!targetDate) setTargetDate(e.target.value);
              }}
            />
          </div>
          <div>
            <Label htmlFor="swap-target-date">{t('shiftSwap.targetDate')}</Label>
            <Input
              id="swap-target-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="swap-reason">{t('shiftSwap.reason')}</Label>
          <Textarea
            id="swap-reason"
            rows={3}
            maxLength={500}
            value={reason}
            placeholder={t('shiftSwap.reasonPlaceholder')}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {route && route.steps.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs">
            <ArrowRightLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-600" />
            <div>
              <span className="font-medium text-primary">{t('shiftSwap.approvalRoute')}: </span>
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

