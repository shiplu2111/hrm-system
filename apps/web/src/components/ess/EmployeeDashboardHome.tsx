import {
  Bell,
  CalendarDays,
  Clock,
  Coffee,
  Download,
  LogIn,
  Megaphone,
  Wallet,
  ClipboardList,
  Sparkles,
} from 'lucide-react';
import type { EmployeeDashboardView, EmployeeKudosRecord, EngagementSurveyRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
  portalDownload,
} from '@hrm/portal-ui';
import { formatAttendanceMinutes, createEmployeeKudos, getEngagementSurvey, listCompanyEmployees, submitEngagementSurveyResponse } from '@/lib/ess-api';
import { useEffect, useState } from 'react';

function formatTime(iso: string | null, emDash: string): string {
  if (!iso) return emDash;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function displayClock(
  attendance: EmployeeDashboardView['attendance'],
  field: 'clockInAt' | 'clockOutAt',
  emDash: string,
): string {
  const display = attendance.display?.[field];
  if (display) return display;
  return formatTime(attendance[field], emDash);
}

function displayShiftRange(
  record: EmployeeDashboardView['todayShift'] | undefined,
  fallback: EmployeeDashboardView['attendance']['shift'] | undefined,
  emDash: string,
): string {
  if (record?.display) {
    return `${record.display.shiftStartTime} – ${record.display.shiftEndTime}`;
  }
  if (record?.shift) {
    return `${record.shift.startTime} – ${record.shift.endTime}`;
  }
  if (fallback) {
    return `${fallback.startTime} – ${fallback.endTime}`;
  }
  return emDash;
}

interface EmployeeDashboardHomeProps {
  dashboard: EmployeeDashboardView;
  employeeId: string;
  companyId: string;
  actionLoading: boolean;
  onClockIn: () => void;
  onClockOut: () => void;
  onBreakStart: () => void;
  onBreakEnd: () => void;
  onSurveySubmitted: () => void;
}

export function EmployeeDashboardHome({
  dashboard,
  employeeId,
  companyId,
  actionLoading,
  onClockIn,
  onClockOut,
  onBreakStart,
  onBreakEnd,
  onSurveySubmitted,
}: EmployeeDashboardHomeProps) {
  const { t } = useAppTranslation();
  const emDash = t('common.emDash');
  const { attendance, todayShift, leaveBalances, upcomingLeave, latestPayslip, notifications, unreadNotificationCount, announcements, activeSurveys, kudosFeed } =
    dashboard;
  const phase = attendance.metrics.phase;
  const [payslipDownloading, setPayslipDownloading] = useState(false);
  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [activeSurvey, setActiveSurvey] = useState<EngagementSurveyRecord | null>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [surveyError, setSurveyError] = useState<string | null>(null);
  const [kudosModalOpen, setKudosModalOpen] = useState(false);
  const [kudosMessage, setKudosMessage] = useState('');
  const [kudosToId, setKudosToId] = useState('');
  const [colleagues, setColleagues] = useState<Array<{ id: string; name: string }>>([]);
  const [kudosSubmitting, setKudosSubmitting] = useState(false);
  const [localKudosFeed, setLocalKudosFeed] = useState<EmployeeKudosRecord[]>(kudosFeed);

  useEffect(() => {
    setLocalKudosFeed(kudosFeed);
  }, [kudosFeed]);

  useEffect(() => {
    if (!kudosModalOpen || !companyId) return;
    void listCompanyEmployees(companyId).then((rows) => {
      setColleagues(
        rows
          .filter((row) => row.id !== employeeId)
          .map((row) => ({
            id: row.id,
            name: `${row.firstName} ${row.lastName}`.trim(),
          })),
      );
    });
  }, [kudosModalOpen, companyId, employeeId]);

  const attendanceStatusLabel = t(`attendance.statusValue.${attendance.status}`, {
    defaultValue: attendance.status.replace('_', ' '),
  });

  const handlePayslipDownload = async () => {
    if (!latestPayslip?.downloadUrl) return;
    setPayslipDownloading(true);
    try {
      await portalDownload('employee', latestPayslip.downloadUrl, 'payslip.pdf');
    } finally {
      setPayslipDownloading(false);
    }
  };

  const openSurvey = async (surveyId: string) => {
    setSurveyError(null);
    setSurveyAnswers({});
    try {
      const survey = await getEngagementSurvey(employeeId, surveyId);
      setActiveSurvey(survey);
      setSurveyModalOpen(true);
    } catch {
      setSurveyError('Unable to load survey');
    }
  };

  const handleSubmitKudos = async () => {
    if (!kudosToId || !kudosMessage.trim()) return;
    setKudosSubmitting(true);
    try {
      const created = await createEmployeeKudos(employeeId, {
        toEmployeeId: kudosToId,
        message: kudosMessage.trim(),
      });
      setLocalKudosFeed((current) => [created, ...current]);
      setKudosModalOpen(false);
      setKudosMessage('');
      setKudosToId('');
      onSurveySubmitted();
    } catch {
      setSurveyError('Failed to send recognition');
    } finally {
      setKudosSubmitting(false);
    }
  };

  const handleSubmitSurvey = async () => {
    if (!activeSurvey) return;
    setSurveySubmitting(true);
    setSurveyError(null);
    try {
      const answers = activeSurvey.questions.map((q) => {
        const raw = surveyAnswers[q.id] ?? '';
        if (q.questionType === 'text') {
          return { questionId: q.id, textValue: raw };
        }
        if (q.questionType === 'multiple_choice') {
          return { questionId: q.id, selectedOption: raw };
        }
        return { questionId: q.id, numericValue: Number(raw) };
      });
      await submitEngagementSurveyResponse(employeeId, activeSurvey.id, answers);
      setSurveyModalOpen(false);
      setActiveSurvey(null);
      onSurveySubmitted();
    } catch {
      setSurveyError('Failed to submit survey. You may have already responded.');
    } finally {
      setSurveySubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" /> {t('dashboard.todayShift')}
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-1">
            {todayShift?.shift ? (
              <>
                <div className="font-medium text-primary">{todayShift.shift.name}</div>
                <div className="text-secondary">{displayShiftRange(todayShift, undefined, emDash)}</div>
                {todayShift.location?.name ? (
                  <div className="text-muted">{todayShift.location.name}</div>
                ) : null}
              </>
            ) : attendance.shift ? (
              <>
                <div className="font-medium text-primary">{attendance.shift.name}</div>
                <div className="text-secondary">
                  {displayShiftRange(undefined, attendance.shift, emDash)}
                </div>
              </>
            ) : (
              <p className="text-muted">{t('dashboard.noShiftToday')}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LogIn className="h-4 w-4" /> {t('dashboard.clockInOut')}
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-muted text-xs">{t('dashboard.clockIn')}</div>
                <div>{displayClock(attendance, 'clockInAt', emDash)}</div>
              </div>
              <div>
                <div className="text-muted text-xs">{t('dashboard.clockOut')}</div>
                <div>{displayClock(attendance, 'clockOutAt', emDash)}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={actionLoading || phase !== 'not_started'}
                onClick={onClockIn}
              >
                {t('dashboard.clockInAction')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={actionLoading || phase === 'not_started' || phase === 'completed'}
                onClick={onClockOut}
              >
                {t('dashboard.clockOutAction')}
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.workingHours')}</CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-1">
            <div className="text-2xl font-bold text-primary">
              {formatAttendanceMinutes(attendance.metrics.netMinutes)}
            </div>
            <div className="text-muted capitalize">
              {t('dashboard.status', { status: attendanceStatusLabel })}
            </div>
            <div className="text-secondary">
              {t('dashboard.gross', {
                minutes: formatAttendanceMinutes(attendance.metrics.grossMinutes),
              })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coffee className="h-4 w-4" /> {t('dashboard.break')}
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm space-y-3">
            <div>
              <div className="text-muted text-xs">{t('dashboard.breakTime')}</div>
              <div className="font-medium">
                {formatAttendanceMinutes(attendance.metrics.breakMinutes)}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={actionLoading || phase !== 'working'}
                onClick={onBreakStart}
              >
                {t('dashboard.startBreak')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={actionLoading || phase !== 'on_break'}
                onClick={onBreakEnd}
              >
                {t('dashboard.endBreak')}
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> {t('dashboard.leaveBalance')}
            </CardTitle>
          </CardHeader>
          <CardBody className="grid sm:grid-cols-2 gap-3">
            {leaveBalances.length === 0 ? (
              <p className="text-sm text-muted">{t('dashboard.noLeaveBalances')}</p>
            ) : (
              leaveBalances.map((bal) => (
                <div
                  key={bal.id}
                  className="rounded-lg border border-[rgb(var(--border-base))] px-3 py-2"
                >
                  <div className="text-sm font-medium">
                    {bal.leaveTypeName ?? t('dashboard.leaveFallback')}
                  </div>
                  <div className="text-xs text-muted mt-1">
                    {t('common.daysRemainingShort', {
                      balance: bal.balanceDays.toFixed(1),
                    })}
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.upcomingLeave')}</CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {upcomingLeave.length === 0 ? (
              <p className="text-sm text-muted">{t('dashboard.noUpcomingLeave')}</p>
            ) : (
              upcomingLeave.map((req) => (
                <div key={req.id} className="py-2 flex justify-between gap-3 text-sm">
                  <div>
                    <div className="font-medium">
                      {req.leaveTypeName ?? t('dashboard.leaveFallback')}
                    </div>
                    <div className="text-muted">
                      {t('common.dateRange', { start: req.startDate, end: req.endDate })}
                    </div>
                  </div>
                  <Badge
                    tone={
                      req.status === 'approved'
                        ? 'success'
                        : req.status === 'rejected'
                          ? 'error'
                          : 'warning'
                    }
                    className="capitalize shrink-0"
                  >
                    {t(`leave.status.${req.status}`, { defaultValue: req.status })}
                  </Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Recognition feed
          </CardTitle>
          <Button size="sm" onClick={() => setKudosModalOpen(true)}>Give kudos</Button>
        </CardHeader>
        <CardBody className="divide-y divide-[rgb(var(--border-base))]">
          {localKudosFeed.length === 0 ? (
            <p className="text-sm text-muted">No recognition posts yet.</p>
          ) : (
            localKudosFeed.map((item) => (
              <article key={item.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm text-primary">
                  <span className="font-semibold">{item.fromEmployeeName}</span>
                  {' recognized '}
                  <span className="font-semibold">{item.toEmployeeName}</span>
                </p>
                <p className="mt-1 text-sm text-secondary">{item.message}</p>
                <p className="mt-1 text-[11px] text-muted capitalize">
                  {item.kudosType === 'manager' ? 'Manager recognition' : 'Peer recognition'}
                  {' · '}
                  {new Date(item.createdAt).toLocaleDateString()}
                </p>
              </article>
            ))
          )}
        </CardBody>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-4 w-4" /> Company news
            </CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {announcements.length === 0 ? (
              <p className="text-sm text-muted">No company announcements.</p>
            ) : (
              announcements.map((item) => (
                <article key={item.id} className="py-3 first:pt-0 last:pb-0">
                  {item.isPinned ? (
                    <Badge tone="warning" className="mb-1">Pinned</Badge>
                  ) : null}
                  <div className="font-medium text-primary">{item.title}</div>
                  <p className="mt-1 text-sm text-secondary whitespace-pre-wrap">{item.body}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : ''}
                  </p>
                </article>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Surveys
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {activeSurveys.length === 0 ? (
              <p className="text-sm text-muted">No surveys awaiting your response.</p>
            ) : (
              activeSurveys.map((survey) => (
                <div key={survey.id} className="flex items-center justify-between gap-3 rounded-lg border border-base p-3">
                  <div>
                    <p className="font-medium text-primary">{survey.title}</p>
                    <p className="text-xs text-muted">
                      {survey.isAnonymous ? 'Anonymous' : 'Identified'} · {survey.questionCount} question(s)
                    </p>
                  </div>
                  <Button size="sm" onClick={() => void openSurvey(survey.id)}>
                    Respond
                  </Button>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" /> {t('dashboard.latestPayslip')}
            </CardTitle>
          </CardHeader>
          <CardBody className="text-sm">
            {latestPayslip ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-primary">
                    {t('dashboard.generated', {
                      date: new Date(latestPayslip.generatedAt).toLocaleDateString(),
                    })}
                  </div>
                  <div className="text-muted text-xs mt-1">
                    {t('dashboard.payrollRun', {
                      id: latestPayslip.payrollRunId.slice(0, 8),
                    })}
                  </div>
                </div>
                {latestPayslip.downloadUrl ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={payslipDownloading}
                    onClick={() => void handlePayslipDownload()}
                  >
                    <Download className="h-4 w-4" />{' '}
                    {payslipDownloading ? t('common.downloading') : t('common.download')}
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-muted">{t('dashboard.noPayslips')}</p>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> {t('dashboard.notifications')}
            </CardTitle>
            {unreadNotificationCount > 0 ? (
              <Badge tone="warning">
                {t('dashboard.unread', { count: unreadNotificationCount })}
              </Badge>
            ) : null}
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted">{t('dashboard.allCaughtUp')}</p>
            ) : (
              notifications.map((note) => (
                <div key={note.id} className="py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-primary">{note.title}</div>
                    {!note.readAt ? <Badge tone="accent">{t('common.new')}</Badge> : null}
                  </div>
                  <div className="text-secondary mt-0.5">{note.body}</div>
                  <div className="text-[11px] text-muted mt-1">
                    {new Date(note.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={surveyModalOpen}
        onClose={() => setSurveyModalOpen(false)}
        title={activeSurvey?.title ?? 'Survey'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSurveyModalOpen(false)}>Cancel</Button>
            <Button disabled={surveySubmitting} onClick={() => void handleSubmitSurvey()}>
              {surveySubmitting ? 'Submitting…' : 'Submit anonymously'}
            </Button>
          </>
        }
      >
        {surveyError ? <p className="mb-3 text-sm text-danger-600">{surveyError}</p> : null}
        {activeSurvey?.description ? (
          <p className="mb-4 text-sm text-secondary">{activeSurvey.description}</p>
        ) : null}
        <div className="space-y-4">
          {activeSurvey?.questions.map((question) => (
            <div key={question.id}>
              <Label>{question.prompt}</Label>
              {question.questionType === 'text' ? (
                <Textarea
                  rows={3}
                  value={surveyAnswers[question.id] ?? ''}
                  onChange={(e) =>
                    setSurveyAnswers((current) => ({ ...current, [question.id]: e.target.value }))
                  }
                />
              ) : question.questionType === 'multiple_choice' ? (
                <Select
                  value={surveyAnswers[question.id] ?? ''}
                  onChange={(e) =>
                    setSurveyAnswers((current) => ({ ...current, [question.id]: e.target.value }))
                  }
                >
                  <option value="">Select…</option>
                  {(question.options ?? []).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              ) : question.questionType === 'enps' ? (
                <Select
                  value={surveyAnswers[question.id] ?? ''}
                  onChange={(e) =>
                    setSurveyAnswers((current) => ({ ...current, [question.id]: e.target.value }))
                  }
                >
                  <option value="">Score 0–10…</option>
                  {Array.from({ length: 11 }, (_, score) => (
                    <option key={score} value={String(score)}>{score}</option>
                  ))}
                </Select>
              ) : (
                <Select
                  value={surveyAnswers[question.id] ?? ''}
                  onChange={(e) =>
                    setSurveyAnswers((current) => ({ ...current, [question.id]: e.target.value }))
                  }
                >
                  <option value="">Rating 1–5…</option>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <option key={score} value={String(score)}>{score}</option>
                  ))}
                </Select>
              )}
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        open={kudosModalOpen}
        onClose={() => setKudosModalOpen(false)}
        title="Give kudos"
        footer={
          <>
            <Button variant="secondary" onClick={() => setKudosModalOpen(false)}>Cancel</Button>
            <Button disabled={kudosSubmitting || !kudosToId || !kudosMessage.trim()} onClick={() => void handleSubmitKudos()}>
              {kudosSubmitting ? 'Sending…' : 'Send recognition'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Recognize colleague</Label>
            <Select value={kudosToId} onChange={(e) => setKudosToId(e.target.value)}>
              <option value="">Select employee…</option>
              {colleagues.map((colleague) => (
                <option key={colleague.id} value={colleague.id}>{colleague.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Message</Label>
            <Textarea
              rows={4}
              value={kudosMessage}
              onChange={(e) => setKudosMessage(e.target.value)}
              placeholder="Thank you for…"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
