import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Clock, FileSpreadsheet, Lock, Users, Wallet, type LucideIcon } from 'lucide-react';
import type { ReportCategory, ReportDefinition, ReportPeriod } from '@hrm/shared-types';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Form';
import { EmptyState } from '@/components/ui/EmptyState';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgErrorBanner, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { ReportsHubNav } from '@/components/reports/ReportsHubNav';
import { ReportPanel } from '@/components/reports/ReportPanel';
import { useCompany } from '@/context/CompanyContext';
import { getReportCatalog } from '@/lib/reports-api';
import { reportsCopy as copy } from '@/lib/reports-copy';
import { defaultPeriod, validatePeriod } from '@/lib/report-table';
import { ApiError } from '@/lib/tenant-api-client';

const CATEGORY_ORDER: ReportCategory[] = ['payroll', 'attendance', 'hr'];
const CATEGORY_ICONS: Record<ReportCategory, LucideIcon> = { payroll: Wallet, attendance: Clock, hr: Users };

const isCategory = (value: string | null): value is ReportCategory =>
  value !== null && (CATEGORY_ORDER as string[]).includes(value);

export function ReportsPage() {
  const { companyId, loading: companyLoading, error: companyError, refresh: refreshCompanies } = useCompany();
  const [searchParams, setSearchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<ReportDefinition[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const tabRefs = useRef<Partial<Record<ReportCategory, HTMLButtonElement | null>>>({});

  const loadCatalog = useCallback(async () => {
    if (!companyId) return;
    setCatalog(null);
    setCatalogError(null);
    try {
      setCatalog((await getReportCatalog(companyId)).reports);
    } catch (err) {
      setCatalogError(err instanceof ApiError || err instanceof Error ? err.message : copy.catalogError);
    }
  }, [companyId]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const categories = useMemo(
    () => CATEGORY_ORDER.filter((category) => catalog?.some((report) => report.category === category)),
    [catalog],
  );
  const requestedCategory = searchParams.get('category');
  const category = isCategory(requestedCategory) && categories.includes(requestedCategory) ? requestedCategory : categories[0];
  const reports = useMemo(() => catalog?.filter((report) => report.category === category) ?? [], [catalog, category]);
  const report = reports.find((entry) => entry.id === searchParams.get('report')) ?? reports[0] ?? null;
  const mode = report?.periodMode ?? 'historical';

  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const period = useMemo<ReportPeriod>(() => {
    const fallback = defaultPeriod(mode);
    return { from: fromParam ?? fallback.from, to: toParam ?? fallback.to };
  }, [mode, fromParam, toParam]);
  const periodError = mode === 'snapshot' ? null : validatePeriod(period);

  const updateParams = (apply: (next: URLSearchParams) => void) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        apply(next);
        return next;
      },
      { replace: true },
    );

  const selectReport = (next: ReportDefinition) =>
    updateParams((params) => {
      params.set('category', next.category);
      params.set('report', next.id);
      // A window that made sense for past activity is meaningless for upcoming dates (and vice versa).
      if (next.periodMode !== mode) {
        params.delete('from');
        params.delete('to');
      }
    });

  const selectCategory = (next: ReportCategory) => {
    const first = catalog?.find((entry) => entry.category === next);
    if (first) selectReport(first);
  };

  const setPeriod = (next: ReportPeriod) =>
    updateParams((params) => {
      params.set('from', next.from);
      params.set('to', next.to);
    });

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!category || (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')) return;
    event.preventDefault();
    const step = event.key === 'ArrowRight' ? 1 : -1;
    const next = categories[(categories.indexOf(category) + step + categories.length) % categories.length];
    selectCategory(next);
    tabRefs.current[next]?.focus();
  };

  if (companyLoading) return <PageLoadingState />;
  if (companyError) return <PageErrorState error={companyError} onRetry={() => void refreshCompanies()} />;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{copy.eyebrow}</p>
          <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
          <p className="text-sm text-secondary mt-0.5 max-w-2xl">{copy.description}</p>
        </div>
        <CompanySelector />
      </div>

      <ReportsHubNav />

      {catalogError ? (
        <OrgErrorBanner message={catalogError} onRetry={() => void loadCatalog()} />
      ) : catalog === null ? (
        <Card className="overflow-hidden">
          <OrgTableSkeleton columns={5} rows={8} />
        </Card>
      ) : !category || !report ? (
        <Card>
          <EmptyState icon={Lock} title={copy.noAccessTitle} description={copy.noAccessDescription} />
        </Card>
      ) : (
        <>
          <div role="tablist" aria-label={copy.categoryTabs} className="inline-flex p-1 rounded-lg border border-base surface gap-1">
            {categories.map((entry) => {
              const Icon = CATEGORY_ICONS[entry];
              const selected = entry === category;
              return (
                <button
                  key={entry}
                  ref={(node) => {
                    tabRefs.current[entry] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`report-tab-${entry}`}
                  aria-selected={selected}
                  aria-controls="report-category-panel"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => selectCategory(entry)}
                  onKeyDown={onTabKeyDown}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                    selected ? 'bg-accent-600 text-white shadow-sm' : 'text-secondary hover:text-primary'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {copy.categories[entry]}
                  <span className={`text-xs font-medium ${selected ? 'text-white/80' : 'text-muted'}`}>
                    {catalog.filter((item) => item.category === entry).length}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id="report-category-panel"
            role="tabpanel"
            aria-labelledby={`report-tab-${category}`}
            className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)] items-start"
          >
            <div className="lg:hidden">
              <Select
                aria-label={copy.reportList(copy.categories[category])}
                value={report.id}
                onChange={(e) => {
                  const next = reports.find((entry) => entry.id === e.target.value);
                  if (next) selectReport(next);
                }}
              >
                {reports.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.title}
                  </option>
                ))}
              </Select>
            </div>

            <Card className="hidden lg:block overflow-hidden lg:sticky lg:top-4">
              <nav aria-label={copy.reportList(copy.categories[category])} className="py-1.5 max-h-[75vh] overflow-y-auto">
                {reports.map((entry) => {
                  const active = entry.id === report.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => selectReport(entry)}
                      aria-current={active ? 'true' : undefined}
                      className={`w-full text-left px-4 py-2.5 border-l-2 transition-colors ${
                        active
                          ? 'border-accent-600 bg-accent-50 dark:bg-accent-950/40'
                          : 'border-transparent hover:bg-[rgb(var(--bg-hover))]'
                      }`}
                    >
                      <span className={`flex items-center gap-2 text-sm font-medium ${active ? 'text-accent-700 dark:text-accent-300' : 'text-primary'}`}>
                        <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                        <span className="truncate">{entry.title}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted line-clamp-2">{entry.description}</span>
                    </button>
                  );
                })}
              </nav>
            </Card>

            {companyId ? (
              <ReportPanel
                key={`${companyId}:${report.id}`}
                companyId={companyId}
                report={report}
                period={period}
                periodError={periodError}
                onPeriodChange={setPeriod}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
