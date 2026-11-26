'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useWebsiteI18n } from '../../i18n/client';
import { buildFaqPageJsonLd, safeJsonLdStringify } from '../../lib/seo';
import { SafeHtmlContent } from '../cms/SafeHtmlContent';

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  answerHtml?: string;
}

export interface FaqAccordionProps {
  items: readonly FaqItem[];
  allowMultiple?: boolean;
  defaultOpenIds?: string[];
  emitStructuredData?: boolean;
  className?: string;
}

export function FaqAccordion({
  items,
  allowMultiple = false,
  defaultOpenIds = [],
  emitStructuredData = true,
  className = '',
}: FaqAccordionProps) {
  const { t } = useWebsiteI18n();
  const baseId = useId();
  const [openIds, setOpenIds] = useState<string[]>(() =>
    defaultOpenIds.length > 0 ? defaultOpenIds : items[0] ? [items[0].id] : [],
  );

  if (items.length === 0) {
    return null;
  }

  const faqSchema = emitStructuredData ? buildFaqPageJsonLd(items) : null;

  const toggleItem = (id: string) => {
    setOpenIds((prev) => {
      const isOpen = prev.includes(id);
      if (isOpen) {
        return prev.filter((item) => item !== id);
      }
      return allowMultiple ? [...prev, id] : [id];
    });
  };

  return (
    <div
      className={`divide-y divide-[rgb(var(--border-base))] rounded-xl border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-surface))] shadow-card ${className}`.trim()}
    >
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(faqSchema) }}
        />
      )}
      {items.map((item) => {
        const isOpen = openIds.includes(item.id);
        const buttonId = `${baseId}-btn-${item.id}`;
        const panelId = `${baseId}-panel-${item.id}`;

        return (
          <div key={item.id} className="group">
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                aria-label={`${item.question} — ${isOpen ? t('a11y.collapseFaq') : t('a11y.expandFaq')}`}
                onClick={() => toggleItem(item.id)}
                className="w-full px-5 py-5 sm:px-7 sm:py-6 flex items-center justify-between gap-4 text-left font-semibold text-base sm:text-lg text-[rgb(var(--text-primary))] hover:bg-[rgb(var(--bg-hover))]/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-primary-600 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
                    }`}
                  aria-hidden="true"
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              hidden={!isOpen}
              className="px-5 pb-5 sm:px-7 sm:pb-6 text-sm sm:text-base leading-relaxed text-[rgb(var(--text-secondary))]"
            >
              {item.answerHtml ? (
                <SafeHtmlContent
                  html={item.answerHtml}
                  className="prose prose-sm sm:prose-base prose-slate dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-a:text-primary-600"
                />
              ) : (
                item.answer
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
