import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, Eye, FileText, Lock, Wallet } from 'lucide-react';
import type { PayslipRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusPill } from '@/components/ui/StatusPill';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { useMyEmployee } from '@/components/my/useMyEmployee';
import { downloadMyPayslip, listMyPayslips } from '@/lib/my-api';
import { fetchPayslipPdf } from '@/lib/payroll-runs-api';
import { saveBlob } from '@/lib/download';
import { ApiError } from '@/lib/tenant-api-client';

function parseDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function payslipYear(payslip: PayslipRecord): string {
  return (payslip.periodEndDate ?? payslip.periodStartDate ?? payslip.generatedAt).slice(0, 4);
}

function toCents(amount: string | undefined): number {
  if (!amount) return 0;
  const normalized = Number(amount);
  return Number.isFinite(normalized) ? Math.round(normalized * 100) : 0;
}

function formatCents(cents: number, currency: string | undefined, locale: string): string {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
  return currency ? `${currency} ${formatted}` : formatted;
}

function formatAmount(amount: string | undefined, currency: string | undefined, locale: string): string {
  if (amount === undefined) return '—';
  return formatCents(toCents(amount), currency, locale);
}

function payslipFilename(payslip: PayslipRecord): string {
  if (payslip.periodStartDate && payslip.periodEndDate) {
    return `payslip-${payslip.periodStartDate}-to-${payslip.periodEndDate}.pdf`;
  }
  return `payslip-${payslip.generatedAt.slice(0, 10)}.pdf`;
}

export function MyPayslipsPage() {
  const { t, i18n } = useAppTranslation();
  const locale = i18n.language?.startsWith('bn') ? 'bn-BD' : 'en-GB';
  const { employeeId, loading: empLoading, error: empError } = useMyEmployee();

  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [previewItem, setPreviewItem] = useState<PayslipRecord | null>(null);

  const dateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
    [locale],
  );
  const shortDateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }),
    [locale],
  );

  const formatPeriod = (payslip: PayslipRecord): string => {
    if (!payslip.periodStartDate || !payslip.periodEndDate) {
      return t('payslips.run', { id: payslip.payrollRunId.slice(0, 8) });
    }
    const start = parseDate(payslip.periodStartDate);
    const end = parseDate(payslip.periodEndDate);
    const startLabel =
      start.getFullYear() === end.getFullYear() ? shortDateFmt.format(start) : dateFmt.format(start);
    return t('payslips.payPeriod', {
      start: startLabel,
      end: dateFmt.format(end),
    });
  };

  useEffect(() => {
    if (empLoading) return;
    if (!employeeId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    listMyPayslips(employeeId)
      .then((rows) => {
        if (cancelled) return;
        const sorted = [...rows].sort((a, b) => {
          const aKey = a.periodStartDate ?? a.generatedAt;
          const bKey = b.periodStartDate ?? b.generatedAt;
          return bKey.localeCompare(aKey);
        });
        setPayslips(sorted);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : t('errors.loadEmployeeData'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, empLoading, t]);

  const years = useMemo(() => {
    const unique = Array.from(new Set(payslips.map(payslipYear))).sort((a, b) => b.localeCompare(a));
    return unique;
  }, [payslips]);

  const visiblePayslips = useMemo(() => {
    if (yearFilter === 'all') return payslips;
    return payslips.filter((item) => payslipYear(item) === yearFilter);
  }, [payslips, yearFilter]);

  const totals = useMemo(() => {
    if (visiblePayslips.length === 0) return null;
    const currencies = Array.from(
      new Set(visiblePayslips.map((p) => p.payCurrency).filter((c): c is string => Boolean(c))),
    );
    if (currencies.length > 1) return null;
    const currency = currencies[0];
    return {
      currency,
      netCents: visiblePayslips.reduce((sum, item) => sum + toCents(item.netPay), 0),
      grossCents: visiblePayslips.reduce((sum, item) => sum + toCents(item.grossPay), 0),
      deductionCents: visiblePayslips.reduce((sum, item) => sum + toCents(item.totalDeductions), 0),
    };
  }, [visiblePayslips]);

  const download = async (payslip: PayslipRecord) => {
    if (!payslip.downloadUrl) return;
    setDownloadingId(payslip.id);
    setError(null);
    try {
      await downloadMyPayslip(payslip.downloadUrl, payslipFilename(payslip));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.unknownError'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <MyPageLayout
      title={t('payslips.title')}
      subtitle={t('payslips.subtitle')}
      loading={empLoading}
      error={empError}
    >
      {employeeId ? (
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="space-y-4">
              <Card>
                <CardBody className="grid gap-4 sm:grid-cols-3">
                  {[0, 1, 2].map((idx) => (
                    <div key={idx} className="space-y-2">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-6 w-32" />
                    </div>
                  ))}
                </CardBody>
              </Card>
              <Card>
                <CardBody className="space-y-3">
                  {[0, 1, 2].map((idx) => (
                    <Skeleton key={idx} className="h-16 w-full" />
                  ))}
                </CardBody>
              </Card>
            </div>
          ) : payslips.length === 0 ? (
            <Card>
              <EmptyState icon={Wallet} title={t('payslips.empty')} compact />
            </Card>
          ) : (
            <>
              {totals && (
                <Card>
                  <CardBody className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <div className="text-xs text-muted">
                        {t('payslips.totalNet')} ·{' '}
                        {t('payslips.summaryCount', { count: visiblePayslips.length })}
                      </div>
                      <div className="mt-1 text-xl font-semibold tabular-nums text-primary">
                        {formatCents(totals.netCents, totals.currency, locale)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">{t('payslips.totalGross')}</div>
                      <div className="mt-1 text-lg font-medium tabular-nums text-primary">
                        {formatCents(totals.grossCents, totals.currency, locale)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted">{t('payslips.totalDeductions')}</div>
                      <div className="mt-1 text-lg font-medium tabular-nums text-secondary">
                        {formatCents(totals.deductionCents, totals.currency, locale)}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              {years.length > 1 && (
                <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={t('payslips.allYears')}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={yearFilter === 'all'}
                    onClick={() => setYearFilter('all')}
                    className={`min-h-[36px] rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      yearFilter === 'all'
                        ? 'border-accent-500 bg-accent-50 text-accent-700 dark:border-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
                        : 'border-base text-secondary hover:bg-[rgb(var(--bg-muted))]'
                    }`}
                  >
                    {t('payslips.allYears')} ({payslips.length})
                  </button>
                  {years.map((year) => {
                    const count = payslips.filter((p) => payslipYear(p) === year).length;
                    const active = yearFilter === year;
                    return (
                      <button
                        key={year}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setYearFilter(year)}
                        className={`min-h-[36px] rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          active
                            ? 'border-accent-500 bg-accent-50 text-accent-700 dark:border-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
                            : 'border-base text-secondary hover:bg-[rgb(var(--bg-muted))]'
                        }`}
                      >
                        {year} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {visiblePayslips.length === 0 ? (
                <Card>
                  <CardBody className="text-sm text-muted">
                    {t('payslips.emptyFiltered', { year: yearFilter })}
                  </CardBody>
                </Card>
              ) : (
                <div className="space-y-3">
                  {visiblePayslips.map((payslip) => (
                    <Card key={payslip.id}>
                      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-accent-600" aria-hidden />
                            <span className="font-semibold text-primary">
                              {formatPeriod(payslip)}
                            </span>
                            {payslip.runStatus && (
                              <StatusPill tone={payslip.runStatus === 'paid' ? 'success' : 'accent'}>
                                <Lock className="h-3 w-3 -ml-0.5" aria-hidden />
                                {t(`payslips.status.${payslip.runStatus}`, {
                                  defaultValue: payslip.runStatus,
                                })}
                              </StatusPill>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                            {payslip.paymentDate && (
                              <span>
                                {t('payslips.payDate', {
                                  date: dateFmt.format(parseDate(payslip.paymentDate)),
                                })}
                              </span>
                            )}
                            <span>
                              {t('payslips.generated', {
                                date: dateFmt.format(new Date(payslip.generatedAt)),
                              })}
                            </span>
                            <span>{t('payslips.run', { id: payslip.payrollRunId.slice(0, 8) })}</span>
                          </div>
                          {(payslip.grossPay !== undefined ||
                            payslip.totalDeductions !== undefined ||
                            payslip.netPay !== undefined) && (
                            <div className="flex flex-wrap gap-x-5 gap-y-1 pt-1 text-xs">
                              {payslip.grossPay !== undefined && (
                                <span>
                                  <span className="text-muted">{t('payslips.gross')}: </span>
                                  <span className="font-medium tabular-nums text-primary">
                                    {formatAmount(payslip.grossPay, payslip.payCurrency, locale)}
                                  </span>
                                </span>
                              )}
                              {payslip.totalDeductions !== undefined && (
                                <span>
                                  <span className="text-muted">{t('payslips.deductions')}: </span>
                                  <span className="font-medium tabular-nums text-secondary">
                                    {formatAmount(
                                      payslip.totalDeductions,
                                      payslip.payCurrency,
                                      locale,
                                    )}
                                  </span>
                                </span>
                              )}
                              {payslip.netPay !== undefined && (
                                <span>
                                  <span className="text-muted">{t('payslips.net')}: </span>
                                  <span className="font-semibold tabular-nums text-primary">
                                    {formatAmount(payslip.netPay, payslip.payCurrency, locale)}
                                  </span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {payslip.downloadUrl && (
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="min-h-[40px]"
                              onClick={() => setPreviewItem(payslip)}
                            >
                              <Eye className="h-4 w-4" />
                              {t('payslips.preview')}
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              className="min-h-[40px]"
                              disabled={downloadingId === payslip.id}
                              onClick={() => void download(payslip)}
                            >
                              <Download className="h-4 w-4" />
                              {downloadingId === payslip.id
                                ? t('common.downloading')
                                : t('common.download')}
                            </Button>
                          </div>
                        )}
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : null}

      {previewItem && employeeId && (
        <MyPayslipPreviewModal
          employeeId={employeeId}
          payslip={previewItem}
          periodLabel={formatPeriod(previewItem)}
          onClose={() => setPreviewItem(null)}
        />
      )}
    </MyPageLayout>
  );
}

function MyPayslipPreviewModal({
  employeeId,
  payslip,
  periodLabel,
  onClose,
}: {
  employeeId: string;
  payslip: PayslipRecord;
  periodLabel: string;
  onClose: () => void;
}) {
  const { t } = useAppTranslation();
  const [pdf, setPdf] = useState<
    | { status: 'loading' }
    | { status: 'ready'; blob: Blob; url: string; filename: string }
    | { status: 'error'; message: string }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    fetchPayslipPdf(employeeId, payslip.id)
      .then(({ blob, filename }) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPdf({ status: 'ready', blob, url, filename });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPdf({
            status: 'error',
            message: err instanceof ApiError || err instanceof Error ? err.message : t('payslips.previewError'),
          });
        }
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [employeeId, payslip.id, t]);

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={t('payslips.previewTitle')}
      description={periodLabel}
      footer={
        <>
          <Button variant="secondary" className="min-h-[44px]" onClick={onClose}>
            {t('common.close')}
          </Button>
          {pdf.status === 'ready' && (
            <Button
              variant="primary"
              className="min-h-[44px]"
              onClick={() => saveBlob(pdf.blob, payslipFilename(payslip))}
            >
              <Download className="h-4 w-4" />
              {t('common.download')}
            </Button>
          )}
        </>
      }
    >
      {pdf.status === 'loading' ? (
        <div className="flex h-[60vh] items-center justify-center text-sm text-muted">
          {t('payslips.previewLoading')}
        </div>
      ) : pdf.status === 'error' ? (
        <div className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 p-4 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/30 dark:text-error-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{pdf.message}</span>
        </div>
      ) : (
        <iframe
          title={`${t('payslips.previewTitle')} — ${periodLabel}`}
          src={pdf.url}
          className="h-[68vh] w-full rounded-lg border border-base bg-white"
        />
      )}
    </Modal>
  );
}
