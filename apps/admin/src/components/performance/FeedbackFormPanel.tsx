import { useEffect, useMemo, useState } from 'react';
import { EyeOff, Loader2, Lock, MessageSquareText, UserRoundPen } from 'lucide-react';
import type { Performance360FeedbackRecord } from '@hrm/shared-types';
import { useAuth } from '@hrm/portal-ui';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Label, Textarea } from '@/components/ui/Form';
import { SidePanel } from '@/components/ui/SidePanel';
import {
  FEEDBACK_360_RELATIONSHIP_LABELS,
  get360Feedback,
  save360Feedback,
  submit360Feedback,
  type Save360FeedbackInput,
} from '@/lib/performance-api';
import { Banner, COMPETENCY_DETAILS, errorMessage, formatDay, RatingScale } from './performance-ui';

interface FeedbackFormPanelProps {
  feedbackId: string | null;
  onClose: () => void;
  onChanged: (record: Performance360FeedbackRecord) => void;
}

function toInput(record: Performance360FeedbackRecord): Save360FeedbackInput {
  return {
    competencyRatings: record.competencyRatings.map((item) => ({ key: item.key, rating: item.rating })),
    comment: record.comment,
  };
}

/** The peer-input form: one 1–5 rating per competency plus an optional comment. */
export function FeedbackFormPanel({ feedbackId, onClose, onChanged }: FeedbackFormPanelProps) {
  const { user } = useAuth();
  const [record, setRecord] = useState<Performance360FeedbackRecord | null>(null);
  const [draft, setDraft] = useState<Save360FeedbackInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!feedbackId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotice(null);
    setRecord(null);
    setDraft(null);
    get360Feedback(feedbackId)
      .then((row) => {
        if (cancelled) return;
        setRecord(row);
        setDraft(toInput(row));
      })
      .catch((err) => !cancelled && setError(errorMessage(err, 'Failed to load the feedback form')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [feedbackId]);

  const dirty = useMemo(
    () => Boolean(record && draft && JSON.stringify(toInput(record)) !== JSON.stringify(draft)),
    [record, draft],
  );
  const missing = draft
    ? record?.competencyRatings.filter((item, index) => draft.competencyRatings[index]?.rating == null) ?? []
    : [];
  const editable = Boolean(record?.editable);
  const onBehalf = Boolean(record && user?.employeeId !== record.reviewerEmployeeId);

  const close = () => (dirty ? setConfirmDiscard(true) : onClose());

  const setRating = (key: string, rating: number) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            competencyRatings: current.competencyRatings.map((item) => (item.key === key ? { ...item, rating } : item)),
          }
        : current,
    );

  const save = async () => {
    if (!record || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await save360Feedback(record.id, draft);
      setRecord(updated);
      setDraft(toInput(updated));
      setNotice('Draft saved.');
      onChanged(updated);
    } catch (err) {
      setError(errorMessage(err, 'Failed to save the draft'));
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (!record || !draft) return;
    const updated = await submit360Feedback(record.id, draft);
    onChanged(updated);
    onClose();
  };

  return (
    <>
      <SidePanel
        open={Boolean(feedbackId)}
        onClose={close}
        size="lg"
        title={record ? `Feedback for ${record.subjectName}` : '360° feedback'}
        description={
          record
            ? `${record.subjectDesignationName ?? record.subjectNumber} · ${record.reviewCycleName} · as ${FEEDBACK_360_RELATIONSHIP_LABELS[
                record.relationship
              ].toLowerCase()}`
            : undefined
        }
        icon={
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/40">
            <MessageSquareText className="h-5 w-5" />
          </div>
        }
        footer={
          editable ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-secondary">
                {record ? `${record.competencyRatings.length - missing.length} of ${record.competencyRatings.length} rated` : ''}
              </span>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void save()} disabled={!dirty || saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save draft
                </Button>
                <Button
                  onClick={() => setConfirmSubmit(true)}
                  disabled={saving || missing.length > 0}
                  title={missing.length > 0 ? `Still unrated: ${missing.map((item) => item.label).join(', ')}` : undefined}
                >
                  Submit feedback
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          )
        }
      >
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-secondary">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : record && draft ? (
          <div className="space-y-4">
            {error ? <Banner icon={Lock} tone="error">{error}</Banner> : null}
            {notice && !dirty ? (
              <p role="status" className="text-sm text-success-700 dark:text-success-300">
                {notice}
              </p>
            ) : null}
            {record.status === 'submitted' ? (
              <Banner icon={Lock}>
                Submitted {record.submittedAt ? formatDay(record.submittedAt) : ''}. Feedback can’t change once it is
                submitted.
              </Banner>
            ) : !editable ? (
              <Banner icon={Lock} tone="warning">
                Feedback for this review has closed, because the manager has submitted their assessment or the cycle is
                no longer in progress.
              </Banner>
            ) : (
              <Banner icon={EyeOff}>
                Answers are anonymous. {record.subjectName} and their manager only see averages, and only once at least
                two people have responded. Reviews are due {formatDay(record.reviewDueDate)}.
              </Banner>
            )}
            {onBehalf && editable ? (
              <Banner icon={UserRoundPen} tone="warning">
                You are entering this for {record.reviewerName}. Once submitted, nobody, including you, can open their
                answers again.
              </Banner>
            ) : null}

            <section className="divide-y divide-[rgb(var(--border-base))] rounded-xl border border-base">
              {record.competencyRatings.map((competency, index) => (
                <div key={competency.key} className="flex flex-col justify-between gap-3 p-4 md:flex-row md:items-start">
                  <div className="max-w-sm">
                    <div className="text-sm font-medium text-primary">{competency.label}</div>
                    <p className="mt-1 text-xs leading-5 text-secondary">{COMPETENCY_DETAILS[competency.key] ?? ''}</p>
                  </div>
                  <RatingScale
                    label={`Rating for ${competency.label}`}
                    value={draft.competencyRatings[index]?.rating ?? null}
                    disabled={!editable}
                    onChange={(rating) => setRating(competency.key, rating)}
                  />
                </div>
              ))}
            </section>

            <div>
              <Label htmlFor="feedback-comment">Comments</Label>
              <Textarea
                id="feedback-comment"
                rows={4}
                maxLength={2000}
                disabled={!editable}
                value={draft.comment ?? ''}
                placeholder="What should they keep doing, and what would make them more effective? Avoid details that identify you."
                onChange={(e) => setDraft((current) => (current ? { ...current, comment: e.target.value } : current))}
              />
            </div>
          </div>
        ) : error ? (
          <Banner icon={Lock} tone="error">
            {error}
          </Banner>
        ) : null}
      </SidePanel>

      <ConfirmDialog
        open={confirmSubmit}
        title={record ? `Submit feedback for ${record.subjectName}?` : 'Submit feedback?'}
        description="Submitted feedback is final and anonymous; it can’t be changed or reopened."
        confirmLabel="Submit feedback"
        tone="primary"
        onConfirm={submit}
        onClose={() => setConfirmSubmit(false)}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard unsaved changes?"
        description="Your latest ratings and comments haven’t been saved."
        confirmLabel="Discard"
        onConfirm={async () => onClose()}
        onClose={() => setConfirmDiscard(false)}
      />
    </>
  );
}
