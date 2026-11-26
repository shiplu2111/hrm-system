import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CmsFaqDto } from '@hrm/shared-types';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  HelpCircle,
  Languages,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { deleteCmsFaq, listCmsFaqs, updateCmsFaq } from '@/lib/platform-cms-api';
import { hasPlatformPermission } from '@/lib/permissions';
import { usePermissions } from '@/hooks/usePermission';
import { FaqEditorModal } from '@/components/cms/FaqEditorModal';

type PublishFilter = 'all' | 'published' | 'draft';

export function FaqLibraryPage() {
  const { user: currentUser } = usePermissions();
  const canCreate = hasPlatformPermission(currentUser, 'cms', 'create');
  const canEdit = hasPlatformPermission(currentUser, 'cms', 'edit');
  const canManage = hasPlatformPermission(currentUser, 'cms', 'manage');
  const canDelete = hasPlatformPermission(currentUser, 'cms', 'delete');

  const [faqs, setFaqs] = useState<CmsFaqDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [publishFilter, setPublishFilter] = useState<PublishFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<CmsFaqDto | null>(null);

  const loadFaqs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listCmsFaqs();
      setFaqs(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FAQ library.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFaqs();
  }, [loadFaqs]);

  const existingTopics = useMemo(
    () => Array.from(new Set(faqs.map((f) => f.category))).sort(),
    [faqs],
  );

  const groupedFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = faqs.filter((f) => {
      if (topicFilter !== 'all' && f.category !== topicFilter) return false;
      if (publishFilter === 'published' && !f.isPublished) return false;
      if (publishFilter === 'draft' && f.isPublished) return false;
      if (q) {
        const hit =
          f.questionEn.toLowerCase().includes(q) ||
          (f.questionBn || '').toLowerCase().includes(q) ||
          f.answerEn.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });

    const groups = new Map<string, CmsFaqDto[]>();
    for (const item of filtered) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [faqs, topicFilter, publishFilter, searchQuery]);

  const handleTogglePublish = async (faq: CmsFaqDto) => {
    setError(null);
    try {
      const updated = await updateCmsFaq(faq.id, { isPublished: !faq.isPublished });
      setNotice(
        updated.isPublished
          ? `Published FAQ "${updated.questionEn}". Pages picking it will show it & emit FAQPage JSON-LD.`
          : `Unpublished FAQ "${updated.questionEn}".`,
      );
      await loadFaqs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update FAQ visibility.');
    }
  };

  const handleDelete = async (faq: CmsFaqDto) => {
    setError(null);
    try {
      await deleteCmsFaq(faq.id);
      setNotice(`Deleted FAQ "${faq.questionEn}".`);
      await loadFaqs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete FAQ.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary-600" />
            FAQ Library
          </h1>
          <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))] mt-1">
            Reusable Q&amp;A items with rich-text answers, grouped by topic and pickable into any page&apos;s FAQ block per locale.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadFaqs()}
            className="h-9 px-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setEditingFaq(null);
                setEditorOpen(true);
              }}
              className="h-9 px-3.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              New FAQ Item
            </button>
          )}
        </div>
      </div>

      {/* Stage J.1 Info Banner */}
      <div className="px-4 py-3 rounded-xl border border-primary-500/25 bg-primary-500/5 text-xs flex items-center gap-2">
        <HelpCircle className="h-4 w-4 text-primary-600 shrink-0" />
        <span>
          <strong>FAQPage Structured Data (Stage J.1):</strong> Only pages displaying published FAQs on screen automatically emit valid <code className="font-mono">FAQPage</code> JSON-LD matching the visible localized questions and answers.
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

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTopicFilter('all')}
            className={`h-8 px-3 rounded-full text-xs font-semibold border ${
              topicFilter === 'all'
                ? 'bg-primary-600 border-primary-600 text-white'
                : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))]'
            }`}
          >
            All Topics ({faqs.length})
          </button>
          {existingTopics.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setTopicFilter(topic)}
              className={`h-8 px-3 rounded-full text-xs font-semibold border ${
                topicFilter === topic
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))]'
              }`}
            >
              {topic} ({faqs.filter((f) => f.category === topic).length})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[rgb(var(--text-muted))] absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search questions or answers…"
              className="h-8 pl-8 pr-3 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs w-52"
            />
          </div>

          <select
            value={publishFilter}
            onChange={(e) => setPublishFilter(e.target.value as PublishFilter)}
            className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published Only</option>
            <option value="draft">Draft Only</option>
          </select>
        </div>
      </div>

      {/* Grouped Sections by Topic */}
      {groupedFaqs.length === 0 ? (
        <div className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] p-10 text-center space-y-3">
          <HelpCircle className="h-8 w-8 text-[rgb(var(--text-muted))] mx-auto" />
          <p className="text-sm font-semibold">No FAQ items match your filters</p>
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Create reusable rich-text Q&amp;As grouped by topic and pick them into any CMS page.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupedFaqs.map(([topic, items]) => (
            <section
              key={topic}
              className="rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] overflow-hidden"
            >
              <div className="px-4 py-2.5 border-b border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/35 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[rgb(var(--text-primary))]">
                  <Tag className="h-3.5 w-3.5 text-primary-600" />
                  <span>{topic}</span>
                </div>
                <span className="text-xs text-[rgb(var(--text-muted))]">{items.length} item(s)</span>
              </div>

              <div className="divide-y divide-[rgb(var(--border-base))]">
                {items.map((faq) => (
                  <div
                    key={faq.id}
                    className="p-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4 hover:bg-[rgb(var(--bg-muted))]/25"
                  >
                    <div className="min-w-0 space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">{faq.questionEn}</span>
                        {faq.isPublished ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                            <Eye className="h-3 w-3" />
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30">
                            <EyeOff className="h-3 w-3" />
                            Draft
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-[rgb(var(--border-base))] text-[rgb(var(--text-muted))]">
                          <Languages className="h-3 w-3" />
                          {faq.isBnTranslated ? 'EN + BN' : 'EN'}
                        </span>
                        {faq.pageSlug && (
                          <span className="text-[11px] font-mono text-[rgb(var(--text-muted))]">
                            default page: /{faq.pageSlug}
                          </span>
                        )}
                      </div>

                      <div
                        className="prose prose-sm prose-slate dark:prose-invert max-w-none text-xs text-[rgb(var(--text-secondary))] line-clamp-3"
                        dangerouslySetInnerHTML={{ __html: faq.answerEn }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFaq(faq);
                            setEditorOpen(true);
                          }}
                          className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] hover:bg-[rgb(var(--bg-hover))] text-xs font-medium inline-flex items-center gap-1"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </button>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => void handleTogglePublish(faq)}
                          className="h-8 px-2.5 rounded-lg border border-[rgb(var(--border-base))] text-xs font-semibold"
                        >
                          {faq.isPublished ? 'Unpublish' : 'Publish'}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(faq)}
                          className="h-8 px-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs font-medium inline-flex items-center gap-1"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <FaqEditorModal
        isOpen={editorOpen}
        faq={editingFaq}
        existingTopics={existingTopics}
        currentUser={currentUser}
        onClose={() => setEditorOpen(false)}
        onSaved={async (saved) => {
          setEditorOpen(false);
          setNotice(`Saved FAQ item "${saved.questionEn}" under topic "${saved.category}".`);
          await loadFaqs();
        }}
      />
    </div>
  );
}
