import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { DEFAULT_LOCALE, localizePath, type WebsiteLocale } from '../../i18n';
import { buildBreadcrumbListJsonLd, safeJsonLdStringify } from '../../lib/seo';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function HelpBreadcrumbs({
  items,
  locale = DEFAULT_LOCALE,
}: {
  items: readonly BreadcrumbItem[];
  locale?: WebsiteLocale;
}) {
  const localizedItems = items.map((item) => ({
    ...item,
    href: item.href ? localizePath(item.href, locale) : undefined,
  }));
  const jsonLd = localizedItems.length > 0 ? buildBreadcrumbListJsonLd(localizedItems) : null;

  return (
    <nav aria-label="Breadcrumb" data-testid="help-breadcrumbs">
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
        />
      )}
      <ol className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm text-[rgb(var(--text-muted))]">
        {localizedItems.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5 min-w-0">
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-primary-600 transition-colors rounded px-1 py-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className={
                    isLast
                      ? 'font-semibold text-[rgb(var(--text-primary))] truncate max-w-[260px] sm:max-w-md'
                      : undefined
                  }
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
