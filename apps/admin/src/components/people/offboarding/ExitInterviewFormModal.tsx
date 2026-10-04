import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import {
  EXIT_INTERVIEW_RATING_AREAS,
  EXIT_INTERVIEW_RATING_AREA_LABELS,
  EXIT_REASON_CATEGORIES,
  EXIT_REASON_CATEGORY_LABELS,
  type EmployeeOffboardingRecord,
  type ExitInterviewRatingArea,
  type ExitInterviewRatings,
  type ExitInterviewRecord,
  type ExitReasonCategory,
  type SaveExitInterviewInput,
} from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { saveExitInterview } from '@/lib/offboarding-api';
import { toDateTimeLocal } from '@/lib/offboarding-display';
import { ApiError } from '@/lib/tenant-api-client';

type TriState = '' | 'yes' | 'no';

interface FormState {
  scheduledAt: string;
  conductedAt: string;
  interviewerEmployeeId: string;
  reasonCategory: ExitReasonCategory | '';
  reasonForLeaving: string;
  rating: number | null;
  ratings: ExitInterviewRatings;
  likedMost: string;
  improvementSuggestions: string;
  feedback: string;
  wouldRecommend: TriState;
  wouldRehire: TriState;
}

function toTriState(value: boolean | null): TriState {
  return value === null ? '' : value ? 'yes' : 'no';
}

function fromTriState(value: TriState): boolean | null {
  return value === '' ? null : value === 'yes';
}

function initialState(interview: ExitInterviewRecord | null): FormState {
  return {
    scheduledAt: toDateTimeLocal(interview?.scheduledAt ?? null),
    conductedAt: toDateTimeLocal(interview?.conductedAt ?? null),
    interviewerEmployeeId: interview?.interviewerEmployeeId ?? '',
    reasonCategory: interview?.reasonCategory ?? '',
    reasonForLeaving: interview?.reasonForLeaving ?? '',
    rating: interview?.rating ?? null,
    ratings: interview?.ratings ?? {},
    likedMost: interview?.likedMost ?? '',
    improvementSuggestions: interview?.improvementSuggestions ?? '',
    feedback: interview?.feedback ?? '',
    wouldRecommend: toTriState(interview?.wouldRecommend ?? null),
    wouldRehire: toTriState(interview?.wouldRehire ?? null),
  };
}

function RatingInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-primary">{label}</span>
      <div className="flex items-center gap-0.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((score) => {
          const active = value !== null && score <= value;
          return (
            <button
              key={score}
              type="button"
              role="radio"
              aria-checked={value === score}
              aria-label={`${score} of 5`}
              disabled={disabled}
              onClick={() => onChange(value === score ? null : score)}
              className="p-0.5 rounded disabled:cursor-not-allowed"
            >
              <Star
                className={`h-5 w-5 ${
                  active ? 'fill-warning-400 text-warning-500' : 'text-[rgb(var(--border-strong))]'
                }`}
              />
            </button>
          );
        })}
        <span className="w-8 text-right text-xs text-muted">{value ? `${value}/5` : '—'}</span>
      </div>
    </div>
  );
}

interface ExitInterviewFormModalProps {
  open: boolean;
  onClose: () => void;
  offboardingId: string;
  employeeName: string;
  interview: ExitInterviewRecord | null;
  interviewers: Array<{ id: string; fullName: string }>;
  readOnly: boolean;
  onSaved: (record: EmployeeOffboardingRecord, completedNow: boolean) => void | Promise<void>;
}

export function ExitInterviewFormModal({
  open,
  onClose,
  offboardingId,
  employeeName,
  interview,
  interviewers,
  readOnly,
  onSaved,
}: ExitInterviewFormModalProps) {
  const [form, setForm] = useState<FormState>(() => initialState(interview));
  const [saving, setSaving] = useState<'draft' | 'complete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initialState(interview));
      setError(null);
      setReasonError(false);
    }
  }, [open, interview]);

  const completed = interview?.status === 'completed';
  const interviewerOptions =
    interview?.interviewerEmployeeId &&
    !interviewers.some((person) => person.id === interview.interviewerEmployeeId)
      ? [
          {
            id: interview.interviewerEmployeeId,
            fullName: interview.interviewerName ?? 'Current interviewer',
          },
          ...interviewers,
        ]
      : interviewers;
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const setAreaRating = (area: ExitInterviewRatingArea, value: number | null) =>
    setForm((prev) => {
      const ratings = { ...prev.ratings };
      if (value === null) delete ratings[area];
      else ratings[area] = value;
      return { ...prev, ratings };
    });

  const submit = async (complete: boolean) => {
    if ((complete || completed) && !form.reasonCategory) {
      setReasonError(true);
      setError('Choose the main reason for leaving before completing the interview.');
      return;
    }
    setSaving(complete ? 'complete' : 'draft');
    setError(null);

    const input: SaveExitInterviewInput = {
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      interviewerEmployeeId: form.interviewerEmployeeId || null,
      reasonCategory: form.reasonCategory || null,
      reasonForLeaving: form.reasonForLeaving,
      rating: form.rating,
      ratings: form.ratings,
      likedMost: form.likedMost,
      improvementSuggestions: form.improvementSuggestions,
      feedback: form.feedback,
      wouldRecommend: fromTriState(form.wouldRecommend),
      wouldRehire: fromTriState(form.wouldRehire),
      complete,
    };
    if ((complete || completed) && form.conductedAt) {
      input.conductedAt = new Date(form.conductedAt).toISOString();
    }

    try {
      const record = await saveExitInterview(offboardingId, input);
      await onSaved(record, complete && !completed);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to save the exit interview');
    } finally {
      setSaving(null);
    }
  };

  const nowLocal = toDateTimeLocal(new Date().toISOString());

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`Exit interview · ${employeeName}`}
      description="Answers are visible to HR only. Completing the interview ticks off the exit interview step."
      footer={
        readOnly ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={saving !== null}>
              Cancel
            </Button>
            {completed ? (
              <Button onClick={() => void submit(false)} disabled={saving !== null}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => void submit(false)} disabled={saving !== null}>
                  {saving === 'draft' ? 'Saving…' : 'Save draft'}
                </Button>
                <Button onClick={() => void submit(true)} disabled={saving !== null}>
                  {saving === 'complete' ? 'Completing…' : 'Save & complete'}
                </Button>
              </>
            )}
          </>
        )
      }
    >
      <fieldset disabled={readOnly} className="space-y-6">
        {error ? (
          <div className="text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
            {error}
          </div>
        ) : null}

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Interview details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="exit-scheduled">Scheduled for</Label>
              <Input
                id="exit-scheduled"
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(e) => set('scheduledAt', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="exit-interviewer">Interviewer</Label>
              <Select
                id="exit-interviewer"
                value={form.interviewerEmployeeId}
                onChange={(e) => set('interviewerEmployeeId', e.target.value)}
              >
                <option value="">Not assigned</option>
                {interviewerOptions.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.fullName}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="exit-conducted">Conducted on</Label>
              <Input
                id="exit-conducted"
                type="datetime-local"
                max={nowLocal}
                value={form.conductedAt}
                onChange={(e) => set('conductedAt', e.target.value)}
              />
              <p className="text-xs text-muted mt-1">
                {completed ? 'Date the interview took place.' : 'Used when you complete; defaults to now.'}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Reason for leaving</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="exit-reason">Main reason *</Label>
              <Select
                id="exit-reason"
                value={form.reasonCategory}
                onChange={(e) => {
                  set('reasonCategory', e.target.value as ExitReasonCategory | '');
                  setReasonError(false);
                }}
              >
                <option value="">Select a reason…</option>
                {EXIT_REASON_CATEGORIES.map((key) => (
                  <option key={key} value={key}>
                    {EXIT_REASON_CATEGORY_LABELS[key]}
                  </option>
                ))}
              </Select>
              <FieldError message={reasonError ? 'Required to complete the interview' : undefined} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="exit-reason-detail">In their words</Label>
              <Textarea
                id="exit-reason-detail"
                rows={2}
                maxLength={2000}
                value={form.reasonForLeaving}
                onChange={(e) => set('reasonForLeaving', e.target.value)}
                placeholder="What led to the decision?"
              />
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Ratings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 rounded-lg border border-base px-4 py-2">
            <RatingInput
              label="Overall experience"
              value={form.rating}
              onChange={(value) => set('rating', value)}
              disabled={readOnly}
            />
            {EXIT_INTERVIEW_RATING_AREAS.map((area) => (
              <RatingInput
                key={area}
                label={EXIT_INTERVIEW_RATING_AREA_LABELS[area]}
                value={form.ratings[area] ?? null}
                onChange={(value) => setAreaRating(area, value)}
                disabled={readOnly}
              />
            ))}
          </div>
          <p className="text-xs text-muted">Click a star again to clear it. Unrated areas are left out of reports.</p>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Feedback</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="exit-liked">What did they value most?</Label>
              <Textarea
                id="exit-liked"
                rows={3}
                maxLength={4000}
                value={form.likedMost}
                onChange={(e) => set('likedMost', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="exit-improve">What should we improve?</Label>
              <Textarea
                id="exit-improve"
                rows={3}
                maxLength={4000}
                value={form.improvementSuggestions}
                onChange={(e) => set('improvementSuggestions', e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="exit-notes">Additional comments / interviewer notes</Label>
            <Textarea
              id="exit-notes"
              rows={3}
              maxLength={4000}
              value={form.feedback}
              onChange={(e) => set('feedback', e.target.value)}
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Outcome</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="exit-recommend">Would recommend us as an employer</Label>
              <Select
                id="exit-recommend"
                value={form.wouldRecommend}
                onChange={(e) => set('wouldRecommend', e.target.value as TriState)}
              >
                <option value="">Not answered</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="exit-rehire">Eligible for rehire</Label>
              <Select
                id="exit-rehire"
                value={form.wouldRehire}
                onChange={(e) => set('wouldRehire', e.target.value as TriState)}
              >
                <option value="">Not decided</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
              <p className="text-xs text-muted mt-1">HR’s assessment — not shared with the employee.</p>
            </div>
          </div>
        </section>
      </fieldset>
    </Modal>
  );
}
