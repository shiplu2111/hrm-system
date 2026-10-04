import { Star } from 'lucide-react';
import type { InterviewRoundRecord } from '@hrm/shared-types';
import { Badge } from '@/components/ui/Badge';
import { RATING_LABELS, RECOMMENDATION_TONE, criterionLabel } from './interview-ui';

export function InterviewScorecardView({ round }: { round: InterviewRoundRecord }) {
  const { scorecard } = round;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Star className="h-4 w-4 text-warning-500" />
        <span className="font-semibold text-primary">
          {round.score != null ? round.score.toFixed(1) : '—'}/5
        </span>
        {round.recommendation && round.displayRecommendation && (
          <Badge tone={RECOMMENDATION_TONE[round.recommendation]}>
            {round.displayRecommendation}
          </Badge>
        )}
        {(round.completedByName || round.completedAt) && (
          <span className="text-xs text-muted">
            {round.completedByName ? `by ${round.completedByName}` : ''}
            {round.completedAt
              ? ` · ${new Date(round.completedAt).toLocaleDateString()}`
              : ''}
          </span>
        )}
      </div>

      {scorecard && scorecard.ratings.length > 0 && (
        <div className="space-y-2">
          {scorecard.ratings.map((r) => (
            <div key={r.key}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-secondary">{criterionLabel(round.roundType, r.key)}</span>
                <span className="font-medium text-primary">
                  {r.rating}/5 · {RATING_LABELS[r.rating] ?? ''}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-base/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-500"
                  style={{ width: `${(r.rating / 5) * 100}%` }}
                />
              </div>
              {r.comment && (
                <p className="mt-1 text-xs text-muted whitespace-pre-wrap">{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {scorecard?.strengths && (
        <div>
          <div className="text-xs font-medium text-success-700 dark:text-success-300">Strengths</div>
          <p className="text-xs text-secondary whitespace-pre-wrap">{scorecard.strengths}</p>
        </div>
      )}
      {scorecard?.concerns && (
        <div>
          <div className="text-xs font-medium text-error-700 dark:text-error-300">Concerns</div>
          <p className="text-xs text-secondary whitespace-pre-wrap">{scorecard.concerns}</p>
        </div>
      )}
      {round.feedback && (
        <div>
          <div className="text-xs font-medium text-primary">Notes</div>
          <p className="text-xs text-secondary whitespace-pre-wrap">{round.feedback}</p>
        </div>
      )}
    </div>
  );
}
