import { useCallback, useEffect, useState } from 'react';
import {
  Calendar,
  CalendarX,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  MapPin,
  SkipForward,
  User,
} from 'lucide-react';
import type {
  CompleteInterviewRoundInput,
  InterviewRoundRecord,
  JobApplicationRecord,
} from '@hrm/shared-types';
import { usePermissions } from '@hrm/portal-ui';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  cancelInterviewRound,
  completeInterviewRound,
  completeMyInterview,
  getRecruitmentLookups,
  listInterviewRounds,
  skipInterviewRound,
} from '@/lib/recruitment-api';
import { ApiError } from '@/lib/tenant-api-client';
import { InterviewScorecardModal } from './InterviewScorecardModal';
import { InterviewScorecardView } from './InterviewScorecardView';
import { ScheduleInterviewModal, type InterviewerOption } from './ScheduleInterviewModal';
import { ROUND_STATUS_TONE, formatInterviewWhen, isSafeMeetingUrl } from './interview-ui';

export function InterviewRoundsPanel({
  application,
  onUpdated,
}: {
  application: JobApplicationRecord;
  onUpdated: () => void;
}) {
  const { user, can } = usePermissions();
  const canEdit = can('recruitment', 'edit');
  const canApprove = can('recruitment', 'approve');
  const editable = application.stage === 'interview';

  const [rounds, setRounds] = useState<InterviewRoundRecord[]>([]);
  const [interviewers, setInterviewers] = useState<InterviewerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduling, setScheduling] = useState<InterviewRoundRecord | null>(null);
  const [scoring, setScoring] = useState<InterviewRoundRecord | null>(null);
  const [cancelling, setCancelling] = useState<InterviewRoundRecord | null>(null);
  const [skipping, setSkipping] = useState<InterviewRoundRecord | null>(null);

  const loadRounds = useCallback(async () => {
    setError(null);
    try {
      setRounds(await listInterviewRounds(application.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load interview rounds');
    } finally {
      setLoading(false);
    }
  }, [application.id]);

  useEffect(() => {
    void loadRounds();
  }, [loadRounds]);

  useEffect(() => {
    if (!canEdit || !editable) return;
    getRecruitmentLookups(application.companyId)
      .then((lookups) =>
        setInterviewers(
          lookups.employees.map((e) => ({ id: e.id, name: `${e.name} · ${e.employeeNumber}` })),
        ),
      )
      .catch(() => setInterviewers([]));
  }, [application.companyId, canEdit, editable]);

  const afterChange = async () => {
    await loadRounds();
    onUpdated();
  };

  const isNextInLine = (index: number): boolean =>
    rounds
      .slice(0, index)
      .every((r) => r.status === 'completed' || r.status === 'skipped');

  const canScore = (round: InterviewRoundRecord) =>
    canEdit || (!!user?.employeeId && round.interviewerEmployeeId === user.employeeId);

  const submitScorecard = (roundId: string, input: CompleteInterviewRoundInput) => {
    const round = rounds.find((r) => r.id === roundId);
    const asInterviewer =
      !canEdit && !!round && round.interviewerEmployeeId === user?.employeeId;
    return asInterviewer
      ? completeMyInterview(roundId, input)
      : completeInterviewRound(roundId, input);
  };

  if (loading) {
    return (
      <Card>
        <CardBody className="flex items-center gap-2 text-secondary text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading interview rounds…
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Interview rounds</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {error && (
            <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-3 py-2 text-sm text-error-700 dark:text-error-300">
              {error}
            </div>
          )}
          <p className="text-xs text-secondary">
            Technical → HR → Management → Final Decision. Each round is scored on its own
            scorecard; the Final Decision recommendation moves the candidate to Offer or Rejected.
          </p>
          {!editable && (
            <p className="text-xs text-muted">
              Rounds are read-only because the application is no longer at the Interview stage.
            </p>
          )}

          <ol className="space-y-3">
            {rounds.map((round, index) => {
              const open = round.status === 'pending' || round.status === 'scheduled';
              const actionable = editable && open && isNextInLine(index);
              return (
                <li key={round.id} className="rounded-lg border border-base p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="font-medium text-primary">
                        {round.roundOrder}. {round.displayRound}
                      </div>
                      {round.status === 'scheduled' && (
                        <>
                          <div className="text-xs text-secondary flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatInterviewWhen(round.scheduledStartAt, round.scheduledEndAt)}
                          </div>
                          {round.interviewerName && (
                            <div className="text-xs text-secondary flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" /> {round.interviewerName}
                            </div>
                          )}
                          {round.location && (
                            <div className="text-xs text-secondary flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" /> {round.location}
                            </div>
                          )}
                          {round.meetingUrl && isSafeMeetingUrl(round.meetingUrl) && (
                            <a
                              href={round.meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-accent-600 hover:underline inline-flex items-center gap-1"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Join meeting
                            </a>
                          )}
                        </>
                      )}
                      {round.status === 'skipped' && round.feedback && (
                        <div className="text-xs text-muted">{round.feedback}</div>
                      )}
                    </div>
                    <Badge tone={ROUND_STATUS_TONE[round.status]}>{round.displayStatus}</Badge>
                  </div>

                  {round.status === 'completed' && (
                    <div className="rounded-md bg-base/30 p-3">
                      <InterviewScorecardView round={round} />
                    </div>
                  )}

                  {actionable && (
                    <div className="flex flex-wrap gap-2">
                      {canEdit && (
                        <Button variant="secondary" size="sm" onClick={() => setScheduling(round)}>
                          <Calendar className="h-3.5 w-3.5" />
                          {round.status === 'scheduled' ? 'Reschedule' : 'Schedule'}
                        </Button>
                      )}
                      {canScore(round) && (
                        <Button variant="primary" size="sm" onClick={() => setScoring(round)}>
                          <ClipboardCheck className="h-3.5 w-3.5" /> Submit scorecard
                        </Button>
                      )}
                      {canEdit && round.status === 'scheduled' && (
                        <Button variant="ghost" size="sm" onClick={() => setCancelling(round)}>
                          <CalendarX className="h-3.5 w-3.5" /> Cancel interview
                        </Button>
                      )}
                      {canApprove && round.status === 'pending' && index > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => setSkipping(round)}>
                          <SkipForward className="h-3.5 w-3.5" /> Skip round
                        </Button>
                      )}
                    </div>
                  )}
                  {round.status === 'completed' && index === rounds.length - 1 && (
                    <div className="text-xs text-success-700 dark:text-success-300 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Interview process complete
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>

      <ScheduleInterviewModal
        open={scheduling != null}
        round={scheduling}
        candidateName={application.candidateName}
        interviewers={interviewers}
        onClose={() => setScheduling(null)}
        onSaved={() => {
          setScheduling(null);
          void afterChange();
        }}
      />

      <InterviewScorecardModal
        open={scoring != null}
        round={scoring}
        candidateName={application.candidateName}
        submit={submitScorecard}
        onClose={() => setScoring(null)}
        onSaved={() => {
          setScoring(null);
          void afterChange();
        }}
      />

      <ConfirmDialog
        open={cancelling != null}
        title="Cancel this interview?"
        description={
          cancelling
            ? `The ${cancelling.displayRound} interview on ${formatInterviewWhen(
                cancelling.scheduledStartAt,
                cancelling.scheduledEndAt,
              )} is removed and the round goes back to unscheduled.`
            : undefined
        }
        confirmLabel="Cancel interview"
        onConfirm={async () => {
          if (!cancelling) return;
          await cancelInterviewRound(cancelling.id);
          await afterChange();
        }}
        onClose={() => setCancelling(null)}
      />

      <ConfirmDialog
        open={skipping != null}
        title={`Skip the ${skipping?.displayRound ?? ''} round?`}
        description="The candidate moves straight to the next round. Skipped rounds don't count toward the interview score."
        confirmLabel="Skip round"
        tone="primary"
        onConfirm={async () => {
          if (!skipping) return;
          await skipInterviewRound(skipping.id);
          await afterChange();
        }}
        onClose={() => setSkipping(null)}
      />
    </>
  );
}
