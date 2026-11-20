import { useEffect, useState } from 'react';
import { ClipboardList, Megaphone, Sparkles } from 'lucide-react';
import type {
  CompanyAnnouncementRecord,
  EmployeeKudosRecord,
  EngagementSurveyListItem,
  EngagementSurveyRecord,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { usePermissions } from '@hrm/portal-ui';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import {
  createEmployeeKudos,
  getEngagementSurvey,
  listColleagues,
  submitEngagementSurveyResponse,
} from '@/lib/my-api';

interface EmployeeEngagementSectionProps {
  employeeId: string;
  companyId: string;
  announcements: CompanyAnnouncementRecord[];
  activeSurveys: EngagementSurveyListItem[];
  kudosFeed: EmployeeKudosRecord[];
  onSubmitted: () => void;
}

export function EmployeeEngagementSection({
  employeeId,
  companyId,
  announcements,
  activeSurveys,
  kudosFeed,
  onSubmitted,
}: EmployeeEngagementSectionProps) {
  const { t } = useAppTranslation();
  const { can } = usePermissions();
  const canCreateEngagement = can('engagement', 'create');

  const [surveyModalOpen, setSurveyModalOpen] = useState(false);
  const [activeSurvey, setActiveSurvey] = useState<EngagementSurveyRecord | null>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});
  const [surveySubmitting, setSurveySubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
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
    void listColleagues(companyId)
      .then((rows) => {
        setColleagues(
          rows
            .filter((row) => row.id !== employeeId)
            .map((row) => ({ id: row.id, name: row.fullName })),
        );
      })
      .catch(() => setModalError(t('errors.loadEmployeeData')));
  }, [kudosModalOpen, companyId, employeeId, t]);

  const openSurvey = async (surveyId: string) => {
    setModalError(null);
    setSurveyAnswers({});
    try {
      const survey = await getEngagementSurvey(employeeId, surveyId);
      setActiveSurvey(survey);
      setSurveyModalOpen(true);
    } catch {
      setModalError(t('dashboard.surveyLoadFailed'));
    }
  };

  const handleSubmitKudos = async () => {
    if (!kudosToId || !kudosMessage.trim()) return;
    setKudosSubmitting(true);
    setModalError(null);
    try {
      const created = await createEmployeeKudos(employeeId, {
        toEmployeeId: kudosToId,
        message: kudosMessage.trim(),
      });
      setLocalKudosFeed((current) => [created, ...current]);
      setKudosModalOpen(false);
      setKudosMessage('');
      setKudosToId('');
      onSubmitted();
    } catch {
      setModalError(t('dashboard.kudosSendFailed'));
    } finally {
      setKudosSubmitting(false);
    }
  };

  const handleSubmitSurvey = async () => {
    if (!activeSurvey) return;
    setSurveySubmitting(true);
    setModalError(null);
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
      onSubmitted();
    } catch {
      setModalError(t('dashboard.surveySubmitFailed'));
    } finally {
      setSurveySubmitting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> {t('dashboard.recognitionFeed')}
          </CardTitle>
          {canCreateEngagement && (
            <Button
              size="sm"
              onClick={() => {
                setModalError(null);
                setKudosModalOpen(true);
              }}
            >
              {t('dashboard.giveKudos')}
            </Button>
          )}
        </CardHeader>
        <CardBody className="divide-y divide-[rgb(var(--border-base))]">
          {localKudosFeed.length === 0 ? (
            <p className="text-sm text-muted">{t('dashboard.noRecognition')}</p>
          ) : (
            localKudosFeed.map((item) => (
              <article key={item.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm text-primary">
                  <span className="font-semibold">{item.fromEmployeeName}</span>
                  {' → '}
                  <span className="font-semibold">{item.toEmployeeName}</span>
                </p>
                <p className="mt-1 text-sm text-secondary">{item.message}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {item.kudosType === 'manager'
                    ? t('engagement.typeManager')
                    : t('engagement.typePeer')}
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
              <Megaphone className="h-4 w-4" /> {t('dashboard.companyNews')}
            </CardTitle>
          </CardHeader>
          <CardBody className="divide-y divide-[rgb(var(--border-base))]">
            {announcements.length === 0 ? (
              <p className="text-sm text-muted">{t('dashboard.noAnnouncements')}</p>
            ) : (
              announcements.map((item) => (
                <article key={item.id} className="py-3 first:pt-0 last:pb-0">
                  {item.isPinned ? (
                    <Badge tone="warning" className="mb-1">
                      {t('dashboard.pinned')}
                    </Badge>
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
              <ClipboardList className="h-4 w-4" /> {t('dashboard.surveys')}
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {activeSurveys.length === 0 ? (
              <p className="text-sm text-muted">{t('dashboard.noSurveys')}</p>
            ) : (
              activeSurveys.map((survey) => (
                <div
                  key={survey.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-base p-3"
                >
                  <div>
                    <p className="font-medium text-primary">{survey.title}</p>
                    <p className="text-xs text-muted">
                      {survey.isAnonymous ? t('dashboard.anonymous') : t('dashboard.identified')}
                      {' · '}
                      {t('dashboard.questionsCount', { count: survey.questionCount })}
                    </p>
                  </div>
                  {canCreateEngagement && (
                    <Button size="sm" onClick={() => void openSurvey(survey.id)}>
                      {t('dashboard.respond')}
                    </Button>
                  )}
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        open={surveyModalOpen}
        onClose={() => setSurveyModalOpen(false)}
        title={activeSurvey?.title ?? t('dashboard.surveys')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSurveyModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={surveySubmitting} onClick={() => void handleSubmitSurvey()}>
              {surveySubmitting ? t('common.submitting') : t('dashboard.submitAnonymously')}
            </Button>
          </>
        }
      >
        {modalError ? <p className="mb-3 text-sm text-error-600">{modalError}</p> : null}
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
                  <option value="">{t('dashboard.selectEmployee')}</option>
                  {(question.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              ) : question.questionType === 'enps' ? (
                <Select
                  value={surveyAnswers[question.id] ?? ''}
                  onChange={(e) =>
                    setSurveyAnswers((current) => ({ ...current, [question.id]: e.target.value }))
                  }
                >
                  <option value="">0–10</option>
                  {Array.from({ length: 11 }, (_, score) => (
                    <option key={score} value={String(score)}>
                      {score}
                    </option>
                  ))}
                </Select>
              ) : (
                <Select
                  value={surveyAnswers[question.id] ?? ''}
                  onChange={(e) =>
                    setSurveyAnswers((current) => ({ ...current, [question.id]: e.target.value }))
                  }
                >
                  <option value="">1–5</option>
                  {[1, 2, 3, 4, 5].map((score) => (
                    <option key={score} value={String(score)}>
                      {score}
                    </option>
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
        title={t('dashboard.giveKudos')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setKudosModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={kudosSubmitting || !kudosToId || !kudosMessage.trim()}
              onClick={() => void handleSubmitKudos()}
            >
              {kudosSubmitting ? t('dashboard.sending') : t('dashboard.sendRecognition')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {modalError ? <p className="text-sm text-error-600">{modalError}</p> : null}
          <div>
            <Label>{t('dashboard.recognizeColleague')}</Label>
            <Select value={kudosToId} onChange={(e) => setKudosToId(e.target.value)}>
              <option value="">{t('dashboard.selectEmployee')}</option>
              {colleagues.map((colleague) => (
                <option key={colleague.id} value={colleague.id}>
                  {colleague.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t('dashboard.message')}</Label>
            <Textarea
              rows={4}
              value={kudosMessage}
              onChange={(e) => setKudosMessage(e.target.value)}
              placeholder={t('dashboard.kudosPlaceholder')}
            />
          </div>
        </div>
      </Modal>
    </>
  );
}

