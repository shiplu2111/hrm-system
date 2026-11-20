import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Archive,
  BarChart3,
  ClipboardList,
  Filter,
  Globe,
  Heart,
  Info,
  Loader2,
  Megaphone,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  User,
} from 'lucide-react';
import { useAuth, usePermissions } from '@hrm/portal-ui';
import { KudosFeedModerationSection } from '@/components/engagement/KudosFeedModerationSection';
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
  listAnnouncements,
  listKudos,
  listSurveys,
  publishAnnouncement,
  publishSurvey,
  updateAnnouncement,
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

type PageTab = 'announcements' | 'surveys' | 'results' | 'enps' | 'kudos';

interface QuestionDraft {
  id: string;
  questionType: EngagementQuestionType;
  prompt: string;
  isRequired: boolean;
  options: string[];
}

export function EmployeeEngagementPage({ defaultTab = 'announcements' }: { defaultTab?: PageTab }) {
  const { companyId } = useCompany();
  const { user } = useAuth();
  const { can } = usePermissions();
  const canCreate = can('engagement', 'create');
  const canEdit = can('engagement', 'edit');
  const canViewAudit = can('audit', 'view');

  const [tab, setTab] = useState<PageTab>(defaultTab);
  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);
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
  const [resultsLoading, setResultsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Announcement filters & search
  const [annSearch, setAnnSearch] = useState('');
  const [annStatusFilter, setAnnStatusFilter] = useState<string>('All');

  // Announcement Modal State (Create & Edit)
  const [annModal, setAnnModal] = useState(false);
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annPinned, setAnnPinned] = useState(false);
  const [annExpiresAt, setAnnExpiresAt] = useState('');

  // Survey Builder Modal State
  const [surveyModal, setSurveyModal] = useState(false);
  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyDesc, setSurveyDesc] = useState('');
  const [surveyType, setSurveyType] = useState<EngagementSurveyType>('pulse');
  const [surveyAnonymous, setSurveyAnonymous] = useState(true);
  const [builderQuestions, setBuilderQuestions] = useState<QuestionDraft[]>([]);

  // Survey table filters
  const [surveyStatusFilter, setSurveyStatusFilter] = useState<string>('All');

  // Kudos modal state
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
      if (!selectedSurveyId && surveyRows.length > 0) {
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
    setResultsLoading(true);
    try {
      const res = await getSurveyResults(surveyId);
      setResults(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load survey results');
    } finally {
      setResultsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if ((tab === 'results' || tab === 'enps') && selectedSurveyId) {
      void loadResults(selectedSurveyId);
    }
  }, [tab, selectedSurveyId, loadResults]);

  // Open Announcement Editor (Create or Edit)
  const openAnnouncementModal = (existing?: CompanyAnnouncementRecord) => {
    if (existing) {
      setEditingAnnId(existing.id);
      setAnnTitle(existing.title);
      setAnnBody(existing.body);
      setAnnPinned(existing.isPinned);
      setAnnExpiresAt(existing.expiresAt ? existing.expiresAt.split('T')[0] : '');
    } else {
      setEditingAnnId(null);
      setAnnTitle('');
      setAnnBody('');
      setAnnPinned(false);
      setAnnExpiresAt('');
    }
    setAnnModal(true);
  };

  const handleSaveAnnouncement = async (publishImmediately: boolean) => {
    if (!companyId || !annTitle.trim() || !annBody.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editingAnnId) {
        await updateAnnouncement(editingAnnId, {
          title: annTitle.trim(),
          body: annBody.trim(),
          isPinned: annPinned,
          expiresAt: annExpiresAt ? new Date(annExpiresAt).toISOString() : null,
          status: publishImmediately ? 'published' : undefined,
        });
        if (publishImmediately) {
          await publishAnnouncement(editingAnnId);
        }
      } else {
        const created = await createAnnouncement(companyId, {
          title: annTitle.trim(),
          body: annBody.trim(),
          isPinned: annPinned,
          expiresAt: annExpiresAt ? new Date(annExpiresAt).toISOString() : undefined,
        });
        if (publishImmediately) {
          await publishAnnouncement(created.id);
        }
      }
      setAnnModal(false);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save announcement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePinAnnouncement = async (item: CompanyAnnouncementRecord) => {
    try {
      await updateAnnouncement(item.id, { isPinned: !item.isPinned });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update announcement');
    }
  };

  const handleArchiveAnnouncement = async (announcementId: string) => {
    try {
      await updateAnnouncement(announcementId, { status: 'archived' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to archive announcement');
    }
  };

  const handlePublishAnnouncement = async (announcementId: string) => {
    try {
      await publishAnnouncement(announcementId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish announcement');
    }
  };

  // Open Survey Builder
  const openSurveyBuilder = (type: EngagementSurveyType = 'pulse') => {
    setSurveyType(type);
    setSurveyTitle('');
    setSurveyDesc('');
    setSurveyAnonymous(true);

    if (type === 'enps') {
      setSurveyTitle('Quarterly eNPS & Team Engagement Pulse');
      setBuilderQuestions([
        {
          id: 'q1',
          questionType: 'enps',
          prompt: 'On a scale of 0–10, how likely are you to recommend our company as a great place to work?',
          isRequired: true,
          options: [],
        },
        {
          id: 'q2',
          questionType: 'text',
          prompt: 'What is the primary reason for your score? What could we improve?',
          isRequired: false,
          options: [],
        },
      ]);
    } else {
      setBuilderQuestions([
        {
          id: 'q1',
          questionType: 'rating',
          prompt: 'How satisfied are you with communication and transparency in your team?',
          isRequired: true,
          options: [],
        },
        {
          id: 'q2',
          questionType: 'multiple_choice',
          prompt: 'Which area would you like to see most prioritized this quarter?',
          isRequired: true,
          options: ['Professional Development', 'Work-Life Balance', 'Tools & Infrastructure', 'Recognition & Compensation'],
        },
        {
          id: 'q3',
          questionType: 'text',
          prompt: 'Any additional comments or suggestions for the leadership team?',
          isRequired: false,
          options: [],
        },
      ]);
    }
    setSurveyModal(true);
  };

  const handleAddQuestion = (type: EngagementQuestionType = 'rating') => {
    const newId = `q_${Date.now()}`;
    const defaultPrompt =
      type === 'enps'
        ? 'On a scale of 0–10, how likely are you to recommend this company as a place to work?'
        : type === 'rating'
          ? 'How would you rate your overall team collaboration?'
          : type === 'multiple_choice'
            ? 'Select the option that best reflects your experience:'
            : 'Share any feedback or suggestions you have:';

    const defaultOptions =
      type === 'multiple_choice'
        ? ['Strongly agree', 'Agree', 'Neutral', 'Disagree']
        : [];

    setBuilderQuestions((prev) => [
      ...prev,
      {
        id: newId,
        questionType: type,
        prompt: defaultPrompt,
        isRequired: true,
        options: defaultOptions,
      },
    ]);
  };

  const handleRemoveQuestion = (id: string) => {
    if (builderQuestions.length <= 1) return;
    setBuilderQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleAddOption = (questionId: string) => {
    setBuilderQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, options: [...q.options, `Option ${q.options.length + 1}`] }
          : q,
      ),
    );
  };

  const handleUpdateOption = (questionId: string, index: number, value: string) => {
    setBuilderQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.map((opt, i) => (i === index ? value : opt)),
            }
          : q,
      ),
    );
  };

  const handleRemoveOption = (questionId: string, index: number) => {
    setBuilderQuestions((prev) =>
      prev.map((q) =>
        q.id === questionId
          ? { ...q, options: q.options.filter((_, i) => i !== index) }
          : q,
      ),
    );
  };

  const handleSaveSurvey = async (publishImmediately: boolean) => {
    if (!companyId || !surveyTitle.trim() || builderQuestions.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createSurvey(companyId, {
        title: surveyTitle.trim(),
        description: surveyDesc.trim() || undefined,
        surveyType,
        isAnonymous: surveyAnonymous,
        questions: builderQuestions.map((q) => ({
          questionType: q.questionType,
          prompt: q.prompt.trim(),
          isRequired: q.isRequired,
          options: q.questionType === 'multiple_choice' ? q.options.filter((o) => o.trim()) : undefined,
        })),
      });

      if (publishImmediately) {
        await publishSurvey(created.id);
      }

      setSurveyModal(false);
      await load();
      setSelectedSurveyId(created.id);
      if (publishImmediately) {
        setTab('surveys');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create survey');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishSurvey = async (surveyId: string) => {
    try {
      await publishSurvey(surveyId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to publish survey');
    }
  };

  const handleCloseSurvey = async (surveyId: string) => {
    try {
      await closeSurvey(surveyId);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to close survey');
    }
  };

  const openCreateKudosModal = () => {
    const defaultFrom =
      user?.employeeId && employees.some((emp) => emp.id === user.employeeId)
        ? user.employeeId
        : '';
    setKudosFromId(defaultFrom);
    setKudosToId('');
    setKudosMessage('');
    setKudosModal(true);
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

  // Filtered lists
  const filteredAnnouncements = announcements.filter((a) => {
    const matchesSearch =
      annSearch === '' ||
      a.title.toLowerCase().includes(annSearch.toLowerCase()) ||
      a.body.toLowerCase().includes(annSearch.toLowerCase());
    const matchesStatus =
      annStatusFilter === 'All' ||
      a.status.toLowerCase() === annStatusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  const filteredSurveys = surveys.filter((s) => {
    return (
      surveyStatusFilter === 'All' ||
      s.status.toLowerCase() === surveyStatusFilter.toLowerCase()
    );
  });

  if (!companyId) {
    return <div className="p-6 text-sm text-secondary">Select a company to manage employee engagement.</div>;
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-primary">Employee Engagement</h1>
            <Sparkles className="h-4 w-4 text-accent-500" />
          </div>
          <p className="mt-0.5 text-sm text-secondary">
            Company-wide broadcasts, pulse surveys, anonymous feedback, and eNPS analytics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tab === 'announcements' && canCreate && (
            <Button onClick={() => openAnnouncementModal()}>
              <Plus className="h-4 w-4" /> New announcement
            </Button>
          )}

          {tab === 'surveys' && canCreate && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => openSurveyBuilder('enps')}>
                <TrendingUp className="h-4 w-4 text-indigo-500" /> New eNPS survey
              </Button>
              <Button onClick={() => openSurveyBuilder('pulse')}>
                <Plus className="h-4 w-4" /> New pulse survey
              </Button>
            </div>
          )}

          {tab === 'kudos' && canCreate && (
            <Button onClick={openCreateKudosModal}>
              <Heart className="h-4 w-4 text-rose-200" /> Give recognition
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Engagement Overview Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          {
            label: 'Published announcements',
            value: summary?.publishedAnnouncementCount ?? 0,
            icon: Megaphone,
            color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300',
          },
          {
            label: 'Active pulse surveys',
            value: summary?.activeSurveyCount ?? 0,
            icon: ClipboardList,
            color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300',
          },
          {
            label: 'Anonymous responses',
            value: summary?.totalSurveyResponses ?? 0,
            icon: ShieldCheck,
            color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40 dark:text-purple-300',
          },
          {
            label: 'Latest eNPS score',
            value: summary?.latestEnpsScore != null ? (summary.latestEnpsScore > 0 ? `+${summary.latestEnpsScore}` : summary.latestEnpsScore) : '—',
            icon: TrendingUp,
            color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 dark:text-indigo-300',
            badge:
              summary?.latestEnpsScore != null
                ? summary.latestEnpsScore >= 50
                  ? 'Excellent'
                  : summary.latestEnpsScore >= 20
                    ? 'Good'
                    : summary.latestEnpsScore >= 0
                      ? 'Neutral'
                      : 'Critical'
                : undefined,
          },
          {
            label: 'Recognition this month',
            value: summary?.kudosThisMonthCount ?? 0,
            icon: Sparkles,
            color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300',
          },
        ].map((item) => (
          <div key={item.label} className="surface flex items-center gap-3.5 rounded-xl border border-base p-4 shadow-card">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.color}`}>
              <item.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-primary">{loading ? '…' : item.value}</p>
                {item.badge && (
                  <Badge tone={item.value && Number(item.value) >= 20 ? 'success' : 'warning'}>
                    {item.badge}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-secondary">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Tabs */}
      <div className="surface flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg border border-base p-1 shadow-card">
        {(
          [
            ['announcements', 'Announcements & News', Megaphone],
            ['surveys', 'Survey Management', ClipboardList],
            ['results', 'Survey Results (Aggregated & Anonymous)', BarChart3],
            ['enps', 'eNPS Trends', TrendingUp],
            ['kudos', 'Recognition & Kudos', Sparkles],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-accent-600 text-white shadow-sm'
                : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-secondary">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading engagement data…
        </div>
      ) : tab === 'announcements' ? (
        /* =========================================================================
           TAB 1: ANNOUNCEMENTS & COMPANY NEWS FEED
           ========================================================================= */
        <section className="space-y-4">
          <div className="surface flex flex-col gap-3 rounded-xl border border-base p-4 shadow-card md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={annSearch}
                onChange={(e) => setAnnSearch(e.target.value)}
                placeholder="Search announcements by title or content…"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted" />
              <Select
                value={annStatusFilter}
                onChange={(e) => setAnnStatusFilter(e.target.value)}
                className="min-w-36"
              >
                <option>All</option>
                <option>Published</option>
                <option>Draft</option>
                <option>Archived</option>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredAnnouncements.map((item) => {
              const isExpired = item.expiresAt && new Date(item.expiresAt) < new Date();

              return (
                <article
                  key={item.id}
                  className={`surface rounded-xl border p-5 shadow-card transition-all ${
                    item.isPinned ? 'border-amber-300/80 bg-amber-50/20 dark:border-amber-900/40' : 'border-base'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.isPinned && (
                        <Badge tone="warning">
                          <Pin className="mr-1 h-3 w-3" /> Pinned
                        </Badge>
                      )}
                      <Badge tone={item.status === 'published' ? 'success' : item.status === 'draft' ? 'neutral' : 'error'}>
                        {item.status.toUpperCase()}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-xs text-muted">
                        <Globe className="h-3 w-3" /> Company-wide
                      </span>
                      {isExpired && (
                        <Badge tone="error">Expired</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'draft' && canEdit && (
                        <Button
                          size="sm"
                          onClick={() => void handlePublishAnnouncement(item.id)}
                        >
                          <Send className="h-3.5 w-3.5" /> Publish now
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void handleTogglePinAnnouncement(item)}
                          title={item.isPinned ? 'Unpin announcement' : 'Pin to top of employee feed'}
                        >
                          <Pin className={`h-3.5 w-3.5 ${item.isPinned ? 'fill-current text-amber-600' : ''}`} />
                          {item.isPinned ? 'Unpin' : 'Pin'}
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openAnnouncementModal(item)}
                        >
                          Edit
                        </Button>
                      )}
                      {item.status === 'published' && canEdit && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void handleArchiveAnnouncement(item.id)}
                        >
                          <Archive className="h-3.5 w-3.5" /> Archive
                        </Button>
                      )}
                    </div>
                  </div>

                  <h2 className="mt-3 text-lg font-bold text-primary">{item.title}</h2>
                  <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-secondary">
                    {item.body}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-base pt-3 text-xs text-muted">
                    <span>
                      {item.publishedAt
                        ? `Published ${new Date(item.publishedAt).toLocaleString()}`
                        : `Created ${new Date(item.createdAt).toLocaleString()}`}
                    </span>
                    {item.expiresAt && (
                      <span>Expires on {new Date(item.expiresAt).toLocaleDateString()}</span>
                    )}
                  </div>
                </article>
              );
            })}

            {!filteredAnnouncements.length && (
              <div className="surface rounded-xl border border-base p-12 text-center text-sm text-muted shadow-card">
                No company announcements match your filters.
              </div>
            )}
          </div>
        </section>
      ) : tab === 'surveys' ? (
        /* =========================================================================
           TAB 2: SURVEY & eNPS MANAGEMENT
           ========================================================================= */
        <section className="space-y-4">
          <div className="surface flex flex-col justify-between gap-3 rounded-xl border border-base p-4 shadow-card sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-primary">Filter Surveys:</span>
              <Select
                value={surveyStatusFilter}
                onChange={(e) => setSurveyStatusFilter(e.target.value)}
                className="min-w-36"
              >
                <option>All</option>
                <option>Published</option>
                <option>Draft</option>
                <option>Closed</option>
              </Select>
            </div>
            <div className="text-xs text-muted">
              Surveys gather anonymous employee feedback and calculate automated eNPS.
            </div>
          </div>

          <div className="surface overflow-hidden rounded-xl border border-base shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                  <tr>
                    <th className="px-5 py-3">Survey</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Privacy</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Questions</th>
                    <th className="px-4 py-3">Responses</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {filteredSurveys.map((survey) => (
                    <tr key={survey.id} className="transition-colors hover:bg-[rgb(var(--bg-hover))]">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-primary">{survey.title}</p>
                        {survey.description && (
                          <p className="mt-0.5 text-xs text-muted line-clamp-1">{survey.description}</p>
                        )}
                        <p className="mt-1 text-[11px] text-muted">
                          {survey.publishedAt
                            ? `Published ${new Date(survey.publishedAt).toLocaleDateString()}`
                            : `Drafted ${new Date(survey.createdAt).toLocaleDateString()}`}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={survey.surveyType === 'enps' ? 'accent' : 'info'}>
                          {SURVEY_TYPE_LABELS[survey.surveyType]}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        {survey.isAnonymous ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <ShieldCheck className="h-3.5 w-3.5" /> Anonymous
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-secondary">
                            <User className="h-3.5 w-3.5" /> Identified
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          tone={
                            survey.status === 'published'
                              ? 'success'
                              : survey.status === 'draft'
                                ? 'neutral'
                                : 'error'
                          }
                          dot
                        >
                          {survey.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-secondary">{survey.questions.length}</td>
                      <td className="px-4 py-4 font-semibold text-primary">{survey.responseCount}</td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedSurveyId(survey.id);
                              setTab('results');
                            }}
                          >
                            <BarChart3 className="h-3.5 w-3.5" /> Results
                          </Button>
                          {survey.status === 'draft' && canEdit && (
                            <Button
                              size="sm"
                              onClick={() => void handlePublishSurvey(survey.id)}
                            >
                              <Send className="h-3.5 w-3.5" /> Publish
                            </Button>
                          )}
                          {survey.status === 'published' && canEdit && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => void handleCloseSurvey(survey.id)}
                            >
                              Close
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredSurveys.length && (
                <div className="p-12 text-center text-sm text-muted">No surveys found.</div>
              )}
            </div>
          </div>
        </section>
      ) : tab === 'results' ? (
        /* =========================================================================
           TAB 3: AGGREGATED ANONYMOUS SURVEY & eNPS RESULTS
           ========================================================================= */
        <section className="space-y-5">
          {/* Privacy Guarantee Banner */}
          <div className="flex items-start gap-3 rounded-xl border border-emerald-300/70 bg-emerald-50/80 p-4 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/25 dark:text-emerald-200">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">Aggregated &amp; De-Identified Privacy Guarantee</p>
              <p className="mt-0.5 text-xs opacity-90 leading-relaxed">
                All metrics below are strictly aggregated. For anonymous surveys, respondent IDs and individual identities are decoupled at submission time and cannot be traced or correlated by administrators or leadership.
              </p>
            </div>
          </div>

          {/* Survey Selector Bar */}
          <div className="surface flex flex-col justify-between gap-4 rounded-xl border border-base p-4 shadow-card sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-3">
              <Label htmlFor="results-survey-select" className="shrink-0 font-medium">
                Select Survey:
              </Label>
              <Select
                id="results-survey-select"
                value={selectedSurveyId}
                onChange={(e) => setSelectedSurveyId(e.target.value)}
                className="max-w-md"
              >
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} ({s.responseCount} responses) — {s.status.toUpperCase()}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void loadResults(selectedSurveyId)}
                disabled={resultsLoading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resultsLoading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
            </div>
          </div>

          {resultsLoading && (
            <div className="flex items-center justify-center p-12 text-secondary">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Aggregating survey results…
            </div>
          )}

          {!resultsLoading && results && (
            <div className="space-y-6">
              {/* Survey Header Overview */}
              <div className="surface rounded-xl border border-base p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={results.surveyType === 'enps' ? 'accent' : 'info'}>
                        {SURVEY_TYPE_LABELS[results.surveyType]}
                      </Badge>
                      <Badge tone={results.isAnonymous ? 'success' : 'neutral'}>
                        {results.isAnonymous ? 'Strictly Anonymous' : 'Identified'}
                      </Badge>
                    </div>
                    <h2 className="mt-2 text-xl font-bold text-primary">{results.title}</h2>
                    <p className="mt-1 text-sm text-secondary">
                      Based on {results.responseCount} submitted response{results.responseCount === 1 ? '' : 's'}.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-extrabold text-primary">{results.responseCount}</span>
                    <p className="text-xs text-muted uppercase tracking-wider font-semibold">Total Responses</p>
                  </div>
                </div>

                {results.responseCount < 3 && results.responseCount > 0 && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                    <Info className="h-4 w-4 shrink-0" />
                    <span>Low response threshold active: Full statistical confidence requires at least 3 submissions.</span>
                  </div>
                )}
              </div>

              {/* eNPS Gauge & Breakdown Card */}
              {results.enps && (
                <div className="surface rounded-xl border border-base p-6 shadow-card">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-primary">Employee Net Promoter Score (eNPS)</h3>
                        <Badge
                          tone={
                            results.enps.score >= 50
                              ? 'success'
                              : results.enps.score >= 20
                                ? 'accent'
                                : results.enps.score >= 0
                                  ? 'warning'
                                  : 'error'
                          }
                        >
                          {results.enps.score >= 50
                            ? 'Excellent'
                            : results.enps.score >= 20
                              ? 'Good'
                              : results.enps.score >= 0
                                ? 'Needs Attention'
                                : 'Critical'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        Formula: % Promoters (9-10) minus % Detractors (0-6). Scale: -100 to +100.
                      </p>
                    </div>

                    <div className="text-center md:text-right">
                      <span
                        className={`text-5xl font-black ${
                          results.enps.score >= 20
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : results.enps.score >= 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {results.enps.score > 0 ? `+${results.enps.score}` : results.enps.score}
                      </span>
                      <p className="text-xs font-semibold text-secondary uppercase tracking-wider">Overall eNPS</p>
                    </div>
                  </div>

                  {/* Visual Spectrum Distribution Bar */}
                  {results.enps.total > 0 && (
                    <div className="mt-6 space-y-2">
                      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          style={{ width: `${(results.enps.promoters / results.enps.total) * 100}%` }}
                          className="bg-emerald-500 transition-all"
                          title={`Promoters: ${results.enps.promoters}`}
                        />
                        <div
                          style={{ width: `${(results.enps.passives / results.enps.total) * 100}%` }}
                          className="bg-amber-400 transition-all"
                          title={`Passives: ${results.enps.passives}`}
                        />
                        <div
                          style={{ width: `${(results.enps.detractors / results.enps.total) * 100}%` }}
                          className="bg-rose-500 transition-all"
                          title={`Detractors: ${results.enps.detractors}`}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                        <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/25">
                          <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                            {results.enps.promoters}{' '}
                            <span className="text-xs font-normal">
                              ({Math.round((results.enps.promoters / results.enps.total) * 100)}%)
                            </span>
                          </p>
                          <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                            Promoters (Score 9–10)
                          </p>
                        </div>

                        <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/25">
                          <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                            {results.enps.passives}{' '}
                            <span className="text-xs font-normal">
                              ({Math.round((results.enps.passives / results.enps.total) * 100)}%)
                            </span>
                          </p>
                          <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
                            Passives (Score 7–8)
                          </p>
                        </div>

                        <div className="rounded-lg bg-rose-50 p-3 dark:bg-rose-950/25">
                          <p className="text-xl font-bold text-rose-700 dark:text-rose-300">
                            {results.enps.detractors}{' '}
                            <span className="text-xs font-normal">
                              ({Math.round((results.enps.detractors / results.enps.total) * 100)}%)
                            </span>
                          </p>
                          <p className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                            Detractors (Score 0–6)
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Questions Breakdown */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-secondary">
                  Question-by-Question Aggregate Results
                </h3>

                {results.questions.map((q, idx) => (
                  <div key={q.questionId} className="surface rounded-xl border border-base p-5 shadow-card">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base pb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--bg-muted))] text-xs font-bold text-secondary">
                          {idx + 1}
                        </span>
                        <h4 className="font-semibold text-primary">{q.prompt}</h4>
                      </div>
                      <Badge tone="neutral">{QUESTION_TYPE_LABELS[q.questionType]}</Badge>
                    </div>

                    <div className="mt-4">
                      {/* Rating Scale Result */}
                      {q.questionType === 'rating' && (
                        <div className="flex items-center gap-4">
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-extrabold text-primary">
                              {q.averageRating != null ? q.averageRating.toFixed(1) : '—'}
                            </span>
                            <span className="text-sm text-muted">/ 5.0</span>
                          </div>
                          <div className="flex items-center gap-1 text-amber-400">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-5 w-5 ${
                                  (q.averageRating ?? 0) >= star
                                    ? 'fill-amber-400 text-amber-400'
                                    : (q.averageRating ?? 0) >= star - 0.5
                                      ? 'fill-amber-400/50 text-amber-400'
                                      : 'text-slate-300 dark:text-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted">
                            ({q.responseCount} answer{q.responseCount === 1 ? '' : 's'})
                          </span>
                        </div>
                      )}

                      {/* Multiple Choice Breakdown */}
                      {q.questionType === 'multiple_choice' && (
                        <div className="space-y-3">
                          {q.optionCounts?.map((row) => {
                            const pct = q.responseCount ? Math.round((row.count / q.responseCount) * 100) : 0;
                            return (
                              <div key={row.option} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium text-primary">{row.option}</span>
                                  <span className="font-semibold text-secondary">
                                    {row.count} ({pct}%)
                                  </span>
                                </div>
                                <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                                  <div
                                    className="h-2.5 rounded-full bg-accent-500 transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* eNPS Question Aggregate */}
                      {q.questionType === 'enps' && q.enps && (
                        <div className="text-sm text-secondary">
                          Score: <strong>{q.enps.score > 0 ? `+${q.enps.score}` : q.enps.score}</strong> ({q.enps.total} responses)
                        </div>
                      )}

                      {/* Qualitative Text Responses (Anonymized Quotes) */}
                      {q.questionType === 'text' && (
                        <div>
                          {q.textResponses && q.textResponses.length > 0 ? (
                            <div className="grid gap-2.5 sm:grid-cols-2">
                              {q.textResponses.map((text, i) => (
                                <div
                                  key={i}
                                  className="rounded-lg border border-base bg-[rgb(var(--bg-muted))] p-3.5 text-xs italic text-secondary leading-relaxed"
                                >
                                  &ldquo;{text}&rdquo;
                                  <div className="mt-2 text-right not-italic text-[10px] text-muted font-medium">
                                    — Anonymous Respondent
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs italic text-muted">No text responses submitted yet.</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!resultsLoading && !results && (
            <div className="surface rounded-xl border border-base p-12 text-center text-sm text-muted shadow-card">
              Please select a survey above to inspect aggregated results.
            </div>
          )}
        </section>
      ) : tab === 'enps' ? (
        /* =========================================================================
           TAB 4: eNPS HISTORICAL TRENDS
           ========================================================================= */
        <section className="space-y-4">
          <div className="surface rounded-xl border border-base p-5 shadow-card">
            <h3 className="text-base font-bold text-primary">Organizational eNPS Trajectory</h3>
            <p className="mt-0.5 text-xs text-muted">
              Historical timeline of Employee Net Promoter Scores over time across closed and published surveys.
            </p>

            <div className="mt-6 space-y-4">
              {enpsTrends.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted">
                  No eNPS survey history available yet.
                </div>
              ) : (
                enpsTrends.map((point) => (
                  <div
                    key={point.surveyId}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-base bg-[rgb(var(--bg-muted))] p-4 transition-all"
                  >
                    <div>
                      <p className="font-semibold text-primary">{point.title}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        Published on {point.publishedAt ? new Date(point.publishedAt).toLocaleDateString() : '—'} ·{' '}
                        {point.enps.total} responses
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <span className="text-emerald-700 dark:text-emerald-400">
                          {point.enps.promoters} Promoters
                        </span>
                        <span>·</span>
                        <span className="text-amber-700 dark:text-amber-400">
                          {point.enps.passives} Passives
                        </span>
                        <span>·</span>
                        <span className="text-rose-700 dark:text-rose-400">
                          {point.enps.detractors} Detractors
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-3xl font-black ${
                          point.enps.score >= 20
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : point.enps.score >= 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {point.enps.score > 0 ? `+${point.enps.score}` : point.enps.score}
                      </span>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">eNPS Score</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      ) : (
        /* =========================================================================
           TAB 5: RECOGNITION & KUDOS FEED + ADMIN MODERATION VIEW
           ========================================================================= */
        <KudosFeedModerationSection
          companyId={companyId}
          employees={employees}
          canModerate={canEdit}
          canViewAudit={canViewAudit}
          initialKudosFeed={kudosFeed}
          onRefreshParent={load}
          onError={(msg) => setError(msg)}
        />
      )}

      {/* =========================================================================
          MODAL: ANNOUNCEMENT EDITOR (CREATE & EDIT)
         ========================================================================= */}
      <Modal
        open={annModal}
        onClose={() => setAnnModal(false)}
        title={editingAnnId ? 'Edit Announcement' : 'Publish Company Announcement'}
        description="Share official news, leadership updates, or notices company-wide."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAnnModal(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={submitting || !annTitle.trim() || !annBody.trim()}
              onClick={() => void handleSaveAnnouncement(false)}
            >
              Save as Draft
            </Button>
            <Button
              disabled={submitting || !annTitle.trim() || !annBody.trim()}
              onClick={() => void handleSaveAnnouncement(true)}
            >
              <Send className="h-4 w-4" /> {submitting ? 'Publishing…' : 'Publish Company-Wide'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="ann-title">Announcement Headline</Label>
            <Input
              id="ann-title"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              placeholder="e.g. Q4 Company Strategy Town Hall & Product Roadmap"
            />
          </div>

          <div>
            <Label htmlFor="ann-body">Announcement Body / Content</Label>
            <Textarea
              id="ann-body"
              rows={6}
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="Write the full announcement text here…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="ann-expiry">Expiry Date (Optional)</Label>
              <Input
                id="ann-expiry"
                type="date"
                value={annExpiresAt}
                onChange={(e) => setAnnExpiresAt(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-muted">
                Automatically archived from employee feeds after this date.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-base bg-[rgb(var(--bg-muted))] p-3">
              <div>
                <p className="text-sm font-medium text-primary">Pin to top</p>
                <p className="text-xs text-muted">Feature prominently on dashboard.</p>
              </div>
              <Toggle checked={annPinned} onChange={setAnnPinned} />
            </div>
          </div>
        </div>
      </Modal>

      {/* =========================================================================
          MODAL: SURVEY & eNPS BUILDER (MULTI-QUESTION)
         ========================================================================= */}
      <Modal
        open={surveyModal}
        onClose={() => setSurveyModal(false)}
        title={surveyType === 'enps' ? 'Create eNPS Survey' : 'Create & Publish Pulse Survey'}
        description="Design multi-question surveys with automated aggregation and strict anonymity."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSurveyModal(false)}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              disabled={submitting || !surveyTitle.trim() || builderQuestions.length === 0}
              onClick={() => void handleSaveSurvey(false)}
            >
              Save as Draft
            </Button>
            <Button
              disabled={submitting || !surveyTitle.trim() || builderQuestions.length === 0}
              onClick={() => void handleSaveSurvey(true)}
            >
              <Send className="h-4 w-4" /> {submitting ? 'Publishing…' : 'Publish Survey'}
            </Button>
          </>
        }
      >
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Basic Survey Information */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="survey-title">Survey Title</Label>
              <Input
                id="survey-title"
                value={surveyTitle}
                onChange={(e) => setSurveyTitle(e.target.value)}
                placeholder="e.g. Q4 2026 Workplace Culture & Satisfaction Survey"
              />
            </div>

            <div>
              <Label htmlFor="survey-desc">Description / Instructions for Employees (Optional)</Label>
              <Textarea
                id="survey-desc"
                rows={2}
                value={surveyDesc}
                onChange={(e) => setSurveyDesc(e.target.value)}
                placeholder="e.g. Please take 3 minutes to share your honest perspective. Your responses are strictly anonymous."
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="survey-type">Survey Category</Label>
                <Select
                  id="survey-type"
                  value={surveyType}
                  onChange={(e) => setSurveyType(e.target.value as EngagementSurveyType)}
                >
                  <option value="pulse">Pulse Survey (Custom Questions)</option>
                  <option value="enps">eNPS Survey (0–10 Scale)</option>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-base bg-[rgb(var(--bg-muted))] p-3">
                <div>
                  <p className="text-sm font-semibold text-primary flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> Anonymous Responses
                  </p>
                  <p className="text-[11px] text-muted">Decouple respondent identities.</p>
                </div>
                <Toggle checked={surveyAnonymous} onChange={setSurveyAnonymous} />
              </div>
            </div>
          </div>

          {/* Questions Builder Section */}
          <div className="border-t border-base pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-primary">Survey Questions ({builderQuestions.length})</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => handleAddQuestion('rating')}>
                  + Rating Scale
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleAddQuestion('multiple_choice')}>
                  + Multiple Choice
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleAddQuestion('text')}>
                  + Text
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {builderQuestions.map((q, idx) => (
                <div key={q.id} className="rounded-xl border border-base bg-[rgb(var(--bg-muted))] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--bg-base))] text-xs font-bold text-primary">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-secondary">
                        {QUESTION_TYPE_LABELS[q.questionType]}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.isRequired}
                          onChange={(e) =>
                            setBuilderQuestions((prev) =>
                              prev.map((item) =>
                                item.id === q.id ? { ...item, isRequired: e.target.checked } : item,
                              ),
                            )
                          }
                          className="rounded"
                        />
                        Required
                      </label>

                      {builderQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(q.id)}
                          className="text-muted hover:text-danger-600 transition-colors p-1"
                          title="Remove question"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Question Prompt</Label>
                    <Input
                      value={q.prompt}
                      onChange={(e) =>
                        setBuilderQuestions((prev) =>
                          prev.map((item) =>
                            item.id === q.id ? { ...item, prompt: e.target.value } : item,
                          ),
                        )
                      }
                      placeholder="e.g. How satisfied are you with company culture?"
                    />
                  </div>

                  {/* Multiple Choice Options List */}
                  {q.questionType === 'multiple_choice' && (
                    <div className="rounded-lg border border-base bg-[rgb(var(--bg-base))] p-3 space-y-2">
                      <Label className="text-xs font-semibold">Multiple Choice Options</Label>
                      <div className="space-y-1.5">
                        {q.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <span className="text-xs text-muted w-4">{optIdx + 1}.</span>
                            <Input
                              value={opt}
                              onChange={(e) => handleUpdateOption(q.id, optIdx, e.target.value)}
                              className="h-8 text-xs flex-1"
                              placeholder={`Option ${optIdx + 1}`}
                            />
                            {q.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveOption(q.id, optIdx)}
                                className="text-muted hover:text-danger-600 p-1"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleAddOption(q.id)}
                        className="mt-2 text-xs"
                      >
                        + Add another option
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* =========================================================================
          MODAL: GIVE RECOGNITION (KUDOS)
         ========================================================================= */}
      <Modal
        open={kudosModal}
        onClose={() => setKudosModal(false)}
        title="Give Employee Recognition"
        description="Publicly recognize a colleague for outstanding contribution or teamwork."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setKudosModal(false)}>
              Cancel
            </Button>
            <Button
              disabled={submitting || !kudosFromId || !kudosToId || !kudosMessage.trim()}
              onClick={() => void handleCreateKudos()}
            >
              <Heart className="h-4 w-4" /> {submitting ? 'Sending…' : 'Share Kudos'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="kudos-from">From Employee</Label>
            <Select id="kudos-from" value={kudosFromId} onChange={(e) => setKudosFromId(e.target.value)}>
              <option value="">Select recognized by…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="kudos-to">Recognize Employee</Label>
            <Select id="kudos-to" value={kudosToId} onChange={(e) => setKudosToId(e.target.value)}>
              <option value="">Select recipient colleague…</option>
              {employees.filter((emp) => emp.id !== kudosFromId).map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="kudos-message">Appreciation Message</Label>
            <Textarea
              id="kudos-message"
              rows={4}
              value={kudosMessage}
              onChange={(e) => setKudosMessage(e.target.value)}
              placeholder="e.g. Thank you for your leadership during the product launch! Your attention to detail made all the difference."
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
