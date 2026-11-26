import { useMemo, useState } from 'react';
import type { CmsFaqDto, CmsLocale } from '@hrm/shared-types';
import { HelpCircle, Search, Tag } from 'lucide-react';

interface CmsFaqPickerProps {
  faqs: CmsFaqDto[];
  activeLocale: CmsLocale;
  selectedIds?: string[];
  selectedTopic?: string;
  limit?: number;
  heading?: string;
  showHeadingAndLimitControls?: boolean;
  onChangeHeading?: (next: string | undefined) => void;
  onChangeTopic?: (next: string | undefined) => void;
  onChangeLimit?: (next: number) => void;
  onToggleFaqId: (faqId: string) => void;
  onClearPickedIds?: () => void;
}

export function CmsFaqPicker({
  faqs,
  activeLocale,
  selectedIds = [],
  selectedTopic,
  limit = 10,
  heading,
  showHeadingAndLimitControls = true,
  onChangeHeading,
  onChangeTopic,
  onChangeLimit,
  onToggleFaqId,
  onClearPickedIds,
}: CmsFaqPickerProps) {
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState<string>('all');

  const topics = useMemo(
    () => Array.from(new Set(faqs.map((f) => f.category))).sort(),
    [faqs],
  );

  const groupedFaqs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = faqs.filter((f) => {
      if (topicFilter !== 'all' && f.category !== topicFilter) return false;
      if (!q) return true;
      return (
        f.questionEn.toLowerCase().includes(q) ||
        (f.questionBn || '').toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    });

    const groups = new Map<string, CmsFaqDto[]>();
    for (const item of filtered) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [faqs, search, topicFilter]);

  return (
    <div className="space-y-3">
      {showHeadingAndLimitControls && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">FAQ Section Heading</label>
            <input
              type="text"
              lang={activeLocale}
              value={heading || ''}
              onChange={(e) => onChangeHeading?.(e.target.value || undefined)}
              placeholder="Frequently Asked Questions"
              className="w-full h-8 px-2.5 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {onChangeTopic && (
              <div>
                <label className="block text-xs font-medium mb-1">Topic Filter</label>
                <select
                  value={selectedTopic || ''}
                  onChange={(e) => onChangeTopic(e.target.value || undefined)}
                  className="w-full h-8 px-2 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
                >
                  <option value="">All Topics</option>
                  {topics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium mb-1">Max Shown</label>
              <input
                type="number"
                min={1}
                max={50}
                value={limit}
                onChange={(e) =>
                  onChangeLimit?.(Math.min(50, Math.max(1, Number(e.target.value) || 10)))
                }
                className="w-full h-8 px-2 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-xs"
              />
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-muted))]/35 p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold inline-flex items-center gap-1.5">
              <HelpCircle className="h-3.5 w-3.5 text-primary-600" />
              FAQ Library Picker ({selectedIds.length} picked)
            </span>
            {selectedIds.length > 0 && onClearPickedIds && (
              <button
                type="button"
                onClick={onClearPickedIds}
                className="text-[11px] text-primary-600 hover:underline"
              >
                Use dynamic topic
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3 w-3 text-[rgb(var(--text-muted))] absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search question or topic..."
                className="h-7 pl-6 pr-2 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[11px]"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent('hrm:platform-navigate', { detail: 'cms-faqs' }))
              }
              className="h-7 px-2 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[11px] font-medium hover:bg-[rgb(var(--bg-hover))]"
            >
              Manage FAQs
            </button>
          </div>
        </div>

        {/* Topic Filter Pills */}
        {topics.length > 1 && (
          <div className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setTopicFilter('all')}
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                topicFilter === 'all'
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))]'
              }`}
            >
              All Topics
            </button>
            {topics.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopicFilter(t)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                  topicFilter === t
                    ? 'bg-primary-600 border-primary-600 text-white'
                    : 'border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] text-[rgb(var(--text-secondary))]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Grouped FAQ Checkboxes */}
        <div className="max-h-56 overflow-y-auto space-y-3 pr-1">
          {groupedFaqs.length === 0 ? (
            <p className="text-[11px] text-[rgb(var(--text-muted))]">
              No matching FAQs in library yet — add reusable Q&amp;As in FAQ Library or adjust filters.
            </p>
          ) : (
            groupedFaqs.map(([topic, items]) => (
              <div key={topic} className="space-y-1.5">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[rgb(var(--text-muted))]">
                  <Tag className="h-3 w-3" />
                  <span>{topic}</span>
                  <span>({items.length})</span>
                </div>
                <div className="space-y-1">
                  {items.map((faq) => {
                    const checked = selectedIds.includes(faq.id);
                    const label =
                      activeLocale === 'bn' && faq.questionBn ? faq.questionBn : faq.questionEn;
                    return (
                      <label
                        key={faq.id}
                        className="flex items-start gap-2 p-2 rounded-md border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] hover:bg-[rgb(var(--bg-hover))] cursor-pointer text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleFaqId(faq.id)}
                          className="mt-0.5 rounded border-[rgb(var(--border-strong))] text-primary-600"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium leading-snug">{label}</div>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-[rgb(var(--text-muted))]">
                            <span
                              className={
                                faq.isPublished
                                  ? 'text-emerald-600 font-semibold'
                                  : 'text-amber-600 font-semibold'
                              }
                            >
                              {faq.isPublished ? 'Published' : 'Draft (hidden on site)'}
                            </span>
                            {faq.pageSlug && <span>· default page: {faq.pageSlug}</span>}
                            {activeLocale === 'bn' && !faq.questionBn && (
                              <span className="text-orange-600">· EN fallback</span>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
