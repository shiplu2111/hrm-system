import { useEffect, useState } from 'react';
import { Clock, Send } from 'lucide-react';
import type {
  TimesheetProjectRecord,
  WorkflowApprovalRoute,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import type { CreateTimesheetEntryInput } from '@/lib/timesheets-api';
import { localDateTimeIso, toLocalIsoDate } from '@/lib/timesheet-display';

interface MyTimesheetEntryFormProps {
  employeeId: string;
  projects: TimesheetProjectRecord[];
  approvalRoute: WorkflowApprovalRoute | null;
  onCreate: (input: CreateTimesheetEntryInput) => Promise<void>;
}

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 9 * 60;
  return h * 60 + m;
}

function formatHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function computeNetHours(startTime: string, endTime: string, breakMins: number): number {
  const diff = parseMinutes(endTime) - parseMinutes(startTime) - breakMins;
  return Math.max(0, Math.round((diff / 60) * 100) / 100);
}

const HOUR_PRESETS = [1, 2, 4, 8];

export function MyTimesheetEntryForm({
  employeeId,
  projects,
  approvalRoute,
  onCreate,
}: MyTimesheetEntryFormProps) {
  const { t } = useAppTranslation();
  const [projectId, setProjectId] = useState('');
  const [entryDate, setEntryDate] = useState(() => toLocalIsoDate(new Date()));
  const [taskName, setTaskName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [breakMinutes, setBreakMinutes] = useState(0);
  const [hoursInput, setHoursInput] = useState('4');
  const [isBillable, setIsBillable] = useState(true);
  const [notes, setNotes] = useState('');
  const [submittingMode, setSubmittingMode] = useState<'draft' | 'submit' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId && projects.length > 0) {
      setProjectId(projects[0].id);
    }
  }, [projects, projectId]);

  const syncHoursToTimes = (hours: number, start = startTime, brk = breakMinutes) => {
    const startMins = parseMinutes(start);
    const neededEndMins = startMins + Math.round(hours * 60) + brk;
    if (neededEndMins <= 23 * 60 + 59) {
      setEndTime(formatHHMM(neededEndMins));
    } else {
      const shiftedStart = Math.max(0, 23 * 60 + 59 - Math.round(hours * 60) - brk);
      setStartTime(formatHHMM(shiftedStart));
      setEndTime('23:59');
    }
  };

  const handleHoursChange = (raw: string) => {
    setHoursInput(raw);
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0 && parsed <= 24) {
      syncHoursToTimes(parsed);
    }
  };

  const handleTimeOrBreakChange = (nextStart: string, nextEnd: string, nextBreak: number) => {
    setStartTime(nextStart);
    setEndTime(nextEnd);
    setBreakMinutes(nextBreak);
    const net = computeNetHours(nextStart, nextEnd, nextBreak);
    setHoursInput(net > 0 ? String(net) : '');
  };

  const handleSave = async (submit: boolean) => {
    if (!projectId) {
      setError(t('timesheet.validationProject'));
      return;
    }
    if (!taskName.trim()) {
      setError(t('timesheet.validationTask'));
      return;
    }
    const netHours = computeNetHours(startTime, endTime, breakMinutes);
    if (!Number.isFinite(netHours) || netHours <= 0 || netHours > 24) {
      setError(t('timesheet.validationHours'));
      return;
    }

    setSubmittingMode(submit ? 'submit' : 'draft');
    setError(null);
    try {
      await onCreate({
        employeeId,
        projectId,
        entryDate,
        taskName: taskName.trim(),
        startTime: localDateTimeIso(entryDate, startTime),
        endTime: localDateTimeIso(entryDate, endTime),
        breakMinutes,
        isBillable,
        notes: notes.trim() || undefined,
        submit,
      });
      setTaskName('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setSubmittingMode(null);
    }
  };

  const routeSteps =
    approvalRoute?.steps.map((s) => s.roleName ?? s.assigneeType).join(' → ') ?? '';

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent-600" />
          {t('timesheet.entryFormTitle')}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge tone={isBillable ? 'accent' : 'neutral'}>
            {isBillable ? t('timesheet.billableBadge') : t('timesheet.nonBillableBadge')}
          </Badge>
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700 dark:border-error-800 dark:bg-error-950/40 dark:text-error-300">
            {error}
          </div>
        ) : null}

        {projects.length === 0 ? (
          <p className="text-sm text-muted">{t('timesheet.noProjects')}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="ts-project">{t('timesheet.project')}</Label>
                <Select
                  id="ts-project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <option value="">{t('timesheet.selectProject')}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code ? `${p.code} — ${p.name}` : p.name}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <Label htmlFor="ts-date">{t('timesheet.date')}</Label>
                <Input
                  id="ts-date"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="ts-hours">{t('timesheet.hours')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="ts-hours"
                    type="number"
                    min="0.25"
                    max="24"
                    step="0.25"
                    value={hoursInput}
                    onChange={(e) => handleHoursChange(e.target.value)}
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    {HOUR_PRESETS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => handleHoursChange(String(h))}
                        className={`px-2 py-1.5 rounded-md border text-xs font-medium transition-colors ${
                          Number(hoursInput) === h
                            ? 'border-accent-300 bg-accent-50 text-accent-700 dark:border-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
                            : 'border-base surface text-secondary hover:text-primary'
                        }`}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="md:col-span-2">
                <Label htmlFor="ts-task">{t('timesheet.task')}</Label>
                <Input
                  id="ts-task"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder={t('timesheet.taskPlaceholder')}
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="ts-start">{t('timesheet.startTime')}</Label>
                  <Input
                    id="ts-start"
                    type="time"
                    value={startTime}
                    onChange={(e) =>
                      handleTimeOrBreakChange(e.target.value, endTime, breakMinutes)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="ts-end">{t('timesheet.endTime')}</Label>
                  <Input
                    id="ts-end"
                    type="time"
                    value={endTime}
                    onChange={(e) =>
                      handleTimeOrBreakChange(startTime, e.target.value, breakMinutes)
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="ts-break">{t('timesheet.breakMinutes')}</Label>
                  <Input
                    id="ts-break"
                    type="number"
                    min="0"
                    max="480"
                    value={breakMinutes}
                    onChange={(e) =>
                      handleTimeOrBreakChange(
                        startTime,
                        endTime,
                        Math.max(0, Number(e.target.value) || 0),
                      )
                    }
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-base px-3 py-2 min-h-[38px]">
                <span className="text-sm font-medium text-primary">
                  {t('timesheet.billable')}
                </span>
                <Toggle
                  checked={isBillable}
                  onChange={setIsBillable}
                  label={t('timesheet.billable')}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="ts-notes">{t('timesheet.notes')}</Label>
              <Textarea
                id="ts-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('timesheet.notesPlaceholder')}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-muted">
                {routeSteps ? t('timesheet.approvalPath', { steps: routeSteps }) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="secondary"
                  className="min-h-[44px]"
                  disabled={submittingMode !== null}
                  onClick={() => void handleSave(false)}
                >
                  {t('timesheet.saveDraft')}
                </Button>
                <Button
                  variant="primary"
                  className="min-h-[44px]"
                  disabled={submittingMode !== null}
                  onClick={() => void handleSave(true)}
                >
                  <Send className="h-4 w-4" />
                  {submittingMode === 'submit'
                    ? t('common.submitting')
                    : t('timesheet.submitForApproval')}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

