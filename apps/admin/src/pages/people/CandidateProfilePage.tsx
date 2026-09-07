import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Star,
  Mail,
  Briefcase,
  FileText,
  Download,
  Loader2,
  UserPlus,
  Calendar,
  CheckCircle2,
  FileSignature,
} from 'lucide-react';
import type {
  InterviewRecommendation,
  InterviewRoundRecord,
  JobApplicationRecord,
} from '@hrm/shared-types';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { useNav } from '@/context/NavContext';
import { listEmployees } from '@/lib/employees-api';
import {
  completeInterviewRound,
  formatResumeSize,
  getApplicationResumeFileUrl,
  getJobApplication,
  hireApplication,
  getOfferLetter,
  listInterviewRounds,
  scheduleInterviewRound,
  skipInterviewRound,
} from '@/lib/recruitment-api';
import { ApiError } from '@/lib/tenant-api-client';

const AVATAR_COLORS = [
  'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + hash * 31;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function roundStatusTone(
  status: InterviewRoundRecord['status'],
): 'neutral' | 'warning' | 'success' | 'error' {
  if (status === 'completed') return 'success';
  if (status === 'scheduled') return 'warning';
  if (status === 'cancelled' || status === 'skipped') return 'error';
  return 'neutral';
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function InterviewRoundsPanel({
  application,
  onUpdated,
}: {
  application: JobApplicationRecord;
  onUpdated: () => void;
}) {
  const [rounds, setRounds] = useState<InterviewRoundRecord[]>([]);
  const [employees, setEmployees] = useState<
    { id: string; firstName: string; lastName: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleRound, setScheduleRound] = useState<InterviewRoundRecord | null>(
    null,
  );
  const [completeRound, setCompleteRound] = useState<InterviewRoundRecord | null>(
    null,
  );
  const [scheduledStartAt, setScheduledStartAt] = useState('');
  const [scheduledEndAt, setScheduledEndAt] = useState('');
  const [location, setLocation] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [interviewerId, setInterviewerId] = useState('');
  const [score, setScore] = useState(4);
  const [recommendation, setRecommendation] =
    useState<InterviewRecommendation>('yes');
  const [feedback, setFeedback] = useState('');

  const loadRounds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roundRows, employeeRows] = await Promise.all([
        listInterviewRounds(application.id),
        listEmployees(application.companyId),
      ]);
      setRounds(roundRows);
      setEmployees(
        employeeRows.map((e) => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
        })),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load interview rounds',
      );
    } finally {
      setLoading(false);
    }
  }, [application.id, application.companyId]);

  useEffect(() => {
    void loadRounds();
  }, [loadRounds]);

  const handleSchedule = async () => {
    if (!scheduleRound || !scheduledStartAt) return;
    setSaving(true);
    setError(null);
    try {
      await scheduleInterviewRound(scheduleRound.id, {
        scheduledStartAt: new Date(scheduledStartAt).toISOString(),
        scheduledEndAt: scheduledEndAt
          ? new Date(scheduledEndAt).toISOString()
          : undefined,
        location: location.trim() || undefined,
        meetingUrl: meetingUrl.trim() || undefined,
        interviewerEmployeeId: interviewerId || undefined,
      });
      setScheduleRound(null);
      await loadRounds();
      onUpdated();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to schedule interview',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!completeRound) return;
    setSaving(true);
    setError(null);
    try {
      await completeInterviewRound(completeRound.id, {
        score,
        recommendation,
        feedback: feedback.trim() || undefined,
      });
      setCompleteRound(null);
      setFeedback('');
      await loadRounds();
      onUpdated();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to submit feedback',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async (round: InterviewRoundRecord) => {
    setSaving(true);
    setError(null);
    try {
      await skipInterviewRound(round.id);
      await loadRounds();
      onUpdated();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to skip round',
      );
    } finally {
      setSaving(false);
    }
  };

  const openSchedule = (round: InterviewRoundRecord) => {
    setScheduleRound(round);
    setScheduledStartAt('');
    setScheduledEndAt('');
    setLocation(round.location ?? '');
    setMeetingUrl(round.meetingUrl ?? '');
    setInterviewerId(round.interviewerEmployeeId ?? '');
  };

  const openComplete = (round: InterviewRoundRecord) => {
    setCompleteRound(round);
    setScore(round.score ?? 4);
    setRecommendation(round.recommendation ?? 'yes');
    setFeedback(round.feedback ?? '');
  };

  const canActOn = (round: InterviewRoundRecord, index: number): boolean => {
    if (round.status === 'completed' || round.status === 'skipped') return false;
    if (index === 0) return true;
    const prev = rounds[index - 1];
    return prev?.status === 'completed' || prev?.status === 'skipped';
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
          <CardTitle>Interview Rounds</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          {error && (
            <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700">
              {error}
            </div>
          )}
          <p className="text-xs text-secondary">
            Technical → HR → Management → Final Decision. Complete each round with
            score and feedback before advancing.
          </p>
          <div className="space-y-3">
            {rounds.map((round, index) => (
              <div
                key={round.id}
                className="rounded-lg border border-base p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-primary">
                      {round.roundOrder}. {round.displayRound}
                    </div>
                    {round.scheduledStartAt && (
                      <div className="text-xs text-secondary mt-1 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDateTime(round.scheduledStartAt)}
                        {round.scheduledEndAt &&
                          ` – ${formatDateTime(round.scheduledEndAt)}`}
                      </div>
                    )}
                    {round.interviewerName && (
                      <div className="text-xs text-muted mt-0.5">
                        Interviewer: {round.interviewerName}
                      </div>
                    )}
                    {round.location && (
                      <div className="text-xs text-muted">{round.location}</div>
                    )}
                  </div>
                  <Badge tone={roundStatusTone(round.status)}>
                    {round.displayStatus}
                  </Badge>
                </div>

                {round.status === 'completed' && (
                  <div className="text-sm space-y-1 bg-base/30 rounded-md p-3">
                    <div className="flex items-center gap-2">
                      <Star className="h-3.5 w-3.5 text-warning-500" />
                      <span className="font-medium">{round.score}/5</span>
                      {round.displayRecommendation && (
                        <Badge tone="neutral">{round.displayRecommendation}</Badge>
                      )}
                    </div>
                    {round.feedback && (
                      <p className="text-secondary text-xs whitespace-pre-wrap">
                        {round.feedback}
                      </p>
                    )}
                  </div>
                )}

                {canActOn(round, index) && (
                  <div className="flex flex-wrap gap-2">
                    {(round.status === 'pending' || round.status === 'scheduled') && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={saving}
                        onClick={() => openSchedule(round)}
                      >
                        <Calendar className="h-3.5 w-3.5" />
                        {round.status === 'scheduled' ? 'Reschedule' : 'Schedule'}
                      </Button>
                    )}
                    {(round.status === 'pending' || round.status === 'scheduled') && (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={saving}
                        onClick={() => openComplete(round)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Submit Feedback
                      </Button>
                    )}
                    {round.status === 'pending' && index > 0 && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={saving}
                        onClick={() => void handleSkip(round)}
                      >
                        Skip
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Modal
        open={scheduleRound != null}
        onClose={() => setScheduleRound(null)}
        title={`Schedule ${scheduleRound?.displayRound ?? 'Interview'}`}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="int-start">Start</Label>
            <Input
              id="int-start"
              type="datetime-local"
              value={scheduledStartAt}
              onChange={(e) => setScheduledStartAt(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="int-end">End</Label>
            <Input
              id="int-end"
              type="datetime-local"
              value={scheduledEndAt}
              onChange={(e) => setScheduledEndAt(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="int-interviewer">Interviewer</Label>
            <Select
              id="int-interviewer"
              value={interviewerId}
              onChange={(e) => setInterviewerId(e.target.value)}
            >
              <option value="">Select interviewer</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="int-location">Location</Label>
            <Input
              id="int-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Room or office"
            />
          </div>
          <div>
            <Label htmlFor="int-url">Meeting URL</Label>
            <Input
              id="int-url"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setScheduleRound(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={saving || !scheduledStartAt}
              onClick={() => void handleSchedule()}
            >
              {saving ? 'Saving…' : 'Save Schedule'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={completeRound != null}
        onClose={() => setCompleteRound(null)}
        title={`Feedback — ${completeRound?.displayRound ?? ''}`}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="int-score">Score (0–5)</Label>
            <Input
              id="int-score"
              type="number"
              min={0}
              max={5}
              step={0.5}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="int-rec">Recommendation</Label>
            <Select
              id="int-rec"
              value={recommendation}
              onChange={(e) =>
                setRecommendation(e.target.value as InterviewRecommendation)
              }
            >
              <option value="strong_yes">Strong Yes</option>
              <option value="yes">Yes</option>
              <option value="neutral">Neutral</option>
              <option value="no">No</option>
              <option value="strong_no">Strong No</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="int-feedback">Feedback</Label>
            <Textarea
              id="int-feedback"
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Interview notes, strengths, concerns…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCompleteRound(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={saving}
              onClick={() => void handleComplete()}
            >
              {saving ? 'Submitting…' : 'Submit Feedback'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function CandidateProfilePage() {
  const { navigate, selectedApplicationId } = useNav();
  const [application, setApplication] = useState<JobApplicationRecord | null>(null);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [hiring, setHiring] = useState(false);

  const loadApplication = useCallback(async () => {
    if (!selectedApplicationId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const app = await getJobApplication(selectedApplicationId);
      setApplication(app);
      try {
        const offer = await getOfferLetter(selectedApplicationId);
        setOfferAccepted(offer.status === 'accepted');
      } catch {
        setOfferAccepted(false);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load application',
      );
    } finally {
      setLoading(false);
    }
  }, [selectedApplicationId]);

  useEffect(() => {
    void loadApplication();
  }, [loadApplication]);

  const handleDownloadResume = async () => {
    if (!application?.id) return;
    setDownloading(true);
    setError(null);
    try {
      const { url } = await getApplicationResumeFileUrl(application.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to open resume',
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleHire = async () => {
    if (!application?.id) return;
    setHiring(true);
    setError(null);
    try {
      setApplication(await hireApplication(application.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to hire candidate');
    } finally {
      setHiring(false);
    }
  };

  if (!selectedApplicationId) {
    return (
      <div className="p-6 text-secondary">
        Select a candidate from the recruitment pipeline.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading candidate…
      </div>
    );
  }

  if (!application) {
    return (
      <div className="p-6 text-error-600">
        {error ?? 'Application not found.'}
      </div>
    );
  }

  const name = application.candidateName ?? 'Candidate';
  const showInterviews =
    application.stage === 'interview' ||
    application.stage === 'offer' ||
    application.stage === 'hired' ||
    application.stage === 'rejected';

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <button
        type="button"
        onClick={() => navigate('recruitment')}
        className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Pipeline
      </button>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardBody className="flex flex-col items-center text-center">
              <div
                className={`h-16 w-16 rounded-full ${avatarColor(name)} flex items-center justify-center text-xl font-semibold`}
              >
                {name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
              <div className="mt-3 text-lg font-bold text-primary">{name}</div>
              <div className="text-sm text-secondary">{application.requisitionTitle}</div>
              <div className="mt-2">
                <Badge tone="accent" dot>
                  {application.displayStage}
                </Badge>
              </div>
              <div className="mt-4 pt-4 border-t border-base w-full space-y-2 text-left">
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <Mail className="h-3.5 w-3.5" /> {application.candidateEmail}
                </div>
                <div className="flex items-center gap-2 text-xs text-secondary">
                  <Briefcase className="h-3.5 w-3.5" />
                  {application.yearsExperience != null
                    ? `${application.yearsExperience} years experience`
                    : 'Experience not specified'}
                </div>
                {application.rating != null && (
                  <div className="flex items-center gap-2 text-xs text-secondary">
                    <Star className="h-3.5 w-3.5 text-warning-500" />
                    Rating: {application.rating}/5
                  </div>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resume / CV</CardTitle>
            </CardHeader>
            <CardBody>
              {application.resume ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-base">
                    <FileText className="h-8 w-8 text-accent-500" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-primary truncate">
                        {application.resume.originalName}
                      </div>
                      <div className="text-xs text-muted">
                        {formatResumeSize(application.resume.sizeBytes)}
                      </div>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={downloading}
                      onClick={() => void handleDownloadResume()}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-secondary">No resume uploaded yet.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Details</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4 text-sm">
              <div>
                <div className="text-xs text-muted uppercase tracking-wide">
                  Requisition
                </div>
                <div className="text-primary font-medium">
                  {application.requisitionReference} — {application.requisitionTitle}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted uppercase tracking-wide">
                  Applied
                </div>
                <div className="text-secondary">
                  {new Date(application.appliedAt).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted uppercase tracking-wide">
                  Last stage update
                </div>
                <div className="text-secondary">
                  {new Date(application.stageUpdatedAt).toLocaleString()}
                </div>
              </div>
              {application.coverLetter && (
                <div>
                  <div className="text-xs text-muted uppercase tracking-wide mb-1">
                    Cover letter
                  </div>
                  <p className="text-secondary whitespace-pre-wrap">
                    {application.coverLetter}
                  </p>
                </div>
              )}
              {application.stage === 'offer' && !application.hiredEmployeeId && (
                <div className="pt-2 border-t border-base space-y-3">
                  <Button
                    variant="secondary"
                    onClick={() => navigate('offer-letter')}
                  >
                    <FileSignature className="h-4 w-4" /> Offer Letter
                  </Button>
                  <Button
                    variant="primary"
                    disabled={hiring || !offerAccepted}
                    onClick={() => void handleHire()}
                  >
                    {hiring ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Converting…
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" /> Convert to Employee
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted">
                    {offerAccepted
                      ? 'Creates an employee record from the accepted offer — no manual re-entry.'
                      : 'Mark the offer letter as accepted before converting to employee.'}
                  </p>
                </div>
              )}
              {application.hiredEmployeeId && (
                <div className="pt-2 border-t border-base">
                  <Badge tone="success">Hired — employee record created</Badge>
                </div>
              )}
            </CardBody>
          </Card>

          {showInterviews && (
            <InterviewRoundsPanel
              application={application}
              onUpdated={() => void loadApplication()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
