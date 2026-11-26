import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CmsAuthorDto,
  CmsPostCategoryDto,
  CmsPostDto,
  CmsPostStatus,
} from '@hrm/shared-types';
import {
  AlertTriangle,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  FolderKanban,
  Globe,
  Image as ImageIcon,
  Languages,
  Plus,
  RefreshCw,
  RotateCcw,
  Rss,
  Search,
  Send,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  createCmsAuthor,
  createCmsPostCategory,
  deleteCmsAuthor,
  deleteCmsPostCategory,
  listCmsAuthors,
  listCmsPostCategories,
  listCmsPosts,
  permanentDeleteCmsPost,
  publishCmsPost,
  restoreCmsPost,
  runCmsScheduledJobs,
  trashCmsPost,
  unpublishCmsPost,
  updateCmsAuthor,
  updateCmsPostCategory,
} from '@/lib/platform-cms-api';
import { hasPlatformPermission } from '@/lib/permissions';
import { usePermissions } from '@/hooks/usePermission';
import { BlogPostEditorModal } from '@/components/cms/BlogPostEditorModal';
import { MediaLibraryPickerModal } from '@/components/cms/MediaLibraryPickerModal';
import { generateBlogSlugFromTitle } from '@/components/cms/blog-editor-utils';

type ActiveTab = 'posts' | 'categories' | 'authors';

const STATUS_BADGES: Record<CmsPostStatus, string> = {
  published: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  scheduled: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  draft: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  unpublished: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  trashed: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
};

export function BlogManagementPage() {
  const { user: currentUser } = usePermissions();
  const canCreate = hasPlatformPermission(currentUser, 'cms', 'create');
  const canEdit = hasPlatformPermission(currentUser, 'cms', 'edit');
  const canManage = hasPlatformPermission(currentUser, 'cms', 'manage');
  const canDelete = hasPlatformPermission(currentUser, 'cms', 'delete');

  const [activeTab, setActiveTab] = useState<ActiveTab>('posts');
  const [posts, setPosts] = useState<CmsPostDto[]>([]);
  const [categories, setCategories] = useState<CmsPostCategoryDto[]>([]);
  const [authors, setAuthors] = useState<CmsAuthorDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<CmsPostStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [localeFilter, setLocaleFilter] = useState<'all' | 'bn_translated' | 'bn_missing'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Post Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<CmsPostDto | null>(null);

  // Permanent delete modal
  const [permDeleteTarget, setPermDeleteTarget] = useState<CmsPostDto | null>(null);
  const [permDeleteConfirm, setPermDeleteConfirm] = useState('');

  // Category modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CmsPostCategoryDto | null>(null);
  const [catNameEn, setCatNameEn] = useState('');
  const [catNameBn, setCatNameBn] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDescEn, setCatDescEn] = useState('');
  const [catSortOrder, setCatSortOrder] = useState(0);

  // Author modal
  const [authorModalOpen, setAuthorModalOpen] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState<CmsAuthorDto | null>(null);
  const [authNameEn, setAuthNameEn] = useState('');
  const [authNameBn, setAuthNameBn] = useState('');
  const [authSlug, setAuthSlug] = useState('');
  const [authRoleEn, setAuthRoleEn] = useState('');
  const [authRoleBn, setAuthRoleBn] = useState('');
  const [authBioEn, setAuthBioEn] = useState('');
  const [authAvatarId, setAuthAvatarId] = useState<string | null>(null);
  const [authAvatarUrl, setAuthAvatarUrl] = useState<string | null>(null);
  const [authActive, setAuthActive] = useState(true);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [postList, catList, authorList] = await Promise.all([
        listCmsPosts({ includeTrashed: true }),
        listCmsPostCategories(),
        listCmsAuthors(),
      ]);
      setPosts(postList);
      setCategories(catList);
      setAuthors(authorList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blog CMS data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const publishedCount = useMemo(
    () => posts.filter((p) => p.status === 'published').length,
    [posts],
  );

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      if (statusFilter === 'all') {
        if (post.status === 'trashed') return false;
      } else if (post.status !== statusFilter) {
        return false;
      }
      if (categoryFilter !== 'all' && post.categoryId !== categoryFilter) return false;
      if (authorFilter !== 'all' && post.authorId !== authorFilter) return false;
      if (localeFilter === 'bn_translated' && !post.isBnTranslated) return false;
      if (localeFilter === 'bn_missing' && post.isBnTranslated) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const hit =
          post.titleEn.toLowerCase().includes(q) ||
          (post.titleBn || '').toLowerCase().includes(q) ||
          post.slug.toLowerCase().includes(q) ||
          post.excerptEn.toLowerCase().includes(q) ||
          post.tags.some((t) => t.toLowerCase().includes(q));
        if (!hit) return false;
      }
      return true;
    });
  }, [posts, statusFilter, categoryFilter, authorFilter, localeFilter, searchQuery]);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );
  const authorMap = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);

  const handleOpenNewPost = () => {
    setEditingPost(null);
    setEditorOpen(true);
  };

  const handleOpenEditPost = (post: CmsPostDto) => {
    setEditingPost(post);
    setEditorOpen(true);
  };

  const handleQuickAction = async (fn: () => Promise<void>, successMessage: string) => {
    setError(null);
    try {
      await fn();
      setNotice(successMessage);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Blog action failed.');
    }
  };

  const handleRunScheduled = async () => {
    setError(null);
    try {
      const res = await runCmsScheduledJobs();
      setNotice(
        `Scheduled publish check complete: ${res.publishedPosts} post(s), ${res.publishedPages} page(s) published.`,
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute scheduled jobs.');
    }
  };

  const handlePermanentDelete = async () => {
    if (!permDeleteTarget) return;
    setError(null);
    try {
      await permanentDeleteCmsPost(permDeleteTarget.id, permDeleteConfirm);
      setNotice(`Permanently deleted post "/blog/${permDeleteTarget.slug}".`);
      setPermDeleteTarget(null);
      setPermDeleteConfirm('');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Permanent delete failed.');
    }
  };

  const openCategoryModal = (cat: CmsPostCategoryDto | null) => {
    setEditingCat(cat);
    if (cat) {
      setCatNameEn(cat.nameEn);
      setCatNameBn(cat.nameBn ?? '');
      setCatSlug(cat.slug);
      setCatDescEn(cat.descriptionEn ?? '');
      setCatSortOrder(cat.sortOrder);
    } else {
      setCatNameEn('');
      setCatNameBn('');
      setCatSlug('');
      setCatDescEn('');
      setCatSortOrder(categories.length + 1);
    }
    setCatModalOpen(true);
  };

  const saveCategory = async () => {
    setError(null);
    try {
      const payload = {
        nameEn: catNameEn.trim(),
        nameBn: catNameBn.trim() || null,
        slug: (catSlug || generateBlogSlugFromTitle(catNameEn)).trim().toLowerCase(),
        descriptionEn: catDescEn.trim() || null,
        sortOrder: Number(catSortOrder) || 0,
      };
      if (editingCat) {
        await updateCmsPostCategory(editingCat.id, payload);
        setNotice(`Updated category "${payload.nameEn}".`);
      } else {
        await createCmsPostCategory(payload);
        setNotice(`Created category "${payload.nameEn}".`);
      }
      setCatModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category.');
    }
  };

  const openAuthorModal = (author: CmsAuthorDto | null) => {
    setEditingAuthor(author);
    if (author) {
      setAuthNameEn(author.displayName);
      setAuthNameBn(author.displayNameBn ?? '');
      setAuthSlug(author.slug);
      setAuthRoleEn(author.roleTitle ?? '');
      setAuthRoleBn(author.roleTitleBn ?? '');
      setAuthBioEn(author.bioEn ?? '');
      setAuthAvatarId(author.avatarMediaId ?? null);
      setAuthAvatarUrl(author.avatarUrl ?? null);
      setAuthActive(author.isActive);
    } else {
      setAuthNameEn('');
      setAuthNameBn('');
      setAuthSlug('');
      setAuthRoleEn('');
      setAuthRoleBn('');
      setAuthBioEn('');
      setAuthAvatarId(null);
      setAuthAvatarUrl(null);
      setAuthActive(true);
    }
    setAuthorModalOpen(true);
  };

  const saveAuthor = async () => {
    setError(null);
    try {
      const payload = {
        displayName: authNameEn.trim(),
        displayNameBn: authNameBn.trim() || null,
        slug: (authSlug || generateBlogSlugFromTitle(authNameEn)).trim().toLowerCase(),
        roleTitle: authRoleEn.trim() || null,
        roleTitleBn: authRoleBn.trim() || null,
        bioEn: authBioEn.trim() || null,
        avatarMediaId: authAvatarId,
        isActive: authActive,
      };
      if (editingAuthor) {
        await updateCmsAuthor(editingAuthor.id, payload);
        setNotice(`Updated author "${payload.displayName}".`);
      } else {
        await createCmsAuthor(payload);
        setNotice(`Created author "${payload.displayName}".`);
      }
      setAuthorModalOpen(false);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save author.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary-600" />
            Blog & Authors CMS
          </h1>
          <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))] mt-1">
            Rich-text posts, scheduled publishing, reading time, related posts, taxonomy, and live{' '}
            <code className="font-mono text-xs">/blog/rss.xml</code> generation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={handleRunScheduled}
              className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <CalendarClock className="h-3.5 w-3.5 text-indigo-600" />
              Run Scheduled
            </button>
          )}
          <button
            type="button"
            onClick={() => void loadAll()}
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={handleOpenNewPost}
              className="h-9 px-3.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              New Blog Post
            </button>
          )}
        </div>
      </div>

      {/* Navigation Visibility Status Banner */}
      <div
        className={`px-4 py-3 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-3 ${
          publishedCount > 0
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 shrink-0" />
          <span>
            {publishedCount > 0 ? (
              <>
                <strong>Blog is live in website navigation:</strong> {publishedCount} published post
                {publishedCount === 1 ? '' : 's'} active on <code className="font-mono">/blog</code>{' '}
                and included in <code className="font-mono">/sitemap.xml</code> &{' '}
                <code className="font-mono">/blog/rss.xml</code>.
              </>
            ) : (
              <>
                <strong>Blog hidden from public navigation:</strong> 0 published posts right now.
                Publish at least 1 post to reveal the Blog link in the marketing header & footer.
              </>
            )}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 font-mono text-[11px] opacity-85">
          <Rss className="h-3.5 w-3.5" />
          /blog/rss.xml
        </span>
      </div>

      {notice && (
        <div className="px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--border-base))] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('posts')}
            className={`h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
              activeTab === 'posts'
                ? 'bg-primary-600 text-white'
                : 'border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Posts ({posts.filter((p) => p.status !== 'trashed').length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
              activeTab === 'categories'
                ? 'bg-primary-600 text-white'
                : 'border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            <FolderKanban className="h-3.5 w-3.5" />
            Categories ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('authors')}
            className={`h-9 px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
              activeTab === 'authors'
                ? 'bg-primary-600 text-white'
                : 'border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            Authors ({authors.length})
          </button>
        </div>

        {activeTab === 'categories' && canManage && (
          <button
            type="button"
            onClick={() => openCategoryModal(null)}
            className="h-9 px-3.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            New Category
          </button>
        )}
        {activeTab === 'authors' && canManage && (
          <button
            type="button"
            onClick={() => openAuthorModal(null)}
            className="h-9 px-3.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            New Author
          </button>
        )}
      </div>

      {/* TAB 1: POSTS */}
      {activeTab === 'posts' && (
        <div className="space-y-4">
          {/* Status Pills + Filters */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'published', 'scheduled', 'draft', 'unpublished', 'trashed'] as const).map(
                (st) => {
                  const count =
                    st === 'all'
                      ? posts.filter((p) => p.status !== 'trashed').length
                      : posts.filter((p) => p.status === st).length;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`h-8 px-3 rounded-full text-xs font-semibold border transition-colors ${
                        statusFilter === st
                          ? 'bg-primary-600 border-primary-600 text-white'
                          : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))] hover:border-primary-400'
                      }`}
                    >
                      {st === 'all' ? 'All Active' : st.charAt(0).toUpperCase() + st.slice(1)} ({count})
                    </button>
                  );
                },
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-[rgb(var(--text-muted))] absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, slug, tag…"
                  className="h-8 pl-8 pr-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs w-48"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn}
                  </option>
                ))}
              </select>

              <select
                value={authorFilter}
                onChange={(e) => setAuthorFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              >
                <option value="all">All Authors</option>
                {authors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName}
                  </option>
                ))}
              </select>

              <select
                value={localeFilter}
                onChange={(e) =>
                  setLocaleFilter(e.target.value as 'all' | 'bn_translated' | 'bn_missing')
                }
                className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              >
                <option value="all">All Locales</option>
                <option value="bn_translated">EN + BN Translated</option>
                <option value="bn_missing">Missing BN Translation</option>
              </select>
            </div>
          </div>

          {/* Posts Table */}
          <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] overflow-hidden">
            {filteredPosts.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <BookOpen className="h-8 w-8 text-[rgb(var(--text-muted))] mx-auto" />
                <p className="text-sm font-semibold">No blog posts match your filters</p>
                <p className="text-xs text-[rgb(var(--text-muted))]">
                  Create a new post with the RichTextEditor to manage articles cleanly in the CMS.
                </p>
                {canCreate && (
                  <button
                    type="button"
                    onClick={handleOpenNewPost}
                    className="h-9 px-4 rounded-lg bg-primary-600 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Write First Post
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[rgb(var(--border-base))]">
                {filteredPosts.map((post) => {
                  const category = post.category ?? categoryMap.get(post.categoryId);
                  const author = post.author ?? authorMap.get(post.authorId);
                  return (
                    <div
                      key={post.id}
                      className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-[rgb(var(--bg-muted))]/30"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        {post.coverImageUrl ? (
                          <img
                            src={post.coverImageUrl}
                            alt={post.coverAltEn || post.titleEn}
                            className="w-16 h-12 rounded-lg object-cover border border-[rgb(var(--border-base))] shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-12 rounded-lg bg-[rgb(var(--bg-muted))] border border-[rgb(var(--border-base))] flex items-center justify-center shrink-0">
                            <ImageIcon className="h-4 w-4 text-[rgb(var(--text-muted))]" />
                          </div>
                        )}

                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold truncate">{post.titleEn}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase ${STATUS_BADGES[post.status]}`}
                            >
                              {post.status}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium border inline-flex items-center gap-1 ${
                                post.isBnTranslated
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
                                  : 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20'
                              }`}
                            >
                              <Languages className="h-3 w-3" />
                              {post.isBnTranslated ? 'EN + BN' : 'EN only'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[rgb(var(--text-muted))]">
                            <span className="font-mono">/blog/{post.slug}</span>
                            <span>·</span>
                            <span>{category?.nameEn || 'Uncategorized'}</span>
                            <span>·</span>
                            <span>By {author?.displayName || 'Unknown'}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {post.readingTimeMinutes} min read
                            </span>
                            {post.status === 'scheduled' && post.scheduledAt && (
                              <>
                                <span>·</span>
                                <span className="text-indigo-600 dark:text-indigo-300 font-medium">
                                  Scheduled {new Date(post.scheduledAt).toLocaleString()} (
                                  {post.scheduledTimezone || 'UTC'})
                                </span>
                              </>
                            )}
                            {post.publishedAt && (
                              <>
                                <span>·</span>
                                <span>Published {new Date(post.publishedAt).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {post.status !== 'trashed' && canEdit && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditPost(post)}
                            className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        )}
                        {(post.status === 'draft' ||
                          post.status === 'unpublished' ||
                          post.status === 'scheduled') &&
                          canManage && (
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickAction(
                                  () => publishCmsPost(post.id).then(() => undefined),
                                  `Published "/blog/${post.slug}".`,
                                )
                              }
                              className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <Send className="h-3.5 w-3.5" />
                              Publish
                            </button>
                          )}
                        {post.status === 'published' && canManage && (
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickAction(
                                () => unpublishCmsPost(post.id).then(() => undefined),
                                `Unpublished "/blog/${post.slug}".`,
                              )
                            }
                            className="h-8 px-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-semibold"
                          >
                            Unpublish
                          </button>
                        )}
                        {post.status !== 'trashed' && canDelete && (
                          <button
                            type="button"
                            onClick={() =>
                              handleQuickAction(
                                () => trashCmsPost(post.id).then(() => undefined),
                                `Moved "${post.titleEn}" to Trash.`,
                              )
                            }
                            className="h-8 px-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-medium inline-flex items-center gap-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Trash
                          </button>
                        )}
                        {post.status === 'trashed' && canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                handleQuickAction(
                                  () => restoreCmsPost(post.id).then(() => undefined),
                                  `Restored "${post.titleEn}" as draft.`,
                                )
                              }
                              className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] text-xs font-medium inline-flex items-center gap-1"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Restore
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPermDeleteTarget(post);
                                setPermDeleteConfirm('');
                              }}
                              className="h-8 px-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete Forever
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] divide-y divide-[rgb(var(--border-base))]">
          {categories.length === 0 ? (
            <div className="p-8 text-center text-xs text-[rgb(var(--text-muted))]">
              No categories configured yet.
            </div>
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{cat.nameEn}</span>
                    {cat.nameBn && (
                      <span className="text-xs text-[rgb(var(--text-muted))]">({cat.nameBn})</span>
                    )}
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[rgb(var(--bg-muted))]">
                      {cat.slug}
                    </span>
                  </div>
                  <p className="text-xs text-[rgb(var(--text-muted))] mt-0.5">
                    {cat.descriptionEn || 'No description'} · Order #{cat.sortOrder} ·{' '}
                    <strong>{cat.postCount ?? 0}</strong> post(s)
                  </p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openCategoryModal(cat)}
                      className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] text-xs font-medium inline-flex items-center gap-1"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={(cat.postCount ?? 0) > 0}
                      title={
                        (cat.postCount ?? 0) > 0
                          ? 'Reassign posts before deleting this category'
                          : 'Delete category'
                      }
                      onClick={() =>
                        handleQuickAction(
                          () => deleteCmsPostCategory(cat.id).then(() => undefined),
                          `Deleted category "${cat.nameEn}".`,
                        )
                      }
                      className="h-8 px-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-medium disabled:opacity-40 inline-flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: AUTHORS */}
      {activeTab === 'authors' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {authors.map((auth) => (
            <div
              key={auth.id}
              className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-4 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                {auth.avatarUrl ? (
                  <img
                    src={auth.avatarUrl}
                    alt={auth.displayName}
                    className="w-11 h-11 rounded-full object-cover border border-[rgb(var(--border-base))] shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-full bg-primary-600/15 text-primary-700 font-bold text-sm flex items-center justify-center shrink-0">
                    {auth.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate">{auth.displayName}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        auth.isActive
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-500/15 text-slate-600'
                      }`}
                    >
                      {auth.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {auth.roleTitle && (
                    <p className="text-xs text-[rgb(var(--text-secondary))]">{auth.roleTitle}</p>
                  )}
                  <p className="text-[11px] font-mono text-[rgb(var(--text-muted))]">
                    @{auth.slug} · {auth.postCount ?? 0} post(s)
                  </p>
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openAuthorModal(auth)}
                    className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] text-xs font-medium"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={(auth.postCount ?? 0) > 0}
                    onClick={() =>
                      handleQuickAction(
                        () => deleteCmsAuthor(auth.id).then(() => undefined),
                        `Deleted author "${auth.displayName}".`,
                      )
                    }
                    className="h-8 px-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-medium disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Post Editor Modal */}
      <BlogPostEditorModal
        isOpen={editorOpen}
        post={editingPost}
        categories={categories}
        authors={authors}
        allPosts={posts}
        currentUser={currentUser}
        onClose={() => setEditorOpen(false)}
        onSaved={async (saved) => {
          setEditorOpen(false);
          setNotice(`Saved blog post "/blog/${saved.slug}" (${saved.status}).`);
          await loadAll();
        }}
      />

      {/* Category Modal */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))] rounded-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-base font-bold">
              {editingCat ? 'Edit Blog Category' : 'New Blog Category'}
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Name (English) *</label>
                <input
                  type="text"
                  value={catNameEn}
                  onChange={(e) => {
                    setCatNameEn(e.target.value);
                    if (!editingCat) setCatSlug(generateBlogSlugFromTitle(e.target.value));
                  }}
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Name (Bengali)</label>
                <input
                  type="text"
                  value={catNameBn}
                  onChange={(e) => setCatNameBn(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Slug *</label>
                <input
                  type="text"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value.toLowerCase())}
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Description (English)</label>
                <input
                  type="text"
                  value={catDescEn}
                  onChange={(e) => setCatDescEn(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Sort Order</label>
                <input
                  type="number"
                  value={catSortOrder}
                  onChange={(e) => setCatSortOrder(parseInt(e.target.value, 10) || 0)}
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCatModalOpen(false)}
                className="h-9 px-3.5 rounded-lg border border-[rgb(var(--border-base))] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!catNameEn.trim() || !catSlug.trim()}
                onClick={saveCategory}
                className="h-9 px-4 rounded-lg bg-primary-600 text-white text-xs font-semibold disabled:opacity-50"
              >
                Save Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Author Modal */}
      {authorModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))] rounded-2xl w-full max-w-lg p-5 space-y-4">
            <h3 className="text-base font-bold">
              {editingAuthor ? 'Edit Blog Author' : 'New Blog Author'}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {authAvatarUrl ? (
                  <img
                    src={authAvatarUrl}
                    alt={authNameEn || 'Avatar'}
                    className="w-12 h-12 rounded-full object-cover border border-[rgb(var(--border-base))]"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[rgb(var(--bg-muted))] flex items-center justify-center text-xs text-[rgb(var(--text-muted))]">
                    Photo
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setAvatarPickerOpen(true)}
                  className="h-8 px-3 rounded-lg border border-[rgb(var(--border-base))] text-xs font-medium"
                >
                  Pick Avatar
                </button>
                {authAvatarId && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthAvatarId(null);
                      setAuthAvatarUrl(null);
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Display Name (EN) *</label>
                  <input
                    type="text"
                    value={authNameEn}
                    onChange={(e) => {
                      setAuthNameEn(e.target.value);
                      if (!editingAuthor) setAuthSlug(generateBlogSlugFromTitle(e.target.value));
                    }}
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Display Name (BN)</label>
                  <input
                    type="text"
                    value={authNameBn}
                    onChange={(e) => setAuthNameBn(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Role / Title (EN)</label>
                  <input
                    type="text"
                    value={authRoleEn}
                    onChange={(e) => setAuthRoleEn(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Role / Title (BN)</label>
                  <input
                    type="text"
                    value={authRoleBn}
                    onChange={(e) => setAuthRoleBn(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Slug *</label>
                <input
                  type="text"
                  value={authSlug}
                  onChange={(e) => setAuthSlug(e.target.value.toLowerCase())}
                  className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Short Bio (EN)</label>
                <textarea
                  rows={2}
                  value={authBioEn}
                  onChange={(e) => setAuthBioEn(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={authActive}
                  onChange={(e) => setAuthActive(e.target.checked)}
                />
                Active author profile
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAuthorModalOpen(false)}
                className="h-9 px-3.5 rounded-lg border border-[rgb(var(--border-base))] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!authNameEn.trim() || !authSlug.trim()}
                onClick={saveAuthor}
                className="h-9 px-4 rounded-lg bg-primary-600 text-white text-xs font-semibold disabled:opacity-50"
              >
                Save Author
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Delete Modal */}
      {permDeleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-[rgb(var(--bg-surface))] border border-[rgb(var(--border-base))] rounded-2xl w-full max-w-md p-5 space-y-4">
            <h3 className="text-base font-bold text-red-600">Permanently Delete Blog Post</h3>
            <p className="text-xs text-[rgb(var(--text-secondary))]">
              This permanently removes <strong>{permDeleteTarget.titleEn}</strong> (/blog/
              {permDeleteTarget.slug}) and cannot be undone. Type the slug{' '}
              <code className="font-mono font-semibold">{permDeleteTarget.slug}</code> to confirm.
            </p>
            <input
              type="text"
              value={permDeleteConfirm}
              onChange={(e) => setPermDeleteConfirm(e.target.value)}
              placeholder={permDeleteTarget.slug}
              className="w-full h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-base))] text-xs font-mono"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPermDeleteTarget(null)}
                className="h-9 px-3.5 rounded-lg border border-[rgb(var(--border-base))] text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  permDeleteConfirm.trim().toLowerCase() !== permDeleteTarget.slug.toLowerCase()
                }
                onClick={handlePermanentDelete}
                className="h-9 px-4 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-40"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      <MediaLibraryPickerModal
        isOpen={avatarPickerOpen}
        defaultFolder="blog"
        onClose={() => setAvatarPickerOpen(false)}
        onSelect={(selection) => {
          setAuthAvatarId(selection.media.id);
          setAuthAvatarUrl(selection.src);
          setAvatarPickerOpen(false);
        }}
      />
    </div>
  );
}
