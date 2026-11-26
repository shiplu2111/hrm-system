'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  FileSpreadsheet,
  KeyRound,
  Mail,
  Smartphone,
  Webhook,
} from 'lucide-react';
import type {
  IntegrationCategory,
  IntegrationItem,
  IntegrationStatus,
} from '../../data/integrations';
import { useWebsiteI18n } from '../../i18n/client';

interface IntegrationsDirectoryClientProps {
  items: readonly IntegrationItem[];
}

const CATEGORIES: readonly IntegrationCategory[] = [
  'accounting',
  'payments',
  'notifications',
  'attendance',
  'developer',
  'calendar_sso',
];

function CategoryIcon({ category }: { category: IntegrationCategory }) {
  switch (category) {
    case 'accounting':
      return <FileSpreadsheet className="w-4 h-4 text-primary-600" aria-hidden="true" />;
    case 'payments':
      return <CreditCard className="w-4 h-4 text-primary-600" aria-hidden="true" />;
    case 'notifications':
      return <Mail className="w-4 h-4 text-primary-600" aria-hidden="true" />;
    case 'attendance':
      return <Smartphone className="w-4 h-4 text-primary-600" aria-hidden="true" />;
    case 'developer':
      return <Webhook className="w-4 h-4 text-primary-600" aria-hidden="true" />;
    case 'calendar_sso':
      return <KeyRound className="w-4 h-4 text-primary-600" aria-hidden="true" />;
  }
}

export function IntegrationsDirectoryClient({ items }: IntegrationsDirectoryClientProps) {
  const { t } = useWebsiteI18n();
  const [selectedCategory, setSelectedCategory] = useState<IntegrationCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<IntegrationStatus | 'all'>('all');

  const categoryLabels: Record<IntegrationCategory, string> = useMemo(
    () => ({
      accounting: t('integrations.filters.categories.accounting'),
      payments: t('integrations.filters.categories.payments'),
      notifications: t('integrations.filters.categories.notifications'),
      attendance: t('integrations.filters.categories.attendance'),
      developer: t('integrations.filters.categories.developer'),
      calendar_sso: t('integrations.filters.categories.calendar_sso'),
    }),
    [t],
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
      return true;
    });
  }, [items, selectedCategory, selectedStatus]);

  return (
    <div className="space-y-8">
      {/* Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[rgb(var(--border-base))] pb-6">
        {/* Category Pills */}
        <div
          data-testid="integrations-category-filters"
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label={t('integrations.filters.categoryLabel')}
        >
          <button
            type="button"
            data-testid="integrations-category-all"
            aria-pressed={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
              selectedCategory === 'all'
                ? 'border-primary-600 bg-primary-600 text-white'
                : 'border-[rgb(var(--border-base))] surface text-[rgb(var(--text-secondary))] hover:border-primary-400'
            }`}
          >
            {t('integrations.filters.allCategories')} ({items.length})
          </button>

          {CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            const count = items.filter((i) => i.category === category).length;
            return (
              <button
                key={category}
                type="button"
                data-testid={`integrations-category-${category}`}
                aria-pressed={active}
                onClick={() => setSelectedCategory(category)}
                className={`px-3.5 py-1.5 rounded-full border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  active
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-[rgb(var(--border-base))] surface text-[rgb(var(--text-secondary))] hover:border-primary-400'
                }`}
              >
                {categoryLabels[category]} ({count})
              </button>
            );
          })}
        </div>

        {/* Availability Filter */}
        <div
          data-testid="integrations-status-filters"
          className="flex items-center gap-1.5 shrink-0"
          role="group"
          aria-label={t('integrations.filters.statusLabel')}
        >
          {(
            [
              { value: 'all', label: t('integrations.filters.allStatuses') },
              { value: 'live', label: t('integrations.filters.statusLive') },
              { value: 'coming_soon', label: t('integrations.filters.statusComingSoon') },
            ] as const
          ).map((opt) => {
            const active = selectedStatus === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                data-testid={`integrations-status-${opt.value}`}
                aria-pressed={active}
                onClick={() => setSelectedStatus(opt.value)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  active
                    ? 'border-primary-600 bg-primary-50 text-primary-700'
                    : 'border-[rgb(var(--border-base))] surface text-[rgb(var(--text-secondary))] hover:border-primary-400'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Integration Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-8 text-center space-y-3">
          <p className="text-sm text-[rgb(var(--text-secondary))]">
            {t('integrations.filters.emptyMessage')}
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setSelectedStatus('all');
            }}
            className="text-xs font-semibold text-primary-600 hover:underline"
          >
            {t('integrations.filters.resetButton')}
          </button>
        </div>
      ) : (
        <div
          data-testid="integrations-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredItems.map((item) => {
            const isLive = item.status === 'live';
            return (
              <article
                key={item.id}
                data-testid={`integration-card-${item.id}`}
                data-status={item.status}
                data-category={item.category}
                className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 shadow-xs flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))]">
                      <CategoryIcon category={item.category} />
                      <span>{categoryLabels[item.category]}</span>
                    </span>

                    <span
                      data-testid={`integration-badge-${item.id}`}
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-2xs font-semibold shrink-0 ${
                        isLive
                          ? 'bg-success-50 text-success-700 border-success-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {isLive ? (
                        <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                      ) : (
                        <Clock className="w-3 h-3" aria-hidden="true" />
                      )}
                      {isLive ? t('integrations.card.statusLive') : t('integrations.card.statusComingSoon')}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-lg font-bold text-[rgb(var(--text-primary))] leading-snug">
                      {item.name}
                    </h2>
                    <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  <ul className="space-y-1.5 text-xs text-[rgb(var(--text-secondary))] list-disc pl-4">
                    {item.capabilities.map((cap, idx) => (
                      <li key={idx}>{cap}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-[rgb(var(--border-base))] text-2xs font-mono text-[rgb(var(--text-muted))]">
                  {item.authOrProtocol}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
