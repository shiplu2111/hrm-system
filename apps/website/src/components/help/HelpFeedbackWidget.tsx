'use client';

import { LocaleLink } from '../marketing';
import { useEffect, useState } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { apiClient } from '../../api/client';
import { useWebsiteI18n } from '../../i18n/client';
import { Button } from '../marketing';

interface HelpFeedbackWidgetProps {
  slug: string;
  initialYes: number;
  initialNo: number;
}

export function HelpFeedbackWidget({
  slug,
  initialYes,
  initialNo,
}: HelpFeedbackWidgetProps) {
  const { t } = useWebsiteI18n();
  const [yesCount, setYesCount] = useState(initialYes);
  const [noCount, setNoCount] = useState(initialNo);
  const [choice, setChoice] = useState<'yes' | 'no' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Record a non-blocking view beacon once when rendered on client
  useEffect(() => {
    void apiClient.knowledgeBase.trackView(slug);
  }, [slug]);

  const handleVote = async (helpful: boolean) => {
    if (submitting || choice !== null) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await apiClient.knowledgeBase.submitFeedback(slug, helpful);
      setYesCount(updated.helpfulYesCount);
      setNoCount(updated.helpfulNoCount);
      setChoice(helpful ? 'yes' : 'no');
    } catch {
      setError(t('help.articlePage.feedbackError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="help-feedback-widget"
      className="surface rounded-2xl border border-[rgb(var(--border-base))] p-5 sm:p-6 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm sm:text-base font-bold text-[rgb(var(--text-primary))]">
            {t('help.articlePage.feedbackHeading')}
          </h2>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            {t('help.articlePage.feedbackStats', { yes: yesCount, no: noCount })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant={choice === 'yes' ? 'primary' : 'outline'}
            size="sm"
            disabled={submitting || choice !== null}
            data-testid="help-feedback-yes"
            onClick={() => void handleVote(true)}
            leadingIcon={<ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            {t('help.articlePage.feedbackYes')}
          </Button>
          <Button
            type="button"
            variant={choice === 'no' ? 'primary' : 'outline'}
            size="sm"
            disabled={submitting || choice !== null}
            data-testid="help-feedback-no"
            onClick={() => void handleVote(false)}
            leadingIcon={<ThumbsDown className="w-3.5 h-3.5" aria-hidden="true" />}
          >
            {t('help.articlePage.feedbackNo')}
          </Button>
        </div>
      </div>

      {choice === 'yes' && (
        <p data-testid="help-feedback-thanks" className="text-xs sm:text-sm text-success-700 font-medium">
          {t('help.articlePage.feedbackThanksYes')}
        </p>
      )}

      {choice === 'no' && (
        <p data-testid="help-feedback-thanks" className="text-xs sm:text-sm text-[rgb(var(--text-secondary))]">
          {t('help.articlePage.feedbackThanksNo')}{' '}
          <LocaleLink href="/contact?topic=support" className="font-semibold text-primary-600 hover:underline">
            {t('help.articlePage.existingCustomerCta')}
          </LocaleLink>
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-error-700">
          {error}
        </p>
      )}
    </div>
  );
}
