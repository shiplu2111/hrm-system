import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Eye,
  EyeOff,
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type {
  KbArticleListItem,
  KbArticleRecord,
  KbArticleStatusFilter,
  KbCategoryRecord,
} from '@hrm/shared-types';
import { KbMarkdown } from '@/components/support/KbMarkdown';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  createKbArticle,
  createKbCategory,
  deleteKbArticle,
  deleteKbCategory,
  getKbArticle,
  listKbArticles,
  listKbCategories,
  updateKbArticle,
  updateKbCategory,
} from '@/lib/support-api';
import { KB_MARKDOWN_HINTS } from '@/lib/support-labels';
import { ApiError } from '@/lib/tenant-api-client';
import { formatDateTime, formatRelative } from '@/lib/webhooks-display';

const STATUS_TABS: Array<{ id: KbArticleStatusFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'draft', label: 'Drafts' },
];

const LIMITS = { titleMin: 3, titleMax: 200, summaryMin: 10, summaryMax: 500, bodyMin: 10 };

type ConfirmAction =
  | { kind: 'delete-article'; article: KbArticleListItem }
  | { kind: 'delete-category'; category: KbCategoryRecord };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

export function KnowledgeBaseAdminPage() {
  const { can } = usePermissions();
  const canEdit = can('support', 'edit');

  const [categories, setCategories] = useState<KbCategoryRecord[]>([]);
  const [articles, setArticles] = useState<KbArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<KbArticleStatusFilter>('all');

  const [editor, setEditor] = useState<{ articleId: string | null } | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [categoryRows, articleRows] = await Promise.all([
        listKbCategories(),
        listKbArticles({ search: search || undefined }),
      ]);
      setCategories(categoryRows);
      setArticles(articleRows);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the knowledge base'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  const inCategory = useMemo(
    () => (categoryFilter ? articles.filter((a) => a.categoryId === categoryFilter) : articles),
    [articles, categoryFilter],
  );
  const statusCounts = useMemo(
    () => ({
      all: inCategory.length,
      published: inCategory.filter((a) => a.published).length,
      draft: inCategory.filter((a) => !a.published).length,
    }),
    [inCategory],
  );
  const visible = useMemo(
    () =>
      inCategory.filter((a) =>
        statusFilter === 'all' ? true : statusFilter === 'published' ? a.published : !a.published,
      ),
    [inCategory, statusFilter],
  );
  const totalViews = useMemo(
    () => articles.reduce((sum, article) => sum + article.viewCount, 0),
    [articles],
  );

  const togglePublished = async (article: KbArticleListItem) => {
    setBusyId(article.id);
    setError(null);
    try {
      await updateKbArticle(article.id, { published: !article.published });
      setNotice(
        article.published
          ? `“${article.title}” moved to drafts. Employees can no longer see it.`
          : `“${article.title}” is published and visible in the Help Center.`,
      );
      await load();
    } catch (err) {
      setError(errorMessage(err, 'Could not update the article'));
    } finally {
      setBusyId(null);
    }
  };

  const runConfirm = async () => {
    if (!confirm) return;
    if (confirm.kind === 'delete-article') {
      await deleteKbArticle(confirm.article.id);
      setNotice(`“${confirm.article.title}” was deleted.`);
    } else {
      await deleteKbCategory(confirm.category.id);
      if (categoryFilter === confirm.category.id) setCategoryFilter('');
      setNotice(`Category “${confirm.category.name}” was deleted.`);
    }
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading knowledge base…
      </div>
    );
  }

  const hasFilters = Boolean(search || categoryFilter || statusFilter !== 'all');

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-primary">Knowledge Base</h1>
          <p className="mt-0.5 text-sm text-secondary">
            Write help articles for admins and employees. Published articles appear in the Help Center and in My
            Space → Help &amp; Support; drafts are only visible here.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:shrink-0 xl:flex-nowrap">
          <Button
            variant="secondary"
            onClick={() => {
              setRefreshing(true);
              void load();
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          {canEdit ? (
            <>
              <Button variant="secondary" onClick={() => setCategoriesOpen(true)}>
                <FolderTree className="h-4 w-4" /> Categories
              </Button>
              <Button
                onClick={() => setEditor({ articleId: null })}
                disabled={categories.length === 0}
                title={categories.length === 0 ? 'Create a category first' : undefined}
              >
                <Plus className="h-4 w-4" /> New article
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div
          role="status"
          className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:bg-success-950/30 dark:text-success-300"
        >
          {notice}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Articles" value={articles.length} />
        <Stat label="Published" value={articles.filter((a) => a.published).length} />
        <Stat label="Drafts" value={articles.filter((a) => !a.published).length} />
        <Stat label="Total views" value={totalViews} />
      </div>

      {categories.length === 0 ? (
        <section className="surface flex flex-col items-center gap-3 rounded-xl border border-base p-10 text-center shadow-card">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400">
            <FolderTree className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-primary">Start with a category</h2>
            <p className="mt-1 max-w-md text-sm text-secondary">
              Articles are grouped into categories such as Payroll, Leave or Attendance. Create one, then add your
              first article.
            </p>
          </div>
          {canEdit ? (
            <Button onClick={() => setCategoriesOpen(true)}>
              <Plus className="h-4 w-4" /> Create category
            </Button>
          ) : null}
        </section>
      ) : (
        <section className="surface rounded-xl border border-base shadow-card">
          <div className="flex flex-col gap-3 border-b border-base p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex rounded-lg border border-base p-0.5">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-accent-600 text-white shadow-sm'
                      : 'text-secondary hover:bg-[rgb(var(--bg-hover))]'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-1.5 ${statusFilter === tab.id ? 'text-white/80' : 'text-muted'}`}>
                    {statusCounts[tab.id]}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search title, summary or body"
                  className="pl-9"
                  aria-label="Search articles"
                />
              </div>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
                className="sm:w-52"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-10 text-center">
              <BookOpen className="h-8 w-8 text-muted" />
              <p className="text-sm text-secondary">
                {hasFilters ? 'No articles match these filters.' : 'No articles yet.'}
              </p>
              {hasFilters ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setSearchInput('');
                    setCategoryFilter('');
                    setStatusFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              ) : canEdit ? (
                <Button size="sm" onClick={() => setEditor({ articleId: null })}>
                  <Plus className="h-3.5 w-3.5" /> Write the first article
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base text-left text-xs uppercase tracking-wide text-muted">
                    <th className="px-4 py-2.5 font-medium">Article</th>
                    <th className="px-4 py-2.5 font-medium">Category</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Views</th>
                    <th className="px-4 py-2.5 font-medium">Last updated</th>
                    {canEdit ? <th className="px-4 py-2.5" /> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {visible.map((article) => (
                    <tr key={article.id} className="align-top hover:bg-[rgb(var(--bg-hover))]/50">
                      <td className="max-w-md px-4 py-3">
                        <button
                          type="button"
                          className="text-left font-medium text-primary hover:text-accent-600"
                          onClick={() => setEditor({ articleId: article.id })}
                          disabled={!canEdit}
                        >
                          {article.title}
                        </button>
                        <p className="mt-0.5 line-clamp-2 text-xs text-secondary">{article.summary}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-secondary">{article.categoryName}</td>
                      <td className="px-4 py-3">
                        <StatusPill tone={article.published ? 'success' : 'neutral'}>
                          {article.published ? 'Published' : 'Draft'}
                        </StatusPill>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-secondary">
                        {article.viewCount.toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-secondary">
                        <span title={formatDateTime(article.updatedAt)}>{formatRelative(article.updatedAt)}</span>
                        {article.updatedByName ? (
                          <span className="block text-muted">by {article.updatedByName}</span>
                        ) : null}
                      </td>
                      {canEdit ? (
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditor({ articleId: article.id })}
                              aria-label={`Edit ${article.title}`}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={busyId === article.id}
                              onClick={() => void togglePublished(article)}
                            >
                              {article.published ? (
                                <>
                                  <EyeOff className="h-3.5 w-3.5" /> Unpublish
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3.5 w-3.5" /> Publish
                                </>
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-error-600 hover:text-error-700"
                              onClick={() => setConfirm({ kind: 'delete-article', article })}
                              aria-label={`Delete ${article.title}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {editor ? (
        <ArticleEditorModal
          articleId={editor.articleId}
          categories={categories}
          defaultCategoryId={categoryFilter || categories[0]?.id || ''}
          onClose={() => setEditor(null)}
          onSaved={(article, created) => {
            setEditor(null);
            setNotice(
              created
                ? `“${article.title}” was ${article.published ? 'published' : 'saved as a draft'}.`
                : `“${article.title}” was saved${article.published ? '' : ' as a draft'}.`,
            );
            void load();
          }}
        />
      ) : null}

      <CategoryManagerModal
        open={categoriesOpen}
        categories={categories}
        onClose={() => setCategoriesOpen(false)}
        onChanged={() => void load()}
        onDelete={(category) => setConfirm({ kind: 'delete-category', category })}
      />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'delete-category' ? 'Delete category?' : 'Delete article?'}
        description={
          confirm?.kind === 'delete-category' ? (
            <>Category “{confirm.category.name}” will be removed. It has no articles.</>
          ) : confirm?.kind === 'delete-article' ? (
            <>
              “{confirm.article.title}” will be removed permanently
              {confirm.article.published ? ' and disappear from the Help Center' : ''}. To hide it temporarily, unpublish
              it instead.
            </>
          ) : null
        }
        confirmLabel="Delete"
        onConfirm={runConfirm}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface rounded-xl border border-base px-4 py-3 shadow-card">
      <p className="text-xs text-secondary">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-primary">{value.toLocaleString()}</p>
    </div>
  );
}

interface ArticleDraft {
  title: string;
  categoryId: string;
  summary: string;
  body: string;
}

function ArticleEditorModal({
  articleId,
  categories,
  defaultCategoryId,
  onClose,
  onSaved,
}: {
  articleId: string | null;
  categories: KbCategoryRecord[];
  defaultCategoryId: string;
  onClose: () => void;
  onSaved: (article: KbArticleRecord, created: boolean) => void;
}) {
  const [existing, setExisting] = useState<KbArticleRecord | null>(null);
  const [draft, setDraft] = useState<ArticleDraft>({
    title: '',
    categoryId: defaultCategoryId,
    summary: '',
    body: '',
  });
  const [initial, setInitial] = useState<ArticleDraft | null>(null);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [loading, setLoading] = useState(articleId !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    if (!articleId) {
      setInitial({ title: '', categoryId: defaultCategoryId, summary: '', body: '' });
      return;
    }
    let cancelled = false;
    getKbArticle(articleId, { preview: true })
      .then((article) => {
        if (cancelled) return;
        const loaded = {
          title: article.title,
          categoryId: article.categoryId,
          summary: article.summary,
          body: article.body,
        };
        setExisting(article);
        setDraft(loaded);
        setInitial(loaded);
      })
      .catch((err) => !cancelled && setError(errorMessage(err, 'Could not load the article')))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [articleId, defaultCategoryId]);

  const dirty =
    initial !== null &&
    (draft.title !== initial.title ||
      draft.categoryId !== initial.categoryId ||
      draft.summary !== initial.summary ||
      draft.body !== initial.body);

  const problems = {
    title:
      draft.title.trim().length < LIMITS.titleMin ? `Title needs at least ${LIMITS.titleMin} characters` : null,
    categoryId: draft.categoryId ? null : 'Choose a category',
    summary:
      draft.summary.trim().length < LIMITS.summaryMin
        ? `Summary needs at least ${LIMITS.summaryMin} characters`
        : null,
    body: draft.body.trim().length < LIMITS.bodyMin ? `Body needs at least ${LIMITS.bodyMin} characters` : null,
  };
  const valid = !Object.values(problems).some(Boolean);

  const requestClose = () => {
    if (saving) return;
    if (dirty) setDiscardOpen(true);
    else onClose();
  };

  const save = async (published: boolean) => {
    setTouched(true);
    if (!valid) {
      if (problems.body && !problems.title && !problems.summary) setTab('write');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      title: draft.title.trim(),
      categoryId: draft.categoryId,
      summary: draft.summary.trim(),
      body: draft.body.trim(),
      published,
    };
    try {
      const saved = existing
        ? await updateKbArticle(existing.id, payload)
        : await createKbArticle(payload);
      onSaved(saved, !existing);
    } catch (err) {
      setError(errorMessage(err, 'Could not save the article'));
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: keyof typeof problems) =>
    touched && problems[key] ? <p className="mt-1 text-xs text-error-600">{problems[key]}</p> : null;

  const isPublished = existing?.published ?? false;
  const categoryName = categories.find((c) => c.id === draft.categoryId)?.name;

  return (
    <>
      <Modal
        open
        onClose={requestClose}
        title={articleId ? 'Edit article' : 'New article'}
        description={
          existing
            ? `${isPublished ? 'Published' : 'Draft'} · ${existing.viewCount.toLocaleString()} view${existing.viewCount === 1 ? '' : 's'} · last saved ${formatDateTime(existing.updatedAt)}`
            : articleId
              ? undefined
              : 'Drafts stay private until you publish them.'
        }
        size="xl"
        footer={
          loading ? null : (
            <>
              <Button variant="secondary" onClick={requestClose} disabled={saving}>
                Cancel
              </Button>
              {isPublished ? (
                <>
                  <Button variant="outline" onClick={() => void save(false)} disabled={saving}>
                    Move to drafts
                  </Button>
                  <Button onClick={() => void save(true)} disabled={saving || (existing !== null && !dirty)}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => void save(false)} disabled={saving}>
                    {existing ? 'Save draft' : 'Save as draft'}
                  </Button>
                  <Button onClick={() => void save(true)} disabled={saving}>
                    {saving ? 'Saving…' : existing ? 'Save & publish' : 'Publish'}
                  </Button>
                </>
              )}
            </>
          )
        }
      >
        {loading ? (
          <div className="flex items-center justify-center p-10 text-secondary">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading article…
          </div>
        ) : (
          <div className="space-y-4">
            {error ? (
              <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <Label htmlFor="kb-title">Title</Label>
                <Input
                  id="kb-title"
                  value={draft.title}
                  maxLength={LIMITS.titleMax}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="e.g. Submit a leave request"
                  autoFocus
                />
                {fieldError('title')}
              </div>
              <div>
                <Label htmlFor="kb-category">Category</Label>
                <Select
                  id="kb-category"
                  value={draft.categoryId}
                  onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
                >
                  <option value="">Choose…</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
                {fieldError('categoryId')}
              </div>
            </div>

            {existing ? (
              <p className="-mt-2 text-xs text-muted">
                Link slug: <span className="font-mono">{existing.slug}</span> (stays the same when you rename the
                article)
              </p>
            ) : null}

            <div>
              <div className="flex items-baseline justify-between">
                <Label htmlFor="kb-summary">Summary</Label>
                <span className="text-xs text-muted">
                  {draft.summary.trim().length}/{LIMITS.summaryMax}
                </span>
              </div>
              <Textarea
                id="kb-summary"
                rows={2}
                maxLength={LIMITS.summaryMax}
                value={draft.summary}
                onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
                placeholder="One or two sentences shown in search results and article lists."
              />
              {fieldError('summary')}
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-primary">Body</span>
                <div className="inline-flex rounded-lg border border-base p-0.5">
                  {(['write', 'preview'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTab(value)}
                      className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                        tab === value
                          ? 'bg-accent-600 text-white shadow-sm'
                          : 'text-secondary hover:bg-[rgb(var(--bg-hover))]'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              {tab === 'write' ? (
                <>
                  <Textarea
                    id="kb-body"
                    aria-label="Article body"
                    rows={14}
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                    placeholder={'## Steps\n1. Open Leave → Requests\n2. Choose a leave type and dates\n\nAdd **tips** or [links](https://example.com) as needed.'}
                    className="font-mono text-[13px] leading-relaxed"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                    <span>Markdown:</span>
                    {KB_MARKDOWN_HINTS.map((hint) => (
                      <span key={hint.syntax} title={hint.label}>
                        <code className="font-mono">{hint.syntax}</code>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="min-h-[18rem] rounded-lg border border-base bg-[rgb(var(--bg-muted))]/30 p-4">
                  {draft.title.trim() ? (
                    <h2 className="text-lg font-semibold text-primary">{draft.title.trim()}</h2>
                  ) : null}
                  {categoryName ? (
                    <p className="mt-0.5 text-xs text-muted">{categoryName}</p>
                  ) : null}
                  {draft.summary.trim() ? (
                    <p className="mt-3 text-sm text-secondary">{draft.summary.trim()}</p>
                  ) : null}
                  <div className="mt-4 border-t border-base pt-4">
                    {draft.body.trim() ? (
                      <KbMarkdown source={draft.body} />
                    ) : (
                      <p className="text-sm text-muted">Nothing to preview yet.</p>
                    )}
                  </div>
                </div>
              )}
              {fieldError('body')}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={discardOpen}
        title="Discard changes?"
        description="Your edits to this article haven’t been saved."
        confirmLabel="Discard"
        onConfirm={async () => onClose()}
        onClose={() => setDiscardOpen(false)}
      />
    </>
  );
}

function CategoryManagerModal({
  open,
  categories,
  onClose,
  onChanged,
  onDelete,
}: {
  open: boolean;
  categories: KbCategoryRecord[];
  onClose: () => void;
  onChanged: () => void;
  onDelete: (category: KbCategoryRecord) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', sortOrder: '' });
  const [newForm, setNewForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setEditingId(null);
      setError(null);
    }
  }, [open]);

  const startEdit = (category: KbCategoryRecord) => {
    setEditingId(category.id);
    setForm({
      name: category.name,
      description: category.description ?? '',
      sortOrder: String(category.sortOrder),
    });
    setError(null);
  };

  const saveEdit = async (category: KbCategoryRecord) => {
    if (form.name.trim().length < 2) {
      setError('Category names need at least 2 characters');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const sortOrder = Number.parseInt(form.sortOrder, 10);
      await updateKbCategory(category.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        sortOrder: Number.isFinite(sortOrder) && sortOrder >= 0 ? sortOrder : category.sortOrder,
      });
      setEditingId(null);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, 'Could not save the category'));
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (newForm.name.trim().length < 2) {
      setError('Category names need at least 2 characters');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const nextOrder = categories.reduce((max, c) => Math.max(max, c.sortOrder), -1) + 1;
      await createKbCategory({
        name: newForm.name.trim(),
        description: newForm.description.trim() || undefined,
        sortOrder: nextOrder,
      });
      setNewForm({ name: '', description: '' });
      onChanged();
    } catch (err) {
      setError(errorMessage(err, 'Could not create the category'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Categories"
      description="Categories group articles in the Help Center. Lower order numbers are listed first."
      size="lg"
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-sm text-error-700 dark:bg-error-950/30 dark:text-error-300">
            {error}
          </div>
        ) : null}

        {categories.length > 0 ? (
          <ul className="divide-y divide-[rgb(var(--border-base))] rounded-lg border border-base">
            {categories.map((category) =>
              editingId === category.id ? (
                <li key={category.id} className="space-y-2 bg-[rgb(var(--bg-muted))]/30 p-3">
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_90px]">
                    <Input
                      value={form.name}
                      maxLength={80}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      aria-label="Category name"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={form.sortOrder}
                      onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                      aria-label="Order"
                      title="Order"
                    />
                  </div>
                  <Input
                    value={form.description}
                    maxLength={500}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Description (optional)"
                    aria-label="Category description"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditingId(null)} disabled={saving}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => void saveEdit(category)} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </li>
              ) : (
                <li key={category.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-8 text-center font-mono text-xs text-muted" title="Order">
                    {category.sortOrder}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-primary">{category.name}</p>
                    {category.description ? (
                      <p className="truncate text-xs text-secondary">{category.description}</p>
                    ) : null}
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted">
                    {category.articleCount ?? 0} article{category.articleCount === 1 ? '' : 's'}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => startEdit(category)} aria-label={`Edit ${category.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-error-600 hover:text-error-700"
                    disabled={(category.articleCount ?? 0) > 0}
                    title={
                      (category.articleCount ?? 0) > 0
                        ? 'Move or delete its articles before deleting the category'
                        : 'Delete category'
                    }
                    onClick={() => onDelete(category)}
                    aria-label={`Delete ${category.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ),
            )}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-base p-4 text-center text-sm text-secondary">
            No categories yet.
          </p>
        )}

        <div className="space-y-2 rounded-lg border border-base p-3">
          <p className="text-sm font-medium text-primary">Add category</p>
          <Input
            value={newForm.name}
            maxLength={80}
            onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
            placeholder="Name, e.g. Payroll"
            aria-label="New category name"
          />
          <Input
            value={newForm.description}
            maxLength={500}
            onChange={(e) => setNewForm({ ...newForm, description: e.target.value })}
            placeholder="Description (optional)"
            aria-label="New category description"
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => void create()} disabled={saving || !newForm.name.trim()}>
              <Plus className="h-3.5 w-3.5" /> Add category
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
