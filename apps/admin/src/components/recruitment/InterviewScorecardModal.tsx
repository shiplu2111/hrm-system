import { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquarePlus, Star } from 'lucide-react';
import {
  INTERVIEW_RATING_MAX,
  INTERVIEW_RATING_MIN,
  INTERVIEW_RECOMMENDATIONS,
  INTERVIEW_SCORECARD_CRITERIA,
  interviewScorecardAverage,
  type CompleteInterviewRoundInput,
  type InterviewRecommendation,
  type InterviewRoundRecord,
} from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Textarea } from '@/components/ui/Form';
import { ApiError } from '@/lib/tenant-api-client';
import { RATING_LABELS } from './interview-ui';

const RATING_VALUES = Array.from(
  { length: INTERVIEW_RATING_MAX - INTERVIEW_RATING_MIN + 1 },
  (_, i) => INTERVIEW_RATING_MIN + i,
);

const RECOMMENDATION_STYLE: Record<InterviewRecommendation, string> = {
  strong_yes: 'border-success-500 bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300',
  yes: 'border-success-400 bg-success-50 text-success-700 dark:bg-success-950/40 dark:text-success-300',
  neutral: 'border-warning-400 bg-warning-50 text-warning-800 dark:bg-warning-950/40 dark:text-warning-200',
  no: 'border-error-400 bg-error-50 text-error-700 dark:bg-error-950/40 dark:text-error-300',
  strong_no: 'border-error-500 bg-error-50 text-error-700 dark:bg-error-950/40 dark:text-error-300',
};

interface CriterionState {
  rating: number | null;
  comment: string;
  showComment: boolean;
}

export function InterviewScorecardModal({
  open,
  onClose,
  round,
  candidateName,
  submit,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  round: InterviewRoundRecord | null;
  candidateName?: string;
  /** Recruiters complete via the recruitment endpoint; interviewers via /my-interviews. */
  submit: (roundId: string, input: CompleteInterviewRoundInput) => Promise<InterviewRoundRecord>;
  onSaved: (record: InterviewRoundRecord) => void;
}) {
  const criteria = useMemo(
    () => (round ? INTERVIEW_SCORECARD_CRITERIA[round.roundType] : []),
    [round],
  );
  const [ratings, setRatings] = useState<Record<string, CriterionState>>({});
  const [recommendation, setRecommendation] = useState<InterviewRecommendation | null>(null);
  const [strengths, setStrengths] = useState('');
  const [concerns, setConcerns] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errors, setErrors] = useState<{ ratings?: string; recommendation?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !round) return;
    setRatings(
      Object.fromEntries(
        criteria.map((c) => [c.key, { rating: null, comment: '', showComment: false }]),
      ),
    );
    setRecommendation(null);
    setStrengths('');
    setConcerns('');
    setFeedback('');
    setErrors({});
    setSubmitError(null);
  }, [open, round, criteria]);

  const rated = criteria.filter((c) => ratings[c.key]?.rating != null);
  const average = interviewScorecardAverage(
    rated.map((c) => ({ rating: ratings[c.key].rating as number })),
  );

  if (!round) return null;

  const update = (key: string, patch: Partial<CriterionState>) =>
    setRatings((current) => ({ ...current, [key]: { ...current[key], ...patch } }));

  const handleSubmit = async () => {
    const nextErrors: typeof errors = {};
    if (rated.length < criteria.length) {
      nextErrors.ratings = `Rate all ${criteria.length} criteria (${criteria.length - rated.length} left)`;
    }
    if (!recommendation) nextErrors.recommendation = 'Choose a recommendation';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !recommendation) return;

    setSaving(true);
    setSubmitError(null);
    try {
      const saved = await submit(round.id, {
        recommendation,
        ratings: criteria.map((c) => ({
          key: c.key,
          rating: ratings[c.key].rating as number,
          comment: ratings[c.key].comment.trim() || undefined,
        })),
        strengths: strengths.trim() || undefined,
        concerns: concerns.trim() || undefined,
        feedback: feedback.trim() || undefined,
      });
      onSaved(saved);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Failed to submit scorecard');
    } finally {
      setSaving(false);
    }
  };

  const isFinal = round.roundType === 'final_decision';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`${round.displayRound} scorecard`}
      description={
        candidateName
          ? `${candidateName} · rate each competency from ${INTERVIEW_RATING_MIN} (poor) to ${INTERVIEW_RATING_MAX} (exceptional).`
          : `Rate each competency from ${INTERVIEW_RATING_MIN} (poor) to ${INTERVIEW_RATING_MAX} (exceptional).`
      }
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm text-secondary">
            <Star className="h-4 w-4 text-warning-500" />
            {average != null ? (
              <span>
                Round score <span className="font-semibold text-primary">{average.toFixed(1)}</span>
                /5 · {rated.length}/{criteria.length} rated
              </span>
            ) : (
              <span>No ratings yet</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleSubmit()} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit scorecard
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {submitError && (
          <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-3 py-2 text-sm text-error-700 dark:text-error-300">
            {submitError}
          </div>
        )}

        <div className="space-y-2">
          {criteria.map((criterion) => {
            const state = ratings[criterion.key];
            if (!state) return null;
            return (
              <div key={criterion.key} className="rounded-lg border border-base p-3">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-primary">{criterion.label}</div>
                    <div className="text-xs text-secondary">{criterion.description}</div>
                  </div>
                  <div
                    className="flex items-center gap-1"
                    role="radiogroup"
                    aria-label={`${criterion.label} rating`}
                  >
                    {RATING_VALUES.map((value) => {
                      const selected = state.rating === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          title={RATING_LABELS[value]}
                          onClick={() => update(criterion.key, { rating: value })}
                          className={`h-9 w-9 rounded-md border text-sm font-semibold transition-colors ${
                            selected
                              ? 'border-accent-600 bg-accent-600 text-white'
                              : 'border-base text-secondary hover:border-accent-400 hover:text-primary'
                          }`}
                        >
                          {value}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => update(criterion.key, { showComment: !state.showComment })}
                      className={`ml-1 h-9 w-9 rounded-md flex items-center justify-center hover:bg-base/40 ${
                        state.comment.trim() ? 'text-accent-600' : 'text-muted'
                      }`}
                      title="Add a note for this criterion"
                      aria-label={`Add a note for ${criterion.label}`}
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted h-4">
                  {state.rating != null ? RATING_LABELS[state.rating] : ''}
                </div>
                {state.showComment && (
                  <Input
                    className="mt-2"
                    value={state.comment}
                    maxLength={1000}
                    onChange={(e) => update(criterion.key, { comment: e.target.value })}
                    placeholder={`Evidence for ${criterion.label.toLowerCase()}…`}
                  />
                )}
              </div>
            );
          })}
          <FieldError message={errors.ratings} />
        </div>

        <div>
          <Label>Recommendation</Label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-1" role="radiogroup">
            {INTERVIEW_RECOMMENDATIONS.map((option) => {
              const selected = recommendation === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setRecommendation(option.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? RECOMMENDATION_STYLE[option.value]
                      : 'border-base text-secondary hover:border-accent-400'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <FieldError message={errors.recommendation} />
          {isFinal && (
            <p className="text-xs text-muted mt-1.5">
              Final decision: Strong Yes / Yes moves the candidate to Offer; No / Strong No rejects
              the application. Neutral keeps it at Interview.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="sc-strengths">Strengths</Label>
            <Textarea
              id="sc-strengths"
              rows={3}
              maxLength={2000}
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder="What stood out positively"
            />
          </div>
          <div>
            <Label htmlFor="sc-concerns">Concerns</Label>
            <Textarea
              id="sc-concerns"
              rows={3}
              maxLength={2000}
              value={concerns}
              onChange={(e) => setConcerns(e.target.value)}
              placeholder="Gaps or risks to probe in later rounds"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="sc-feedback">Overall notes</Label>
          <Textarea
            id="sc-feedback"
            rows={3}
            maxLength={5000}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Summary for the hiring team"
          />
        </div>
      </div>
    </Modal>
  );
}
