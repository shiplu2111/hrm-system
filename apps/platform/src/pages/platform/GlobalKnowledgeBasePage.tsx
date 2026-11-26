// apps/platform/src/pages/platform/GlobalKnowledgeBasePage.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  Filter,
  FolderTree,
  Globe2,
  HelpCircle,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Tag,
  Trash2,
  User,
  X,
  Zap,
} from 'lucide-react';
import {
  CreateGlobalKbArticleInput,
  CreateGlobalKbCategoryInput,
  GlobalKbArticleDetail,
  GlobalKbArticleListItem,
  GlobalKbArticlesResponse,
  GlobalKbCategory,
  GlobalKbStatus,
  UpdateGlobalKbArticleInput,
  UpdateGlobalKbCategoryInput,
} from '@hrm/shared-types';
import {
  createGlobalKbArticle,
  createGlobalKbCategory,
  deleteGlobalKbArticle,
  deleteGlobalKbCategory,
  getGlobalKbArticle,
  listGlobalKbArticles,
  listGlobalKbCategories,
  updateGlobalKbArticle,
  updateGlobalKbCategory,
} from '@/lib/global-kb-api';
import { GlobalKbMarkdown } from '@/components/support/GlobalKbMarkdown';
import { usePermission } from '@/hooks/usePermission';

// Available Country and Plan presets for multi-tenant visibility
const COUNTRY_PRESETS = [
  { code: 'ALL', name: 'All Countries (Global)' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'IN', name: 'India' },
  { code: 'CA', name: 'Canada' },
  { code: 'DE', name: 'Germany' },
  { code: 'SG', name: 'Singapore' },
];

const PLAN_PRESETS = [
  { code: 'ALL', name: 'All Subscription Plans' },
  { code: 'enterprise', name: 'Enterprise' },
  { code: 'business', name: 'Business' },
  { code: 'starter', name: 'Starter' },
  { code: 'free', name: 'Free' },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatTimeAgo(isoString: string): string {
  if (!isoString) return 'just now';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function GlobalKnowledgeBasePage() {
  const canManage = usePermission('support', 'manage');
  // Main view tab: 'articles' or 'categories'
  const [activeTab, setActiveTab] = useState<'articles' | 'categories'>('articles');

  // Data states
  const [articlesData, setArticlesData] = useState<GlobalKbArticlesResponse | null>(null);
  const [categories, setCategories] = useState<GlobalKbCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters for Articles
  const [statusFilter, setStatusFilter] = useState<GlobalKbStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Modal States: Article Editor, Preview, and Category Editor
  const [articleModalOpen, setArticleModalOpen] = useState<boolean>(false);
  const [editingArticle, setEditingArticle] = useState<GlobalKbArticleDetail | null>(null);
  const [previewArticle, setPreviewArticle] = useState<GlobalKbArticleDetail | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<GlobalKbCategory | null>(null);
  const [deletingItem, setDeletingItem] = useState<{ type: 'article' | 'category'; id: string; name: string } | null>(null);

  // Article Form State
  const [artTitle, setArtTitle] = useState<string>('');
  const [artSlug, setArtSlug] = useState<string>('');
  const [artCategoryId, setArtCategoryId] = useState<string>('');
  const [artSummary, setArtSummary] = useState<string>('');
  const [artBody, setArtBody] = useState<string>('');
  const [artStatus, setArtStatus] = useState<GlobalKbStatus>('draft');
  const [artIsPublic, setArtIsPublic] = useState<boolean>(true);
  const [artCountries, setArtCountries] = useState<string[]>(['ALL']);
  const [artPlans, setArtPlans] = useState<string[]>(['ALL']);
  const [artTags, setArtTags] = useState<string>('');
  const [artEditorTab, setArtEditorTab] = useState<'write' | 'preview'>('write');
  const [submittingArticle, setSubmittingArticle] = useState<boolean>(false);

  // Category Form State
  const [catName, setCatName] = useState<string>('');
  const [catSlug, setCatSlug] = useState<string>('');
  const [catDescription, setCatDescription] = useState<string>('');
  const [catIcon, setCatIcon] = useState<string>('BookOpen');
  const [catSortOrder, setCatSortOrder] = useState<number>(0);
  const [submittingCategory, setSubmittingCategory] = useState<boolean>(false);

  // Load Categories & Articles
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [catsRes, artsRes] = await Promise.all([
        listGlobalKbCategories(),
        listGlobalKbArticles({
          status: statusFilter,
          categoryId: categoryFilter,
          country: countryFilter,
          plan: planFilter,
          search: searchQuery.trim() || undefined,
          page,
          pageSize: 20,
        }),
      ]);
      setCategories(catsRes);
      setArticlesData(artsRes);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Global Knowledge Base data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, countryFilter, planFilter, searchQuery, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // Open Create Article Modal
  const handleOpenCreateArticle = () => {
    setEditingArticle(null);
    setArtTitle('');
    setArtSlug('');
    setArtCategoryId(categories[0]?.id || '');
    setArtSummary('');
    setArtBody('');
    setArtStatus('draft');
    setArtIsPublic(true);
    setArtCountries(['ALL']);
    setArtPlans(['ALL']);
    setArtTags('');
    setArtEditorTab('write');
    setArticleModalOpen(true);
  };

  // Open Edit Article Modal
  const handleOpenEditArticle = async (item: GlobalKbArticleListItem) => {
    try {
      // Opening with preview=true avoids incrementing view count
      const detail = await getGlobalKbArticle(item.id, true);
      setEditingArticle(detail);
      setArtTitle(detail.title);
      setArtSlug(detail.slug);
      setArtCategoryId(detail.categoryId);
      setArtSummary(detail.summary);
      setArtBody(detail.body);
      setArtStatus(detail.status);
      setArtIsPublic(detail.isPublic ?? true);
      setArtCountries(detail.targetCountries.length > 0 ? detail.targetCountries : ['ALL']);
      setArtPlans(detail.targetPlans.length > 0 ? detail.targetPlans : ['ALL']);
      setArtTags(detail.tags.join(', '));
      setArtEditorTab('write');
      setArticleModalOpen(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to load article details for editing');
    }
  };

  // Open Preview Modal (Reader View with preview=true)
  const handleOpenPreview = async (item: GlobalKbArticleListItem) => {
    try {
      const detail = await getGlobalKbArticle(item.id, true);
      setPreviewArticle(detail);
    } catch (err: any) {
      setError(err?.message || 'Failed to load preview');
    }
  };

  // Submit Article (Create or Update)
  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artTitle.trim() || !artSummary.trim() || !artBody.trim() || !artCategoryId) {
      setError('Please fill in Title, Category, Summary, and Markdown Body.');
      return;
    }

    try {
      setSubmittingArticle(true);
      const parsedTags = artTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const payload: CreateGlobalKbArticleInput = {
        title: artTitle.trim(),
        slug: artSlug.trim() ? slugify(artSlug) : slugify(artTitle),
        categoryId: artCategoryId,
        summary: artSummary.trim(),
        body: artBody.trim(),
        status: artStatus,
        isPublic: artIsPublic,
        targetCountries: artCountries,
        targetPlans: artPlans,
        tags: parsedTags,
      };

      if (editingArticle) {
        await updateGlobalKbArticle(editingArticle.id, payload);
        showNotification('Article updated successfully.');
      } else {
        await createGlobalKbArticle(payload);
        showNotification('Article created successfully.');
      }

      setArticleModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save article.');
    } finally {
      setSubmittingArticle(false);
    }
  };

  // Open Create Category Modal
  const handleOpenCreateCategory = () => {
    setEditingCategory(null);
    setCatName('');
    setCatSlug('');
    setCatDescription('');
    setCatIcon('BookOpen');
    setCatSortOrder(categories.length + 1);
    setCategoryModalOpen(true);
  };

  // Open Edit Category Modal
  const handleOpenEditCategory = (cat: GlobalKbCategory) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatSlug(cat.slug);
    setCatDescription(cat.description || '');
    setCatIcon(cat.icon || 'BookOpen');
    setCatSortOrder(cat.sortOrder);
    setCategoryModalOpen(true);
  };

  // Submit Category (Create or Update)
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) {
      setError('Category name is required.');
      return;
    }

    try {
      setSubmittingCategory(true);
      const payload: CreateGlobalKbCategoryInput = {
        name: catName.trim(),
        slug: catSlug.trim() ? slugify(catSlug) : slugify(catName),
        description: catDescription.trim() || undefined,
        icon: catIcon,
        sortOrder: Number(catSortOrder),
      };

      if (editingCategory) {
        await updateGlobalKbCategory(editingCategory.id, payload);
        showNotification('Category updated successfully.');
      } else {
        await createGlobalKbCategory(payload);
        showNotification('Category created successfully.');
      }

      setCategoryModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save category.');
    } finally {
      setSubmittingCategory(false);
    }
  };

  // Handle Deletion Confirmation
  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    try {
      if (deletingItem.type === 'article') {
        await deleteGlobalKbArticle(deletingItem.id);
        showNotification(`Article "${deletingItem.name}" deleted.`);
      } else {
        await deleteGlobalKbCategory(deletingItem.id);
        showNotification(`Category "${deletingItem.name}" deleted.`);
      }
      setDeletingItem(null);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete item.');
    }
  };

  // Toggle Country Selection
  const toggleCountry = (code: string) => {
    if (code === 'ALL') {
      setArtCountries(['ALL']);
      return;
    }
    const current = artCountries.filter((c) => c !== 'ALL');
    if (current.includes(code)) {
      const next = current.filter((c) => c !== code);
      setArtCountries(next.length === 0 ? ['ALL'] : next);
    } else {
      setArtCountries([...current, code]);
    }
  };

  // Toggle Plan Selection
  const togglePlan = (code: string) => {
    if (code === 'ALL') {
      setArtPlans(['ALL']);
      return;
    }
    const current = artPlans.filter((p) => p !== 'ALL');
    if (current.includes(code)) {
      const next = current.filter((p) => p !== code);
      setArtPlans(next.length === 0 ? ['ALL'] : next);
    } else {
      setArtPlans([...current, code]);
    }
  };

  // Metrics summary
  const metrics = useMemo(() => {
    return [
      {
        label: 'Total Articles',
        value: articlesData?.counts.all ?? 0,
        color: 'text-slate-900 dark:text-white',
        icon: BookOpen,
      },
      {
        label: 'Published',
        value: articlesData?.counts.published ?? 0,
        color: 'text-emerald-600 dark:text-emerald-400',
        icon: CheckCircle2,
      },
      {
        label: 'Drafts',
        value: articlesData?.counts.draft ?? 0,
        color: 'text-amber-600 dark:text-amber-400',
        icon: Pencil,
      },
      {
        label: 'Categories',
        value: categories.length,
        color: 'text-indigo-600 dark:text-indigo-400',
        icon: FolderTree,
      },
      {
        label: 'Total Views',
        value: articlesData?.totalViews ?? 0,
        color: 'text-blue-600 dark:text-blue-400',
        icon: Eye,
      },
    ];
  }, [articlesData, categories]);

  return (
    <div className="space-y-6 animate-fade-in text-slate-900 dark:text-slate-100 pb-16">
      {/* Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold text-xs mb-1">
            <Globe2 className="h-4 w-4" />
            <span>Platform Content Management</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Global Knowledge Base
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authoritative documentation and compliance articles distributed across all customer tenants
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-xs font-semibold shadow-sm transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>

          {canManage && (
            <>
              <button
                onClick={handleOpenCreateCategory}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800/80 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-semibold shadow-sm transition"
              >
                <FolderTree className="h-3.5 w-3.5 text-indigo-600" />
                <span>+ New Category</span>
              </button>

              <button
                onClick={handleOpenCreateArticle}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold shadow-sm transition active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>+ New Article</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold animate-fade-in shadow-sm">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-semibold animate-fade-in shadow-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* KPI Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{m.label}</p>
                <p className={`text-2xl font-black mt-1 ${m.color}`}>{m.value}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 flex items-center justify-center text-slate-500">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Tab Controls */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('articles')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'articles'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Articles Directory ({articlesData?.total ?? 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'categories'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FolderTree className="h-3.5 w-3.5" />
            <span>Categories & Taxonomy ({categories.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 font-medium hidden sm:block">
          {activeTab === 'articles'
            ? 'Articles distributed to tenants matching target country/plan'
            : 'Categories can be reordered or renamed; deleted only when empty'}
        </div>
      </div>

      {/* TAB 1: ARTICLES VIEW */}
      {activeTab === 'articles' && (
        <div className="space-y-4 animate-fade-in">
          {/* Refinement Filter Toolbar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Status Segmented Tabs */}
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Articles', count: articlesData?.counts.all },
                  { id: 'published', label: 'Published', count: articlesData?.counts.published },
                  { id: 'draft', label: 'Drafts', count: articlesData?.counts.draft },
                ].map((tab) => {
                  const active = statusFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setStatusFilter(tab.id as any);
                        setPage(1);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                        active
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                            active
                              ? 'bg-indigo-700 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Search Box */}
              <div className="relative min-w-[280px]">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search title, summary, body, tags..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="w-full h-9 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setPage(1);
                    }}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Sub-Filters: Category, Country, Plan */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                <Filter className="h-3.5 w-3.5 text-indigo-500" />
                <span>Filter By:</span>
              </div>

              {/* Category Dropdown */}
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.articleCount})
                  </option>
                ))}
              </select>

              {/* Country Visibility Dropdown */}
              <select
                value={countryFilter}
                onChange={(e) => {
                  setCountryFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All Country Visibilities</option>
                {COUNTRY_PRESETS.map((cp) => (
                  <option key={cp.code} value={cp.code}>
                    {cp.code}: {cp.name}
                  </option>
                ))}
              </select>

              {/* Plan Visibility Dropdown */}
              <select
                value={planFilter}
                onChange={(e) => {
                  setPlanFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">All Plan Visibilities</option>
                {PLAN_PRESETS.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>

              {(statusFilter !== 'all' || categoryFilter !== 'all' || countryFilter !== 'all' || planFilter !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setCategoryFilter('all');
                    setCountryFilter('all');
                    setPlanFilter('all');
                    setSearchQuery('');
                    setPage(1);
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Articles Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-4 py-3">Article Title & Slug</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Country Visibility</th>
                    <th className="px-4 py-3">Plan Visibility</th>
                    <th className="px-4 py-3 text-center">Views</th>
                    <th className="px-4 py-3">Last Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading && !articlesData ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                        <span>Loading Global Knowledge Base articles...</span>
                      </td>
                    </tr>
                  ) : articlesData?.items?.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                        <BookOpen className="h-8 w-8 mx-auto mb-2 text-slate-400 opacity-60" />
                        <p className="font-semibold text-slate-700 dark:text-slate-300">No articles match your criteria</p>
                        <p className="text-[11px] text-slate-400 mt-1">Try resetting filters or adding a new article.</p>
                      </td>
                    </tr>
                  ) : (
                    articlesData?.items?.map((article) => {
                      const isPublished = article.status === 'published' || article.published;
                      return (
                        <tr
                          key={article.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition group"
                        >
                          {/* Title & Slug */}
                          <td className="px-4 py-3.5 max-w-xs">
                            <div className="font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                              {article.title}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400 line-clamp-1">
                              /kb/{article.slug}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                              {article.summary}
                            </div>
                          </td>

                          {/* Category */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              <FolderTree className="h-3 w-3" />
                              <span>{article.categoryName}</span>
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            {isPublished ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="h-3 w-3" />
                                Published
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                <Pencil className="h-3 w-3" />
                                Draft
                              </span>
                            )}
                          </td>

                          {/* Country Visibility */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1 max-w-[140px]">
                              {article.targetCountries.includes('ALL') ? (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                  🌐 All Countries
                                </span>
                              ) : (
                                article.targetCountries.map((c) => (
                                  <span
                                    key={c}
                                    className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono"
                                  >
                                    {c}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>

                          {/* Plan Visibility */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1 max-w-[140px]">
                              {article.targetPlans.includes('ALL') || article.targetPlans.includes('all') ? (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                  ⭐ All Plans
                                </span>
                              ) : (
                                article.targetPlans.map((p) => (
                                  <span
                                    key={p}
                                    className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold capitalize bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                  >
                                    {p}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>

                          {/* Views Count */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            <div className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-lg">
                              <Eye className="h-3 w-3 text-slate-400" />
                              <span>{article.viewCount}</span>
                            </div>
                          </td>

                          {/* Last Updated & Author */}
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="text-slate-700 dark:text-slate-300 font-semibold text-[11px]">
                              {article.authorName || 'Platform Staff'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {formatTimeAgo(article.updatedAt)}
                            </div>
                          </td>

                          {/* Action Buttons */}
                          <td className="px-4 py-3.5 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Preview Action */}
                              <button
                                onClick={() => handleOpenPreview(article)}
                                title="Preview article"
                                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>

                              {/* Edit Action */}
                              {canManage && (
                                <button
                                  onClick={() => handleOpenEditArticle(article)}
                                  title="Edit article"
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 transition"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}

                              {/* Delete Action */}
                              {canManage && (
                                <button
                                  onClick={() =>
                                    setDeletingItem({
                                      type: 'article',
                                      id: article.id,
                                      name: article.title,
                                    })
                                  }
                                  title="Delete article"
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/60 text-slate-600 hover:text-red-600 dark:text-slate-300 dark:hover:text-red-400 transition"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CATEGORIES VIEW */}
      {activeTab === 'categories' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3 relative group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
                      <FolderTree className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white text-sm">{cat.name}</h3>
                      <p className="font-mono text-[10px] text-slate-400">/kb/{cat.slug}</p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    Order #{cat.sortOrder}
                  </span>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[32px]">
                  {cat.description || 'No description provided.'}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {cat.articleCount} Articles
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({cat.publishedCount} published · {cat.draftCount} draft)
                    </span>
                  </div>

                  {canManage ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditCategory(cat)}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        disabled={cat.articleCount > 0}
                        onClick={() =>
                          setDeletingItem({
                            type: 'category',
                            id: cat.id,
                            name: cat.name,
                          })
                        }
                        title={cat.articleCount > 0 ? 'Categories with articles cannot be deleted (MODULES.md §45)' : 'Delete category'}
                        className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-red-50 text-slate-600 hover:text-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Read-only</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: ARTICLE EDITOR (WRITE / PREVIEW TABS) */}
      {articleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingArticle ? 'Edit Global Knowledge Base Article' : 'Create Global Knowledge Base Article'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Shared cross-tenant documentation with country and subscription plan scoping
                  </p>
                </div>
              </div>

              <button
                onClick={() => setArticleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <form onSubmit={handleSaveArticle} className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Row 1: Title & Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Article Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={artTitle}
                    onChange={(e) => {
                      setArtTitle(e.target.value);
                      if (!editingArticle) setArtSlug(slugify(e.target.value));
                    }}
                    placeholder="e.g. UK PAYE & National Insurance Statutory Calculation"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Category *
                  </label>
                  <select
                    value={artCategoryId}
                    onChange={(e) => setArtCategoryId(e.target.value)}
                    required
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Slug & Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    URL Slug (Immutable once published for stable links)
                  </label>
                  <div className="flex items-center">
                    <span className="px-3 h-10 rounded-l-xl border border-r-0 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 text-xs flex items-center font-mono">
                      /kb/
                    </span>
                    <input
                      type="text"
                      value={artSlug}
                      onChange={(e) => setArtSlug(slugify(e.target.value))}
                      placeholder="uk-paye-statutory-calculation"
                      className="w-full h-10 px-3 rounded-r-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Publication Status
                  </label>
                  <div className="flex items-center gap-2 h-10">
                    <button
                      type="button"
                      onClick={() => setArtStatus('draft')}
                      className={`flex-1 h-full rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        artStatus === 'draft'
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 border-2 border-amber-300 dark:border-amber-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Draft</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setArtStatus('published')}
                      className={`flex-1 h-full rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        artStatus === 'published'
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border-2 border-emerald-300 dark:border-emerald-700'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Published</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Summary Snippet */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Article Summary * (Displayed in search results and help widget)
                </label>
                <textarea
                  rows={2}
                  required
                  value={artSummary}
                  onChange={(e) => setArtSummary(e.target.value)}
                  placeholder="Provide a concise 1-2 sentence overview of what this article covers..."
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                />
              </div>

              {/* Row 4: Visibility Controls (Countries & Plans) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                {/* Target Countries */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Globe2 className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Country Visibility</span>
                    </label>
                    <span className="text-[10px] text-slate-500">
                      {artCountries.includes('ALL') ? 'Global (All Countries)' : `${artCountries.length} countries selected`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COUNTRY_PRESETS.map((c) => {
                      const selected = artCountries.includes(c.code);
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => toggleCountry(c.code)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                            selected
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                          }`}
                        >
                          {c.code === 'ALL' ? '🌐 All Countries' : `${c.code} (${c.name})`}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Plans */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-indigo-500" />
                      <span>Plan Visibility</span>
                    </label>
                    <span className="text-[10px] text-slate-500">
                      {artPlans.includes('ALL') ? 'All Subscription Tiers' : `${artPlans.length} plans selected`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PLAN_PRESETS.map((p) => {
                      const selected = artPlans.includes(p.code);
                      return (
                        <button
                          key={p.code}
                          type="button"
                          onClick={() => togglePlan(p.code)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                            selected
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-purple-400'
                          }`}
                        >
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Public Website Help Center Toggle */}
              <label className="flex items-start gap-2.5 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={artIsPublic}
                  onChange={(e) => setArtIsPublic(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <strong className="block text-slate-900 dark:text-white">
                    Show on Public Website Help Center
                  </strong>
                  When enabled and Published with Global (All Countries + All Subscription Tiers), this article appears on the public marketing Help Center. Per-country or per-plan articles always remain private to signed-in workspaces.
                </span>
              </label>

              {/* Row 5: Tags */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Search Tags (Comma separated)
                </label>
                <input
                  type="text"
                  value={artTags}
                  onChange={(e) => setArtTags(e.target.value)}
                  placeholder="e.g. paye, uk, progressive-tax, hmrc, year-end"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Row 6: Markdown Body with Live Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setArtEditorTab('write')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        artEditorTab === 'write'
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      Write Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => setArtEditorTab('preview')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        artEditorTab === 'preview'
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      Live Preview
                    </button>
                  </div>

                  <span className="text-[11px] text-slate-400">
                    Supports Markdown: ## Heading, **bold**, *italic*, `code`, lists, quotes, [links]
                  </span>
                </div>

                {artEditorTab === 'write' ? (
                  <textarea
                    rows={12}
                    required
                    value={artBody}
                    onChange={(e) => setArtBody(e.target.value)}
                    placeholder="Write authoritative markdown documentation here..."
                    className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                  />
                ) : (
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 min-h-[280px]">
                    {artBody.trim() ? (
                      <GlobalKbMarkdown source={artBody} />
                    ) : (
                      <span className="text-xs text-slate-400 italic">No markdown body written yet.</span>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setArticleModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingArticle}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {submittingArticle ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving Article...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{editingArticle ? 'Save Changes' : 'Create Article'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ARTICLE PREVIEW / READER MODAL (SIMULATES TENANT EXPERIENCE) */}
      {previewArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] animate-scale-in">
            {/* Preview Banner */}
            <div className="bg-indigo-50 dark:bg-indigo-950/60 px-5 py-2.5 border-b border-indigo-100 dark:border-indigo-900 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 font-medium">
              <span className="flex items-center gap-1.5 font-bold">
                <Eye className="h-3.5 w-3.5 text-indigo-600" />
                <span>Customer Help Center Preview Mode</span>
              </span>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400">
                (Previewing does not increment customer view count)
              </span>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
                    {previewArticle.categoryName}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${
                      previewArticle.published
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                    }`}
                  >
                    {previewArticle.published ? 'Published' : 'Draft'}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    /kb/{previewArticle.slug}
                  </span>
                </div>

                <h1 className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                  {previewArticle.title}
                </h1>

                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span>Author: <strong className="text-slate-700 dark:text-slate-300">{previewArticle.authorName || 'Platform Staff'}</strong></span>
                  <span>•</span>
                  <span>Views: <strong className="text-slate-700 dark:text-slate-300">{previewArticle.viewCount}</strong></span>
                  <span>•</span>
                  <span>Updated: {new Date(previewArticle.updatedAt).toLocaleDateString()}</span>
                </div>

                {/* Summary Card */}
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                  {previewArticle.summary}
                </div>
              </div>

              {/* Rendered Markdown Body */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <GlobalKbMarkdown source={previewArticle.body} />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
              <button
                onClick={() => setPreviewArticle(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CATEGORY EDITOR */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <FolderTree className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {editingCategory ? 'Edit Category' : 'Create Knowledge Base Category'}
                  </h3>
                  <p className="text-xs text-slate-500">Taxonomy group for customer articles</p>
                </div>
              </div>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    if (!editingCategory) setCatSlug(slugify(e.target.value));
                  }}
                  placeholder="e.g. Statutory Compliance & Taxes"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Category Slug
                </label>
                <input
                  type="text"
                  value={catSlug}
                  onChange={(e) => setCatSlug(slugify(e.target.value))}
                  placeholder="statutory-compliance-taxes"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={catDescription}
                  onChange={(e) => setCatDescription(e.target.value)}
                  placeholder="Describe what articles this category contains..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={catSortOrder}
                    onChange={(e) => setCatSortOrder(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Icon Name
                  </label>
                  <select
                    value={catIcon}
                    onChange={(e) => setCatIcon(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  >
                    <option value="BookOpen">BookOpen</option>
                    <option value="DollarSign">DollarSign</option>
                    <option value="Clock">Clock</option>
                    <option value="Shield">Shield</option>
                    <option value="Terminal">Terminal</option>
                    <option value="Sparkles">Sparkles</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCategory}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {submittingCategory ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION DIALOG */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-600 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Delete {deletingItem.type === 'article' ? 'Article' : 'Category'}?
                </h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete <strong>"{deletingItem.name}"</strong>?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold shadow-sm transition"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GlobalKnowledgeBasePage;
