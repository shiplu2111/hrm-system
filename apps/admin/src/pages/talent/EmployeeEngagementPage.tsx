import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Loader2,
  Megaphone,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  ClipboardList,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Toggle } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import {
  QUESTION_TYPE_LABELS,
  SURVEY_TYPE_LABELS,
  closeSurvey,
  createAnnouncement,
  createKudos,
  createSurvey,
  getEngagementSummary,
  getEnpsTrends,
  getSurveyResults,
  KUDOS_TYPE_LABELS,
  listAnnouncements,
  listKudos,
  listSurveys,
  publishAnnouncement,
  publishSurvey,
} from '@/lib/engagement-api';
import { listEmployees } from '@/lib/employees-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  CompanyAnnouncementRecord,
  EmployeeKudosRecord,
  EngagementQuestionType,
  EngagementSurveyRecord,
  EngagementSurveyResults,
  EngagementSurveyType,
  EngagementSummary,
  EnpsTrendPoint,
} from '@hrm/shared-types';

type PageTab = 'announcements' | 'kudos' | 'surveys' | 'results' | 'enps';

export function EmployeeEngagementPage() {
  const { companyId } = useCompany();
  const [tab, setTab] = useState<PageTab>('announcements');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<EngagementSummary | null>(null);
  const [announcements, setAnnouncements] = useState<CompanyAnnouncementRecord[]>([]);
  const [surveys, setSurveys] = useState<EngagementSurveyRecord[]>([]);
  const [results, setResults] = useState<EngagementSurveyResults | null>(null);
  const [enpsTrends, setEnpsTrends] = useState<EnpsTrendPoint[]>([]);
  const [kudosFeed, setKudosFeed] = useState<EmployeeKudosRecord[]>([]);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  const [announcementModal, setAnnouncementModal] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annPinned, setAnnPinned] = useState(false);

  const [surveyModal, setSurveyModal] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyDesc, setSurveyDesc] = useState('');
  const [surveyType, setSurveyType] = useState<EngagementSurveyType>('pulse');
  const [surveyAnonymous, setSurveyAnonymous] = useState(true);
  const [surveyPrompt, setSurveyPrompt] = useState(
    'How satisfied are you with your experience at the company?',
  );
  const [surveyQuestionType, setSurveyQuestionType] = useState<EngagementQuestionType>('rating');

  const [kudosModal, setKudosModal] = useState(false);
  const [kudosFromId, setKudosFromId] = useState('');
  const [kudosToId, setKudosToId] = useState('');
  const [kudosMessage, setKudosMessage] = useState('');

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryRow, announcementRows, surveyRows, trendRows, kudosRows, employeeRows] =
        await Promise.all([
        getEngagementSummary(companyId),
        listAnnouncements(companyId),
        listSurveys(companyId),
        getEnpsTrends(companyId),
        listKudos(companyId),
        listEmployees(companyId),
      ]);
      setSummary(summaryRow);
      setAnnouncements(announcementRows);
      setSurveys(surveyRows);
      setEnpsTrends(trendRows);
      setKudosFeed(kudosRows);
      setEmployees(
        employeeRows.map((emp) => ({
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`.trim(),
        })),
      );
      if (!selectedSurveyId && surveyRows[0]) {
        setSelectedSurveyId(surveyRows[0].id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load engagement data');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedSurveyId]);

  const loadResults = useCallback(async (surveyId: string) => {
    if (!surveyId) return;
    try {
      setResults(await getSurveyResults(surveyId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load survey results');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (tab === 'results' && selectedSurveyId) void loadResults(selectedSurveyId);
  }, [tab, selectedSurveyId, loadResults]);

  const handleCreateAnnouncement = async () => {
    if (!companyId || !annTitle.trim() || !annBody.trim()) return;
    setSubmitting(true);
    try {
      const created = await createAnnouncement(companyId, {
        title: annTitle.trim(),
        body: annBody.trim(),
        isPinned: annPinned,
      });
      await publishAnnouncement(created.id);
      setAnnouncementModal(false);
      setAnnTitle('');
      setAnnBody('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSurvey = async () => {
    if (!companyId || !surveyTitle.trim()) return;
    setSubmitting(true);
    try {
      const qType =
        surveyType === 'enps' ? ('enps' as const) : surveyQuestionType;
      const prompt =
        surveyType === 'enps'
          ? 'On a scale of 0–10, how likely are you to recommend this company as a place to work?'
          : surveyPrompt.trim();

      const created = await createSurvey(companyId, {
        title: surveyTitle.trim(),
        description: surveyDesc.trim() || undefined,
        surveyType,
        isAnonymous: surveyAnonymous,
        questions: [
          {
            questionType: qType,
            prompt,
            isRequired: true,
            ...(qType === 'multiple_choice'
              ? { options: ['Very satisfied', 'Satisfied', 'Neutral', 'Dissatisfied'] }
              : {}),
          },
        ],
      });
      await publishSurvey(created.id);
      setSurveyModal(false);
      setSurveyTitle('');
      setSurveyDesc('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create survey');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateKudos = async () => {
    if (!companyId || !kudosFromId || !kudosToId || !kudosMessage.trim()) return;
    setSubmitting(true);
    try {
      await createKudos(companyId, {
        fromEmployeeId: kudosFromId,
        toEmployeeId: kudosToId,
        message: kudosMessage.trim(),
      });
      setKudosModal(false);
      setKudosFromId('');
      setKudosToId('');
      setKudosMessage('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send kudos');
    } finally {
      setSubmitting(false);
    }
  };

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to manage employee engagement.</div>;
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-bold text-primary">Employee Engagement</h1>
          <p className="mt-0.5 text-sm text-secondary">
            Company announcements, pulse surveys, and anonymous eNPS aggregation.
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'announcements' && (
            <Button onClick={() => setAnnouncementModal(true)}>
              <Plus className="h-4 w-4" /> New announcement
            </Button>
          )}
          { tab === 'kudos' && (
            <Button onClick={() => setKudosModal(true)}>
              <Plus className="h-4 w-4" /> Give kudos
            </Button>
          )}
          {tab === 'surveys' && (
            <Button onClick={() => setSurveyModal(true)}>
              <Plus className="h-4 w-4" /> New survey
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: 'Published announcements', value: summary?.publishedAnnouncementCount ?? 0 },
          { label: 'Active surveys', value: summary?.activeSurveyCount ?? 0 },
          { label: 'Total responses', value: summary?.totalSurveyResponses ?? 0 },
          { label: 'Latest eNPS', value: summary?.latestEnpsScore ?? '—' },
          { label: 'Kudos this month', value: summary?.kudosThisMonthCount ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="surface rounded-xl border border-base p-4 shadow-card">
            <p className="text-2xl font-bold text-primary">{loading ? '…' : value}</p>
            <p className="text-xs text-secondary">{label}</p>
          </div>
        ))}
      </div>

      <div className="surface flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-base p-1 shadow-card">
        {(
          [
            ['announcements', 'Announcements', Megaphone],
            ['kudos', 'Recognition', Sparkles],
            ['surveys', 'Surveys', ClipboardList],
            ['results', 'Results', BarChart3],
            ['enps', 'eNPS trends', TrendingUp],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${tab === id ? 'bg-accent-600 text-white shadow-sm' : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-secondary">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      ) : tab === 'announcements' ? (
        <section className="surface divide-y divide-[rgb(var(--border-base))] overflow-hidden rounded-xl border border-base shadow-card">
          {announcements.length === 0 ? (
            <p className="p-8 text-sm text-muted">No announcements yet.</p>
          ) : (
            announcements.map((item) => (
              <article key={item.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  {item.isPinned && <Badge tone="warning">Pinned</Badge>}
                  <Badge tone={item.status === 'published' ? 'success' : 'neutral'}>{item.status}</Badge>
                </div>
                <h2 className="mt-2 font-semibold text-primary">{item.title}</h2>
                <p className="mt-1 text-sm text-secondary whitespace-pre-wrap">{item.body}</p>
                <p className="mt-2 text-xs text-muted">
                  {item.publishedAt
                    ? `Published ${new Date(item.publishedAt).toLocaleString()}`
                    : `Created ${new Date(item.createdAt).toLocaleString()}`}
                </p>
              </article>
            ))
          )}
        </section>
      ) : tab === 'kudos' ? (
        <section className="surface divide-y divide-[rgb(var(--border-base))] overflow-hidden rounded-xl border border-base shadow-card">
          {kudosFeed.length === 0 ? (
            <p className="p-8 text-sm text-muted">No recognition posts yet.</p>
          ) : (
            kudosFeed.map((item) => (
              <article key={item.id} className="px-5 py-4">
                <Badge tone={item.kudosType === 'manager' ? 'accent' : 'neutral'}>
                  {KUDOS_TYPE_LABELS[item.kudosType]}
                </Badge>
                <p className="mt-2 text-sm text-primary">
                  <span className="font-semibold">{item.fromEmployeeName}</span>
                  {' → '}
                  <span className="font-semibold">{item.toEmployeeName}</span>
                </p>
                <p className="mt-1 text-sm text-secondary">{item.message}</p>
                <p className="mt-2 text-xs text-muted">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </article>
            ))
          )}
        </section>
      ) : tab === 'surveys' ? (
        <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
              <tr>
                <th className="px-5 py-3">Survey</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Responses</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))]">
              {surveys.map((survey) => (
                <tr key={survey.id}>
                  <td className="px-5 py-4">
                    <p className="font-medium text-primary">{survey.title}</p>
                    <p className="text-xs text-muted">{survey.isAnonymous ? 'Anonymous' : 'Identified'}</p>
                  </td>
                  <td className="px-4 py-4">{SURVEY_TYPE_LABELS[survey.surveyType]}</td>
                  <td className="px-4 py-4 capitalize">{survey.status}</td>
                  <td className="px-4 py-4">{survey.responseCount}</td>
                  <td className="px-4 py-4 text-right">
                    {survey.status === 'published' && (
                      <Button size="sm" variant="secondary" onClick={() => void closeSurvey(survey.id).then(load)}>
                        Close
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!surveys.length && <p className="p-8 text-sm text-muted">No surveys yet.</p>}
        </section>
      ) : tab === 'results' ? (
        <section className="space-y-4">
          <div className="max-w-md">
            <Label>Survey</Label>
            <Select
              value={selectedSurveyId}
              onChange={(e) => setSelectedSurveyId(e.target.value)}
            >
              {surveys.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </Select>
          </div>
          {results && (
            <div className="surface space-y-4 rounded-xl border border-base p-5 shadow-card">
              <p className="text-sm text-secondary">
                {results.responseCount} anonymous responses · {results.isAnonymous ? 'Aggregated only' : 'Identified'}
              </p>
              {results.enps && (
                <div className="rounded-lg bg-[rgb(var(--bg-muted))] p-4">
                  <p className="text-3xl font-bold text-primary">{results.enps.score}</p>
                  <p className="text-sm text-secondary">eNPS score</p>
                  <p className="mt-2 text-xs text-muted">
                    Promoters {results.enps.promoters} · Passives {results.enps.passives} · Detractors {results.enps.detractors}
                  </p>
                </div>
              )}
              {results.questions.map((q) => (
                <div key={q.questionId} className="border-t border-base pt-4">
                  <p className="font-medium text-primary">{q.prompt}</p>
                  {q.optionCounts?.map((row) => (
                    <div key={row.option} className="mt-2 flex items-center gap-3">
                      <span className="w-40 text-sm text-secondary">{row.option}</span>
                      <div className="h-2 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-2 rounded bg-accent-500"
                          style={{
                            width: `${results.responseCount ? (row.count / results.responseCount) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted">{row.count}</span>
                    </div>
                  ))}
                  {q.averageRating != null && (
                    <p className="mt-1 text-sm text-secondary">Average rating: {q.averageRating}</p>
                  )}
                  {q.textResponses && q.textResponses.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary">
                      {q.textResponses.map((text, i) => (
                        <li key={i}>{text}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="surface space-y-4 rounded-xl border border-base p-5 shadow-card">
          {enpsTrends.length === 0 ? (
            <p className="text-sm text-muted">No eNPS surveys published yet.</p>
          ) : (
            enpsTrends.map((point) => (
              <div key={point.surveyId} className="flex items-center justify-between border-b border-base pb-3 last:border-0">
                <div>
                  <p className="font-medium text-primary">{point.title}</p>
                  <p className="text-xs text-muted">
                    {point.publishedAt ? new Date(point.publishedAt).toLocaleDateString() : '—'} · {point.enps.total} responses
                  </p>
                </div>
                <p className="text-2xl font-bold text-primary">{point.enps.score}</p>
              </div>
            ))
          )}
        </section>
      )}

      <Modal
        open={announcementModal}
        onClose={() => setAnnouncementModal(false)}
        title="Publish company announcement"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAnnouncementModal(false)}>Cancel</Button>
            <Button disabled={submitting || !annTitle.trim() || !annBody.trim()} onClick={() => void handleCreateAnnouncement()}>
              <Send className="h-4 w-4" /> {submitting ? 'Publishing…' : 'Publish'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
          </div>
          <div>
            <Label>Body</Label>
            <Textarea rows={5} value={annBody} onChange={(e) => setAnnBody(e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--bg-muted))] p-3">
            <span className="text-sm">Pin to top of employee dashboard</span>
            <Toggle checked={annPinned} onChange={setAnnPinned} />
          </div>
        </div>
      </Modal>

      <Modal
        open={surveyModal}
        onClose={() => setSurveyModal(false)}
        title="Create & publish survey"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSurveyModal(false)}>Cancel</Button>
            <Button disabled={submitting || !surveyTitle.trim()} onClick={() => void handleCreateSurvey()}>
              {submitting ? 'Publishing…' : 'Publish survey'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={surveyTitle} onChange={(e) => setSurveyTitle(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Type</Label>
              <Select value={surveyType} onChange={(e) => setSurveyType(e.target.value as EngagementSurveyType)}>
                <option value="pulse">Pulse survey</option>
                <option value="enps">eNPS</option>
              </Select>
            </div>
            <div>
              <Label>Question type</Label>
              <Select
                value={surveyQuestionType}
                disabled={surveyType === 'enps'}
                onChange={(e) => setSurveyQuestionType(e.target.value as EngagementQuestionType)}
              >
                {Object.entries(QUESTION_TYPE_LABELS)
                  .filter(([k]) => k !== 'enps')
                  .map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
              </Select>
            </div>
          </div>
          {surveyType !== 'enps' && (
            <div>
              <Label>Question prompt</Label>
              <Textarea rows={2} value={surveyPrompt} onChange={(e) => setSurveyPrompt(e.target.value)} />
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg bg-[rgb(var(--bg-muted))] p-3">
            <div>
              <p className="text-sm font-medium">Anonymous responses</p>
              <p className="text-xs text-muted">Results are aggregated; no individual attribution.</p>
            </div>
            <Toggle checked={surveyAnonymous} onChange={setSurveyAnonymous} />
          </div>
        </div>
      </Modal>

      <Modal
        open={kudosModal}
        onClose={() => setKudosModal(false)}
        title="Give recognition"
        footer={
          <>
            <Button variant="secondary" onClick={() => setKudosModal(false)}>Cancel</Button>
            <Button
              disabled={submitting || !kudosFromId || !kudosToId || !kudosMessage.trim()}
              onClick={() => void handleCreateKudos()}
            >
              {submitting ? 'Sending…' : 'Send kudos'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>From</Label>
            <Select value={kudosFromId} onChange={(e) => setKudosFromId(e.target.value)}>
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>To</Label>
            <Select value={kudosToId} onChange={(e) => setKudosToId(e.target.value)}>
              <option value="">Select employee…</option>
              {employees.filter((emp) => emp.id !== kudosFromId).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Message</Label>
            <Textarea rows={4} value={kudosMessage} onChange={(e) => setKudosMessage(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
