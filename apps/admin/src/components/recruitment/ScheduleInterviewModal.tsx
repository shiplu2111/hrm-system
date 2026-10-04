import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { InterviewRoundRecord } from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Select } from '@/components/ui/Form';
import { scheduleInterviewRound } from '@/lib/recruitment-api';
import { ApiError } from '@/lib/tenant-api-client';
import {
  INTERVIEW_DURATION_OPTIONS,
  fromDateTimeInputs,
  isSafeMeetingUrl,
  toDateInput,
  toTimeInput,
} from './interview-ui';

export interface InterviewerOption {
  id: string;
  name: string;
}

interface FormState {
  date: string;
  time: string;
  durationMinutes: string;
  interviewerId: string;
  location: string;
  meetingUrl: string;
}

type FieldErrors = Partial<Record<'date' | 'time' | 'interviewerId' | 'meetingUrl', string>>;

function initialForm(round: InterviewRoundRecord): FormState {
  if (round.scheduledStartAt) {
    const start = new Date(round.scheduledStartAt);
    const minutes = round.scheduledEndAt
      ? Math.round((new Date(round.scheduledEndAt).getTime() - start.getTime()) / 60000)
      : 60;
    return {
      date: toDateInput(start),
      time: toTimeInput(start),
      durationMinutes: String(minutes > 0 ? minutes : 60),
      interviewerId: round.interviewerEmployeeId ?? '',
      location: round.location ?? '',
      meetingUrl: round.meetingUrl ?? '',
    };
  }
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    date: toDateInput(tomorrow),
    time: '10:00',
    durationMinutes: '60',
    interviewerId: round.interviewerEmployeeId ?? '',
    location: round.location ?? '',
    meetingUrl: round.meetingUrl ?? '',
  };
}

export function ScheduleInterviewModal({
  open,
  onClose,
  round,
  candidateName,
  interviewers,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  round: InterviewRoundRecord | null;
  candidateName?: string;
  interviewers: InterviewerOption[];
  onSaved: (record: InterviewRoundRecord) => void;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !round) return;
    setForm(initialForm(round));
    setErrors({});
    setSubmitError(null);
    setConflict(null);
  }, [open, round]);

  if (!round || !form) return null;

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setConflict(null);
  };

  const durationChoices = INTERVIEW_DURATION_OPTIONS.map(String).includes(form.durationMinutes)
    ? INTERVIEW_DURATION_OPTIONS.map(String)
    : [...INTERVIEW_DURATION_OPTIONS.map(String), form.durationMinutes];

  const submit = async (allowConflict: boolean) => {
    const nextErrors: FieldErrors = {};
    const start = fromDateTimeInputs(form.date, form.time);
    if (!form.date) nextErrors.date = 'Pick a date';
    if (!form.time) nextErrors.time = 'Pick a start time';
    else if (!start) nextErrors.time = 'Enter a valid time';
    if (!form.interviewerId) nextErrors.interviewerId = 'Assign an interviewer';
    if (form.meetingUrl.trim() && !isSafeMeetingUrl(form.meetingUrl)) {
      nextErrors.meetingUrl = 'Meeting link must start with http:// or https://';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !start) return;

    const end = new Date(start.getTime() + Number(form.durationMinutes) * 60000);
    setSaving(true);
    setSubmitError(null);
    try {
      const saved = await scheduleInterviewRound(round.id, {
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: end.toISOString(),
        interviewerEmployeeId: form.interviewerId,
        location: form.location.trim() || undefined,
        meetingUrl: form.meetingUrl.trim() || undefined,
        ...(allowConflict ? { allowConflict: true } : {}),
      });
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INTERVIEWER_CONFLICT') {
        setConflict(err.message);
      } else {
        setSubmitError(err instanceof ApiError ? err.message : 'Failed to schedule interview');
      }
    } finally {
      setSaving(false);
    }
  };

  const isReschedule = round.status === 'scheduled';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`${isReschedule ? 'Reschedule' : 'Schedule'} ${round.displayRound} interview`}
      description={
        candidateName
          ? `${candidateName} · round ${round.roundOrder} of 4. The interviewer is notified once saved.`
          : 'The interviewer is notified once saved.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {conflict ? (
            <Button variant="danger" onClick={() => void submit(true)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Schedule anyway
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void submit(false)} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isReschedule ? 'Save new time' : 'Schedule interview'}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {submitError && (
          <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-3 py-2 text-sm text-error-700 dark:text-error-300">
            {submitError}
          </div>
        )}
        {conflict && (
          <div className="rounded-lg border border-warning-200 bg-warning-50 dark:bg-warning-950/30 px-3 py-2 text-sm text-warning-800 dark:text-warning-200 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              {conflict}. Pick another time or interviewer, or schedule anyway to double-book.
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="int-date">Date</Label>
            <Input
              id="int-date"
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
            <FieldError message={errors.date} />
          </div>
          <div>
            <Label htmlFor="int-time">Start time</Label>
            <Input
              id="int-time"
              type="time"
              value={form.time}
              onChange={(e) => set('time', e.target.value)}
            />
            <FieldError message={errors.time} />
          </div>
          <div>
            <Label htmlFor="int-duration">Duration</Label>
            <Select
              id="int-duration"
              value={form.durationMinutes}
              onChange={(e) => set('durationMinutes', e.target.value)}
            >
              {durationChoices.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="int-interviewer">Interviewer</Label>
          <Select
            id="int-interviewer"
            value={form.interviewerId}
            onChange={(e) => set('interviewerId', e.target.value)}
          >
            <option value="">Select an employee</option>
            {interviewers.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
          <FieldError message={errors.interviewerId} />
          <p className="text-xs text-muted mt-1">
            The interviewer sees this round under Interviews and submits the scorecard there.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="int-location">Location</Label>
            <Input
              id="int-location"
              value={form.location}
              maxLength={200}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Room or office"
            />
          </div>
          <div>
            <Label htmlFor="int-url">Meeting link</Label>
            <Input
              id="int-url"
              value={form.meetingUrl}
              maxLength={500}
              onChange={(e) => set('meetingUrl', e.target.value)}
              placeholder="https://meet…"
            />
            <FieldError message={errors.meetingUrl} />
          </div>
        </div>
      </div>
    </Modal>
  );
}
