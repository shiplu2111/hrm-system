import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CmsDashboardPageSummaryDto,
  CmsDashboardSummaryDto,
} from '@hrm/shared-types';
import {
  AlertCircle,
  AlertTriangle,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileEdit,
  FilePlus2,
  FileText,
  Globe2,
  History,
  Languages,
  Link2Off,
  PenSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermission';
import {
  createCmsCustomPage,
  createCmsPostDraft,
  fetchCmsDashboard,
  runCmsScheduledJobs,
} from '@/lib/platform-cms-api';
import { RichTextEditor } from '@/components/cms/RichTextEditor';

type DashboardTab =
  | 'drafts'
  | 'scheduled'
  | 'pending_approval'
  | 'recently_published'
  | 'missing_bn'
  | 'broken_links'
  | 'all_pages'
  | 'recent_posts';

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);
  if (absSec < 60) return diffSec <= 0 ? 'just now' : 'in a moment';
  const mins = Math.round(absSec / 60);
  if (mins < 60) return diffSec <= 0 ? `${mins}m ago` : `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return diffSec <= 0 ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  return diffSec <= 0 ? `${days}d ago` : `in ${days}d`;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toKebabSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    scheduled: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800',
    published: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    unpublished: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    trashed: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
    pending_approval: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold capitalize ${
        styles[status] || styles.draft
      }`}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function ContentDashboardPage() {
  const { can, user, roleName } = usePermissions();
  const canViewCms = can('cms', 'view');
  const canCreateCms = can('cms', 'create');
  const canPublishCms = can('cms', 'manage');

  const [summary, setSummary] = useState<CmsDashboardSummaryDto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('drafts');
  const [searchQuery, setSearchQuery] = useState('');
  const [runningSchedule, setRunningSchedule] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Quick-create Page modal
  const [createPageOpen, setCreatePageOpen] = useState(false);
  const [pageTitleEn, setPageTitleEn] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [pageSlugDirty, setPageSlugDirty] = useState(false);
  const [pageSeoDesc, setPageSeoDesc] = useState('');
  const [pageBodyHtml, setPageBodyHtml] = useState('<p></p>');
  const [pageChangeNote, setPageChangeNote] = useState('');
  const [submittingPage, setSubmittingPage] = useState(false);
  const [pageModalError, setPageModalError] = useState<string | null>(null);

  // Quick-create Blog Post modal
  const [createPostOpen, setCreatePostOpen] = useState(false);
  const [postTitleEn, setPostTitleEn] = useState('');
  const [postSlug, setPostSlug] = useState('');
  const [postSlugDirty, setPostSlugDirty] = useState(false);
  const [postCategoryId, setPostCategoryId] = useState('');
  const [postAuthorId, setPostAuthorId] = useState('');
  const [postExcerptEn, setPostExcerptEn] = useState('');
  const [postBodyHtmlEn, setPostBodyHtmlEn] = useState('<p></p>');
  const [postTitleBn, setPostTitleBn] = useState('');
  const [postExcerptBn, setPostExcerptBn] = useState('');
  const [postBodyHtmlBn, setPostBodyHtmlBn] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [postModalError, setPostModalError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!canViewCms) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCmsDashboard();
      setSummary(data);
      if (data.postCategories.length > 0) {
        setPostCategoryId((prev) => prev || data.postCategories[0].id);
      }
      if (data.authors.length > 0) {
        setPostAuthorId((prev) => prev || data.authors[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load CMS Content Dashboard.');
    } finally {
      setLoading(false);
    }
  }, [canViewCms]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Entire CMS Dashboard section is strictly gated behind cms:view permission
  if (!canViewCms) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[440px] text-center p-8 rounded-2xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-sm max-w-xl mx-auto my-8">
        <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 mb-4">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold text-[rgb(var(--text-primary))] mb-2">
          CMS Section Restricted
        </h1>
        <p className="text-sm text-[rgb(var(--text-secondary))] max-w-md">
          Your role (<span className="font-semibold">{roleName || 'Operator'}</span>) does not hold{' '}
          <code>cms:view</code> permission to access Website CMS workflows or Content Dashboard metrics.
        </p>
      </div>
    );
  }

  const handleOpenCreatePage = () => {
    window.dispatchEvent(new CustomEvent('hrm:platform-navigate', { detail: 'cms-create-page' }));
  };

  const handleOpenCreatePost = () => {
    setPostTitleEn('');
    setPostSlug('');
    setPostSlugDirty(false);
    setPostExcerptEn('');
    setPostBodyHtmlEn('<p></p>');
    setPostTitleBn('');
    setPostExcerptBn('');
    setPostBodyHtmlBn('');
    setPostModalError(null);
    if (summary?.postCategories?.[0] && !postCategoryId) {
      setPostCategoryId(summary.postCategories[0].id);
    }
    if (summary?.authors?.[0] && !postAuthorId) {
      setPostAuthorId(summary.authors[0].id);
    }
    setCreatePostOpen(true);
  };

  const handleCreatePageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateCms) return;
    if (!pageTitleEn.trim() || !pageSlug.trim()) {
      setPageModalError('English title and URL slug are required.');
      return;
    }

    setSubmittingPage(true);
    setPageModalError(null);
    try {
      const hasBody = pageBodyHtml.replace(/<[^>]+>/g, '').trim().length > 0;
      const blocksEn: unknown[] = [
        {
          id: 'hero-heading',
          type: 'heading',
          props: {
            level: 1,
            text: pageTitleEn.trim(),
            align: 'left',
          },
        },
        ...(hasBody
          ? [
              {
                id: 'intro-rich-text',
                type: 'rich_text',
                props: { html: pageBodyHtml },
              },
            ]
          : []),
      ];

      const created = await createCmsCustomPage({
        slug: pageSlug.trim(),
        titleEn: pageTitleEn.trim(),
        seoTitleEn: pageTitleEn.trim(),
        seoDescriptionEn: pageSeoDesc.trim() || undefined,
        blocksEn,
        changeNote: pageChangeNote.trim() || undefined,
      });

      setCreatePageOpen(false);
      setActiveTab('drafts');
      setNotice(`Created draft page "/${created.slug}".`);
      await loadDashboard();
    } catch (err) {
      setPageModalError(err instanceof Error ? err.message : 'Failed to create page draft.');
    } finally {
      setSubmittingPage(false);
    }
  };

  const handleCreatePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateCms) return;
    if (!postTitleEn.trim() || !postSlug.trim() || !postExcerptEn.trim()) {
      setPostModalError('Title, slug, and excerpt are required.');
      return;
    }
    if (!postCategoryId || !postAuthorId) {
      setPostModalError('Blog category and author profile are required.');
      return;
    }

    setSubmittingPost(true);
    setPostModalError(null);
    try {
      const hasBn = Boolean(postTitleBn.trim() && postBodyHtmlBn.replace(/<[^>]+>/g, '').trim());
      const created = await createCmsPostDraft({
        slug: postSlug.trim(),
        categoryId: postCategoryId,
        authorId: postAuthorId,
        titleEn: postTitleEn.trim(),
        excerptEn: postExcerptEn.trim(),
        bodyHtmlEn: postBodyHtmlEn || '<p></p>',
        titleBn: postTitleBn.trim() || null,
        excerptBn: postExcerptBn.trim() || null,
        bodyHtmlBn: postBodyHtmlBn.trim() || null,
        isBnTranslated: hasBn,
      });

      setCreatePostOpen(false);
      setActiveTab('recent_posts');
      setNotice(`Created blog post draft "/blog/${created.slug}".`);
      await loadDashboard();
    } catch (err) {
      setPostModalError(err instanceof Error ? err.message : 'Failed to create blog post draft.');
    } finally {
      setSubmittingPost(false);
    }
  };

  const handleRunScheduled = async () => {
    if (!canPublishCms) return;
    setRunningSchedule(true);
    setNotice(null);
    try {
      const res = await runCmsScheduledJobs();
      setNotice(
        `Processed scheduled queue: ${res.publishedPages} page(s), ${res.publishedPosts} post(s), ${res.publishedChangelog} changelog entry(s) published.`,
      );
      await loadDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run scheduled publish queue.');
    } finally {
      setRunningSchedule(false);
    }
  };

  const filteredPages = useMemo<CmsDashboardPageSummaryDto[]>(() => {
    if (!summary) return [];
    let base: CmsDashboardPageSummaryDto[] = [];
    if (activeTab === 'drafts') base = summary.draftPages;
    else if (activeTab === 'scheduled') base = summary.scheduledPages;
    else if (activeTab === 'pending_approval') base = summary.pendingApprovalPages;
    else if (activeTab === 'recently_published') base = summary.recentlyPublishedPages;
    else if (activeTab === 'missing_bn') base = summary.missingBnPages;
    else if (activeTab === 'all_pages') base = summary.recentPages;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (p) =>
        p.slug.toLowerCase().includes(q) ||
        (p.titleEn && p.titleEn.toLowerCase().includes(q)),
    );
  }, [summary, activeTab, searchQuery]);

  const filteredBrokenPages = useMemo(() => {
    if (!summary) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return summary.brokenLinkPages;
    return summary.brokenLinkPages.filter(
      (bp) =>
        bp.slug.toLowerCase().includes(q) ||
        bp.occurrences.some((o) => o.href.toLowerCase().includes(q)),
    );
  }, [summary, searchQuery]);

  const filteredPosts = useMemo(() => {
    if (!summary) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return summary.recentPosts;
    return summary.recentPosts.filter(
      (post) =>
        post.slug.toLowerCase().includes(q) ||
        post.titleEn.toLowerCase().includes(q),
    );
  }, [summary, searchQuery]);

  const counts = summary?.counts;

  const statCards: Array<{
    tab: DashboardTab;
    label: string;
    value: number;
    hint: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
  }> = [
    {
      tab: 'drafts',
      label: 'Drafts',
      value: counts?.drafts ?? 0,
      hint: `${counts?.draftPosts ?? 0} draft blog post(s)`,
      icon: FileEdit,
      tone: 'text-slate-700 bg-slate-500/10 border-slate-500/20 dark:text-slate-300',
    },
    {
      tab: 'scheduled',
      label: 'Scheduled',
      value: counts?.scheduled ?? 0,
      hint: 'Queued for timezone auto-publish',
      icon: CalendarClock,
      tone: 'text-indigo-700 bg-indigo-500/10 border-indigo-500/20 dark:text-indigo-300',
    },
    {
      tab: 'pending_approval',
      label: 'Pending Approval',
      value: counts?.pendingApproval ?? 0,
      hint: 'Legal Stage F four-eyes review',
      icon: ShieldCheck,
      tone: 'text-amber-700 bg-amber-500/10 border-amber-500/20 dark:text-amber-300',
    },
    {
      tab: 'recently_published',
      label: 'Recently Published',
      value: counts?.recentlyPublished ?? 0,
      hint: 'Published in the last 30 days',
      icon: CheckCircle2,
      tone: 'text-emerald-700 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-300',
    },
    {
      tab: 'missing_bn',
      label: 'Missing BN Translation',
      value: counts?.missingBengaliTranslation ?? 0,
      hint: 'Falling back to English on /bn',
      icon: Languages,
      tone: 'text-orange-700 bg-orange-500/10 border-orange-500/20 dark:text-orange-300',
    },
    {
      tab: 'broken_links',
      label: 'Pages with Broken Links',
      value: counts?.pagesWithBrokenLinks ?? 0,
      hint: 'Unresolved internal URLs or media',
      icon: Link2Off,
      tone: 'text-rose-700 bg-rose-500/10 border-rose-500/20 dark:text-rose-300',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Quick Create Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary-600 dark:text-primary-300 uppercase tracking-wider mb-1">
            <Globe2 className="h-3.5 w-3.5" />
            Website CMS Workspace
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--text-primary))]">
            Content Dashboard
          </h1>
          <p className="text-sm text-[rgb(var(--text-secondary))] mt-0.5">
            Track publishing queues, legal reviews, Bengali localization coverage, and link health.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {canPublishCms && (counts?.scheduled ?? 0) > 0 && (
            <button
              type="button"
              onClick={handleRunScheduled}
              disabled={runningSchedule}
              className="h-9 px-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Clock className="h-3.5 w-3.5" />
              {runningSchedule ? 'Publishing due...' : 'Process Scheduled Queue'}
            </button>
          )}

          {canCreateCms && (
            <>
              <button
                type="button"
                onClick={handleOpenCreatePage}
                className="h-9 px-3.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                Create Page
              </button>
              <button
                type="button"
                onClick={handleOpenCreatePost}
                className="h-9 px-3.5 rounded-lg border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
              >
                <PenSquare className="h-3.5 w-3.5 text-primary-600" />
                Create Blog Post
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent('hrm:platform-navigate', { detail: 'cms-pages' }))
            }
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            All Pages
          </button>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(new CustomEvent('hrm:platform-navigate', { detail: 'cms-blog' }))
            }
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <PenSquare className="h-3.5 w-3.5" />
            Blog & Authors
          </button>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('hrm:platform-navigate', { detail: 'cms-changelog' }),
              )
            }
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Clock className="h-3.5 w-3.5" />
            Changelog
          </button>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('hrm:platform-navigate', { detail: 'cms-careers' }),
              )
            }
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <Briefcase className="h-3.5 w-3.5" />
            Careers
          </button>
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('hrm:platform-navigate', { detail: 'cms-faqs' }),
              )
            }
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            FAQ Library
          </button>
        </div>
      </div>

      {/* Notifications / Errors */}
      {notice && (
        <div className="px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notice">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 6 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        {statCards.map((card) => {
          const Icon = card.icon;
          const isSelected = activeTab === card.tab;
          return (
            <button
              key={card.tab}
              type="button"
              onClick={() => setActiveTab(card.tab)}
              className={`text-left rounded-xl border p-4 transition-all bg-[rgb(var(--bg-surface))] shadow-sm hover:shadow ${
                isSelected
                  ? 'border-primary-600 ring-2 ring-primary-600/20'
                  : 'border-[rgb(var(--border-base))] hover:border-[rgb(var(--border-strong))]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`h-9 w-9 rounded-lg border inline-flex items-center justify-center ${card.tone}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-medium text-[rgb(var(--text-muted))]">
                  View queue
                </span>
              </div>
              <div className="text-2xl font-bold tabular-nums text-[rgb(var(--text-primary))]">
                {loading && !summary ? '—' : card.value}
              </div>
              <div className="text-xs font-semibold text-[rgb(var(--text-primary))] mt-0.5">
                {card.label}
              </div>
              <div className="text-[11px] text-[rgb(var(--text-muted))] mt-1 line-clamp-1">
                {card.hint}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Split Grid: Work Queues (2 cols) + Recent Changes (1 col) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Columns: Content Queues & Broken Link Inspector */}
        <div className="xl:col-span-2 rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'drafts', label: `Drafts (${counts?.drafts ?? 0})` },
                  { id: 'scheduled', label: `Scheduled (${counts?.scheduled ?? 0})` },
                  { id: 'pending_approval', label: `Approvals (${counts?.pendingApproval ?? 0})` },
                  { id: 'recently_published', label: `Published (${counts?.recentlyPublished ?? 0})` },
                  { id: 'missing_bn', label: `Missing BN (${counts?.missingBengaliTranslation ?? 0})` },
                  { id: 'broken_links', label: `Broken Links (${counts?.pagesWithBrokenLinks ?? 0})` },
                  { id: 'recent_posts', label: `Blog Posts (${counts?.totalPosts ?? 0})` },
                  { id: 'all_pages', label: `All Pages (${counts?.totalPages ?? 0})` },
                ] as Array<{ id: DashboardTab; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-[rgb(var(--text-secondary))] hover:bg-[rgb(var(--bg-hover))] hover:text-[rgb(var(--text-primary))]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative shrink-0">
              <Search className="h-3.5 w-3.5 text-[rgb(var(--text-muted))] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by slug or title..."
                className="h-8 pl-8 pr-3 w-full sm:w-52 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
          </div>

          <div className="divide-y divide-[rgb(var(--border-base))] flex-1">
            {loading && !summary ? (
              <div className="p-10 text-center text-xs text-[rgb(var(--text-muted))]">
                Loading content queues and running link health scan...
              </div>
            ) : activeTab === 'broken_links' ? (
              filteredBrokenPages.length === 0 ? (
                <div className="p-10 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">No broken internal links detected</p>
                  <p className="text-xs text-[rgb(var(--text-muted))] mt-1">
                    All page block links and Media Library references resolve cleanly.
                  </p>
                </div>
              ) : (
                filteredBrokenPages.map((bp) => (
                  <div key={bp.pageId} className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                        <span className="text-sm font-semibold font-mono">/{bp.slug}</span>
                        <StatusBadge status={bp.pageStatus} />
                      </div>
                      <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                        {bp.brokenCount} broken {bp.brokenCount === 1 ? 'link' : 'links'}
                      </span>
                    </div>

                    <div className="space-y-1.5 pl-6">
                      {bp.occurrences.map((occ, idx) => (
                        <div
                          key={`${occ.blockId}-${idx}`}
                          className="rounded-lg border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <code className="font-mono text-rose-700 dark:text-rose-300 break-all">
                              {occ.href}
                            </code>
                            <span className="text-[11px] text-[rgb(var(--text-muted))] uppercase">
                              {occ.locale} · v{occ.versionNumber} · {occ.blockType}
                            </span>
                          </div>
                          <p className="text-[11px] text-[rgb(var(--text-secondary))] mt-0.5">
                            {occ.reason}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )
            ) : activeTab === 'recent_posts' ? (
              filteredPosts.length === 0 ? (
                <div className="p-10 text-center text-xs text-[rgb(var(--text-muted))]">
                  No blog posts found yet.
                </div>
              ) : (
                filteredPosts.map((post) => (
                  <div
                    key={post.id}
                    className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[rgb(var(--bg-muted))]/40"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold truncate">{post.titleEn}</span>
                        <StatusBadge status={post.status} />
                        {!post.isBnTranslated && (
                          <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20 text-[10px] font-medium">
                            Missing BN
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[rgb(var(--text-muted))] font-mono mt-0.5">
                        /blog/{post.slug}
                      </p>
                    </div>
                    <div className="text-xs text-[rgb(var(--text-muted))] shrink-0">
                      {post.publishedAt
                        ? `Published ${formatRelativeTime(post.publishedAt)}`
                        : post.scheduledAt
                        ? `Scheduled ${formatDateTime(post.scheduledAt)}`
                        : 'Draft'}
                    </div>
                  </div>
                ))
              )
            ) : filteredPages.length === 0 ? (
              <div className="p-10 text-center">
                <FileText className="h-8 w-8 text-[rgb(var(--text-muted))] mx-auto mb-2" />
                <p className="text-sm font-medium">No pages in this queue</p>
                <p className="text-xs text-[rgb(var(--text-muted))] mt-1">
                  {activeTab === 'drafts' && canCreateCms
                    ? 'Use "Create Page" above to start a new custom CMS draft.'
                    : 'Nothing currently requires attention in this bucket.'}
                </p>
              </div>
            ) : (
              filteredPages.map((page) => (
                <div
                  key={page.id}
                  className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[rgb(var(--bg-muted))]/40"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold truncate">
                        {page.titleEn || `/${page.slug}`}
                      </span>
                      <StatusBadge status={page.status} />
                      {page.approvalStatus !== 'none' && (
                        <StatusBadge status={page.approvalStatus} />
                      )}
                      {page.isBnTranslated ? (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-medium">
                          BN Ready
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20 text-[10px] font-medium">
                          Missing BN
                        </span>
                      )}
                      {page.brokenLinksCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-[10px] font-semibold">
                          {page.brokenLinksCount} broken link{page.brokenLinksCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[rgb(var(--text-muted))] mt-1">
                      <span className="font-mono">/{page.slug}</span>
                      <span>·</span>
                      <span className="capitalize">{page.kind}</span>
                      {page.scheduledAt && (
                        <>
                          <span>·</span>
                          <span>
                            Scheduled: {formatDateTime(page.scheduledAt)}{' '}
                            {page.scheduledTimezone ? `(${page.scheduledTimezone})` : ''}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-medium text-[rgb(var(--text-secondary))]">
                      {page.publishedAt && activeTab === 'recently_published'
                        ? `Published ${formatRelativeTime(page.publishedAt)}`
                        : `Updated ${formatRelativeTime(page.updatedAt)}`}
                    </div>
                    <div className="text-[11px] text-[rgb(var(--text-muted))]">
                      {formatDateTime(
                        activeTab === 'recently_published' && page.publishedAt
                          ? page.publishedAt
                          : page.updatedAt,
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Recent Changes Feed (Who & When) */}
        <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-primary-600" />
              <h2 className="text-sm font-semibold">Recent Changes</h2>
            </div>
            <span className="text-[11px] text-[rgb(var(--text-muted))]">Who &amp; when</span>
          </div>

          <div className="divide-y divide-[rgb(var(--border-base))] max-h-[580px] overflow-y-auto">
            {loading && !summary ? (
              <div className="p-6 text-center text-xs text-[rgb(var(--text-muted))]">
                Loading recent CMS activity...
              </div>
            ) : !summary || summary.recentChanges.length === 0 ? (
              <div className="p-8 text-center">
                <History className="h-7 w-7 text-[rgb(var(--text-muted))] mx-auto mb-2" />
                <p className="text-xs font-medium">No CMS changes recorded yet</p>
                <p className="text-[11px] text-[rgb(var(--text-muted))] mt-1">
                  Page edits, approvals, publishes, and media uploads appear here with actor and timestamp.
                </p>
              </div>
            ) : (
              summary.recentChanges.map((item) => (
                <div key={item.id} className="px-4 py-3 space-y-1 hover:bg-[rgb(var(--bg-muted))]/35">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-primary-600/10 text-primary-700 dark:text-primary-300 font-mono text-[10px] font-semibold">
                      {item.action}
                    </span>
                    <span
                      className="text-[11px] text-[rgb(var(--text-muted))]"
                      title={formatDateTime(item.createdAt)}
                    >
                      {formatRelativeTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[rgb(var(--text-primary))] leading-snug">
                    {item.summary}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-[rgb(var(--text-muted))]">
                    <span className="truncate">
                      By <strong className="font-medium text-[rgb(var(--text-secondary))]">{item.actorName}</strong>
                      {item.actorEmail ? ` (${item.actorEmail})` : ''}
                    </span>
                    <span className="shrink-0 ml-2">{formatDateTime(item.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Quick Create Page Modal */}
      {createPageOpen && canCreateCms && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-create-page-title"
        >
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FilePlus2 className="h-4 w-4 text-primary-600" />
                <h2 id="quick-create-page-title" className="text-sm font-semibold">
                  Create Custom CMS Page (Draft)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCreatePageOpen(false)}
                aria-label="Close modal"
                className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePageSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {pageModalError && (
                <div className="px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{pageModalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Page Title (English) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={pageTitleEn}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPageTitleEn(val);
                      if (!pageSlugDirty) setPageSlug(toKebabSlug(val));
                    }}
                    placeholder="e.g. Enterprise Payroll Architecture"
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    URL Slug <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={pageSlug}
                    onChange={(e) => {
                      setPageSlugDirty(true);
                      setPageSlug(toKebabSlug(e.target.value));
                    }}
                    placeholder="enterprise-payroll-architecture"
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">SEO Meta Description (optional)</label>
                <input
                  type="text"
                  value={pageSeoDesc}
                  onChange={(e) => setPageSeoDesc(e.target.value)}
                  placeholder="Short search summary for this page"
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Initial Rich Text Content</label>
                <RichTextEditor
                  value={pageBodyHtml}
                  onChange={(html) => setPageBodyHtml(html)}
                  locale="en"
                  mediaFolder="pages"
                  currentUser={user}
                  minHeightClassName="min-h-[180px]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Change Note</label>
                <input
                  type="text"
                  value={pageChangeNote}
                  onChange={(e) => setPageChangeNote(e.target.value)}
                  placeholder="Initial draft note"
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[rgb(var(--border-base))]">
                <button
                  type="button"
                  onClick={() => setCreatePageOpen(false)}
                  className="h-9 px-4 rounded-lg border border-[rgb(var(--border-base))] text-xs font-medium hover:bg-[rgb(var(--bg-hover))]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPage}
                  className="h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {submittingPage ? 'Creating...' : 'Create Page Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Create Blog Post Modal */}
      {createPostOpen && canCreateCms && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-create-post-title"
        >
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PenSquare className="h-4 w-4 text-primary-600" />
                <h2 id="quick-create-post-title" className="text-sm font-semibold">
                  Create Blog Post (Draft)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setCreatePostOpen(false)}
                aria-label="Close modal"
                className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-[rgb(var(--bg-hover))]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePostSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {postModalError && (
                <div className="px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{postModalError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Post Title (English) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={postTitleEn}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPostTitleEn(val);
                      if (!postSlugDirty) setPostSlug(toKebabSlug(val));
                    }}
                    placeholder="e.g. Statutory Tax Rules Explained"
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Post Slug <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={postSlug}
                    onChange={(e) => {
                      setPostSlugDirty(true);
                      setPostSlug(toKebabSlug(e.target.value));
                    }}
                    placeholder="statutory-tax-rules-explained"
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Category</label>
                  <select
                    value={postCategoryId}
                    onChange={(e) => setPostCategoryId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  >
                    {(summary?.postCategories ?? []).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Author</label>
                  <select
                    value={postAuthorId}
                    onChange={(e) => setPostAuthorId(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  >
                    {(summary?.authors ?? []).map((author) => (
                      <option key={author.id} value={author.id}>
                        {author.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Excerpt (English) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={postExcerptEn}
                  onChange={(e) => setPostExcerptEn(e.target.value)}
                  placeholder="Concise summary for blog index cards and social meta"
                  className="w-full p-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Article Body (English)</label>
                <RichTextEditor
                  value={postBodyHtmlEn}
                  onChange={(html) => setPostBodyHtmlEn(html)}
                  locale="en"
                  mediaFolder="blog"
                  currentUser={user}
                  minHeightClassName="min-h-[180px]"
                />
              </div>

              <details className="rounded-lg border border-[rgb(var(--border-base))] p-3 bg-[rgb(var(--bg-muted))]/35">
                <summary className="text-xs font-semibold cursor-pointer">
                  Optional Bengali Translation (বাংলা অনুবাদ)
                </summary>
                <div className="space-y-3 mt-3">
                  <input
                    type="text"
                    lang="bn"
                    value={postTitleBn}
                    onChange={(e) => setPostTitleBn(e.target.value)}
                    placeholder="বাংলা শিরোনাম (ঐচ্ছিক)"
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                  <textarea
                    rows={2}
                    lang="bn"
                    value={postExcerptBn}
                    onChange={(e) => setPostExcerptBn(e.target.value)}
                    placeholder="সংক্ষিপ্ত সারসংক্ষেপ (ঐচ্ছিক)"
                    className="w-full p-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                  />
                  <RichTextEditor
                    value={postBodyHtmlBn}
                    onChange={(html) => setPostBodyHtmlBn(html)}
                    locale="bn"
                    mediaFolder="blog"
                    currentUser={user}
                    minHeightClassName="min-h-[150px]"
                  />
                </div>
              </details>

              <div className="flex justify-end gap-2 pt-2 border-t border-[rgb(var(--border-base))]">
                <button
                  type="button"
                  onClick={() => setCreatePostOpen(false)}
                  className="h-9 px-4 rounded-lg border border-[rgb(var(--border-base))] text-xs font-medium hover:bg-[rgb(var(--bg-hover))]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPost}
                  className="h-9 px-4 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {submittingPost ? 'Creating...' : 'Create Post Draft'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
