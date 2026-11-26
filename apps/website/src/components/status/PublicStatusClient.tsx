'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import type {
  PublicComponentState,
  PublicPlatformStatusResponse,
  PublicStatusIncident,
} from '../../api/types';
import { LOCALE_INTL_TAGS, localizePath, type WebsiteLocale } from '../../i18n';
import { useWebsiteI18n } from '../../i18n/client';
import { ButtonLink } from '../marketing';

interface PublicStatusClientProps {
  initialData: PublicPlatformStatusResponse | null;
}

const STATE_STYLES: Record<
  PublicComponentState,
  {
    bannerBg: string;
    badge: string;
    dot: string;
    bar: string;
    barMuted: string;
  }
> = {
  operational: {
    bannerBg: 'bg-success-50 border-success-200 text-success-900',
    badge: 'bg-success-50 text-success-700 border-success-200',
    dot: 'bg-success-600',
    bar: 'bg-success-500 hover:bg-success-600',
    barMuted: 'bg-success-500',
  },
  degraded: {
    bannerBg: 'bg-warning-50 border-warning-200 text-warning-900',
    badge: 'bg-warning-50 text-warning-700 border-warning-200',
    dot: 'bg-warning-500',
    bar: 'bg-warning-500 hover:bg-warning-600',
    barMuted: 'bg-warning-500',
  },
  outage: {
    bannerBg: 'bg-danger-50 border-danger-200 text-danger-900',
    badge: 'bg-danger-50 text-danger-700 border-danger-200',
    dot: 'bg-danger-600',
    bar: 'bg-danger-600 hover:bg-danger-700',
    barMuted: 'bg-danger-600',
  },
  maintenance: {
    bannerBg: 'bg-slate-100 border-slate-300 text-slate-900',
    badge: 'bg-slate-100 text-slate-700 border-slate-300',
    dot: 'bg-slate-500',
    bar: 'bg-slate-400 hover:bg-slate-500',
    barMuted: 'bg-slate-400',
  },
};

function formatShortTimestamp(iso: string | null, locale: WebsiteLocale): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(LOCALE_INTL_TAGS[locale] ?? 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function StateIcon({ state }: { state: PublicComponentState }) {
  if (state === 'operational') {
    return <ShieldCheck className="w-6 h-6 text-success-700 shrink-0" aria-hidden="true" />;
  }
  if (state === 'degraded') {
    return <AlertTriangle className="w-6 h-6 text-warning-700 shrink-0" aria-hidden="true" />;
  }
  if (state === 'outage') {
    return <AlertCircle className="w-6 h-6 text-danger-700 shrink-0" aria-hidden="true" />;
  }
  return <Wrench className="w-6 h-6 text-slate-700 shrink-0" aria-hidden="true" />;
}

function IncidentCard({ incident }: { incident: PublicStatusIncident }) {
  const { locale, t } = useWebsiteI18n();
  const severityTone =
    incident.severity === 'critical' || incident.severity === 'major'
      ? 'bg-danger-50 text-danger-700 border-danger-200'
      : incident.severity === 'minor'
        ? 'bg-warning-50 text-warning-700 border-warning-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';

  const statusTone =
    incident.status === 'resolved'
      ? 'bg-success-50 text-success-700 border-success-200'
      : 'bg-warning-50 text-warning-700 border-warning-200';

  const statusLabel = {
    investigating: t('status.incidents.statuses.investigating'),
    identified: t('status.incidents.statuses.identified'),
    monitoring: t('status.incidents.statuses.monitoring'),
    resolved: t('status.incidents.statuses.resolved'),
  }[incident.status];

  const severityLabel = {
    minor: t('status.incidents.severities.minor'),
    major: t('status.incidents.severities.major'),
    critical: t('status.incidents.severities.critical'),
    maintenance: t('status.incidents.severities.maintenance'),
  }[incident.severity];

  return (
    <article
      data-testid={`status-incident-${incident.incidentNumber}`}
      className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 shadow-xs space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-[rgb(var(--text-muted))]">
              {incident.incidentNumber}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full border text-2xs font-semibold ${statusTone}`}>
              {statusLabel}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full border text-2xs font-semibold ${severityTone}`}>
              {severityLabel}
            </span>
            <span className="px-2.5 py-0.5 rounded-full border border-[rgb(var(--border-base))] bg-[rgb(var(--bg-subtle))] text-2xs font-medium text-[rgb(var(--text-secondary))]">
              {incident.componentLabel}
            </span>
          </div>
          <h3 className="text-lg font-bold text-[rgb(var(--text-primary))]">{incident.title}</h3>
        </div>

        <div className="text-xs text-[rgb(var(--text-muted))] sm:text-right shrink-0 space-y-0.5">
          <div>
            {t('status.incidents.startedLabel')}: {formatShortTimestamp(incident.startedAt, locale)}
          </div>
          {incident.resolvedAt ? (
            <div>
              {t('status.incidents.resolvedLabel')}: {formatShortTimestamp(incident.resolvedAt, locale)}
            </div>
          ) : null}
          <div>
            {t('status.incidents.durationLabel')}:{' '}
            <span className="font-semibold text-[rgb(var(--text-primary))]">
              {incident.durationMinutes !== null && incident.durationMinutes !== undefined
                ? t('status.incidents.durationMinutes', { minutes: incident.durationMinutes })
                : t('status.incidents.durationOngoing')}
            </span>
          </div>
        </div>
      </div>

      <p className="text-sm text-[rgb(var(--text-secondary))] leading-relaxed">{incident.impact}</p>

      {incident.updates.length > 0 && (
        <div className="border-t border-[rgb(var(--border-base))] pt-4 space-y-2.5">
          <h4 className="text-2xs font-semibold uppercase tracking-wider text-[rgb(var(--text-muted))]">
            {t('status.incidents.timelineHeading')}
          </h4>
          <ol className="space-y-2">
            {incident.updates.map((upd, idx) => {
              const updStatusLabel = {
                investigating: t('status.incidents.statuses.investigating'),
                identified: t('status.incidents.statuses.identified'),
                monitoring: t('status.incidents.statuses.monitoring'),
                resolved: t('status.incidents.statuses.resolved'),
              }[upd.status];

              return (
                <li
                  key={`${upd.timestamp}-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-xs"
                >
                  <span className="inline-flex items-center gap-1.5 font-mono text-[rgb(var(--text-muted))] shrink-0">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                    {formatShortTimestamp(upd.timestamp, locale)}
                  </span>
                  <span className="font-semibold text-[rgb(var(--text-primary))] capitalize shrink-0">
                    [{updStatusLabel}]
                  </span>
                  <span className="text-[rgb(var(--text-secondary))] leading-relaxed">
                    {upd.message}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </article>
  );
}

export function PublicStatusClient({ initialData }: PublicStatusClientProps) {
  const { locale, t } = useWebsiteI18n();
  const [statusData, setStatusData] = useState<PublicPlatformStatusResponse | null>(initialData);
  const [refreshing, setRefreshing] = useState(false);

  const refreshStatus = useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await apiClient.system.getPublicPlatformStatus({ cache: 'no-store' });
      if (fresh) {
        setStatusData(fresh);
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const intervalMs = Math.max(10, statusData?.refreshIntervalSeconds ?? 30) * 1000;
    const timer = setInterval(() => {
      refreshStatus();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [refreshStatus, statusData?.refreshIntervalSeconds]);

  if (!statusData) {
    return (
      <div
        data-testid="status-unavailable-fallback"
        className="surface rounded-2xl border border-warning-200 bg-warning-50 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-warning-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-warning-900">{t('status.overall.degraded')}</h2>
            <p className="text-sm text-warning-800">{t('status.overall.unavailableFallback')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={refreshStatus}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-700 transition-colors shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          {refreshing ? t('status.overall.refreshingButton') : t('status.overall.refreshButton')}
        </button>
      </div>
    );
  }

  const overallTone = STATE_STYLES[statusData.overallState] ?? STATE_STYLES.operational;

  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      {/* Overall Status Summary Banner */}
      <div
        data-testid="status-overall-banner"
        data-state={statusData.overallState}
        className={`rounded-2xl border p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5 ${overallTone.bannerBg}`}
      >
        <div className="flex items-start gap-3.5">
          <StateIcon state={statusData.overallState} />
          <div className="space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              {t(`status.overall.${statusData.overallState}`)}
            </h2>
            <p className="text-sm opacity-90">
              {t(`status.overall.${statusData.overallState}Subtitle`)}
            </p>
            <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-80">
              <span>
                {t('status.overall.lastUpdatedLabel')}: {formatShortTimestamp(statusData.updatedAt, locale)}
              </span>
              <span>
                {t('status.overall.autoRefreshNote', { seconds: statusData.refreshIntervalSeconds })}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          data-testid="status-refresh-btn"
          onClick={refreshStatus}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-black/15 bg-white/80 hover:bg-white text-xs font-semibold text-[rgb(var(--text-primary))] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{refreshing ? t('status.overall.refreshingButton') : t('status.overall.refreshButton')}</span>
        </button>
      </div>

      {/* Scheduled or Active Maintenance Notice */}
      {(statusData.maintenance.active || statusData.maintenance.scheduled) && (
        <div
          data-testid="status-maintenance-banner"
          className="surface rounded-2xl border border-slate-300 bg-slate-50 p-5 flex items-start gap-3"
        >
          <Wrench className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1 text-sm">
            <div className="font-bold text-[rgb(var(--text-primary))]">
              {statusData.maintenance.active
                ? t('status.maintenanceBanner.activeTitle')
                : t('status.maintenanceBanner.scheduledTitle')}
            </div>
            {statusData.maintenance.message && (
              <p className="text-[rgb(var(--text-secondary))]">{statusData.maintenance.message}</p>
            )}
            {(statusData.maintenance.scheduledStart || statusData.maintenance.scheduledEnd) && (
              <p className="text-xs text-[rgb(var(--text-muted))]">
                {t('status.maintenanceBanner.windowLabel')}:{' '}
                {formatShortTimestamp(statusData.maintenance.scheduledStart, locale)} –{' '}
                {formatShortTimestamp(statusData.maintenance.scheduledEnd, locale)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Active Incidents (if any) */}
      <section aria-labelledby="active-incidents-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="active-incidents-heading"
            className="text-xl font-bold tracking-tight text-[rgb(var(--text-primary))]"
          >
            {t('status.incidents.activeHeading')}
          </h2>
          <span className="text-xs font-semibold text-[rgb(var(--text-muted))]">
            {statusData.activeIncidents.length}
          </span>
        </div>

        {statusData.activeIncidents.length === 0 ? (
          <div
            data-testid="status-no-active-incidents"
            className="surface rounded-2xl border border-[rgb(var(--border-base))] p-5 flex items-center gap-2.5 text-sm text-[rgb(var(--text-secondary))]"
          >
            <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" aria-hidden="true" />
            <span>{t('status.incidents.activeEmpty')}</span>
          </div>
        ) : (
          <div data-testid="status-active-incidents-list" className="space-y-4">
            {statusData.activeIncidents.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </div>
        )}
      </section>

      {/* Core Components + 90-Day Uptime Bars */}
      <section aria-labelledby="components-heading" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2
              id="components-heading"
              className="text-xl font-bold tracking-tight text-[rgb(var(--text-primary))]"
            >
              {t('status.components.heading')}
            </h2>
            <p className="text-sm text-[rgb(var(--text-muted))] mt-0.5">
              {t('status.components.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-[rgb(var(--text-muted))]">
            {(['operational', 'degraded', 'maintenance', 'outage'] as PublicComponentState[]).map(
              (legendState) => (
                <span key={legendState} className="inline-flex items-center gap-1.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-xs ${STATE_STYLES[legendState].barMuted}`}
                    aria-hidden="true"
                  />
                  {t(`status.components.legend.${legendState}`)}
                </span>
              ),
            )}
          </div>
        </div>

        <div data-testid="status-components-list" className="space-y-4">
          {statusData.components.map((comp) => {
            const compStyle = STATE_STYLES[comp.state] ?? STATE_STYLES.operational;
            return (
              <div
                key={comp.id}
                data-testid={`status-component-${comp.id}`}
                data-state={comp.state}
                className="surface rounded-2xl border border-[rgb(var(--border-base))] p-5 sm:p-6 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-[rgb(var(--text-primary))]">
                      {comp.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-[rgb(var(--text-muted))] mt-0.5">
                      {comp.description}
                    </p>
                  </div>

                  <span
                    data-testid={`status-component-badge-${comp.id}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold self-start sm:self-center shrink-0 ${compStyle.badge}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${compStyle.dot}`} aria-hidden="true" />
                    {t(`status.states.${comp.state}`)}
                  </span>
                </div>

                {/* 90-Day Uptime Bars */}
                <div className="space-y-1.5">
                  <div
                    data-testid={`status-uptime-bars-${comp.id}`}
                    className="grid gap-[2px] h-8 items-stretch"
                    style={{ gridTemplateColumns: `repeat(${comp.days.length}, minmax(0, 1fr))` }}
                    role="img"
                    aria-label={`${comp.name}: ${comp.uptime90dPercentage.toFixed(2)}% ${t('status.components.uptimeSuffix')}`}
                  >
                    {comp.days.map((day) => {
                      const barStyle = STATE_STYLES[day.state] ?? STATE_STYLES.operational;
                      const stateText = t(`status.states.${day.state}`);
                      const title =
                        day.incidentCount > 0
                          ? t(
                              day.incidentCount === 1
                                ? 'status.components.tooltipDayIncidents'
                                : 'status.components.tooltipDayIncidentsPlural',
                              {
                                date: day.date,
                                state: stateText,
                                uptime: day.uptimePercentage.toFixed(2),
                                count: day.incidentCount,
                              },
                            )
                          : t('status.components.tooltipDayClean', {
                              date: day.date,
                              state: stateText,
                              uptime: day.uptimePercentage.toFixed(2),
                            });

                      return (
                        <span
                          key={day.date}
                          data-date={day.date}
                          data-day-state={day.state}
                          title={title}
                          className={`rounded-[1px] transition-colors ${barStyle.bar}`}
                        />
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-2xs text-[rgb(var(--text-muted))]">
                    <span>{t('status.components.ninetyDaysAgo')}</span>
                    <span className="font-mono font-semibold text-[rgb(var(--text-secondary))]">
                      {comp.uptime90dPercentage.toFixed(2)}% {t('status.components.uptimeSuffix')}
                    </span>
                    <span>{t('status.components.today')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Resolved Incident History */}
      <section aria-labelledby="incident-history-heading" className="space-y-4">
        <div>
          <h2
            id="incident-history-heading"
            className="text-xl font-bold tracking-tight text-[rgb(var(--text-primary))]"
          >
            {t('status.incidents.historyHeading')}
          </h2>
          <p className="text-sm text-[rgb(var(--text-muted))] mt-0.5">
            {t('status.incidents.historySubtitle')}
          </p>
        </div>

        {statusData.incidentHistory.length === 0 ? (
          <div
            data-testid="status-no-past-incidents"
            className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 text-sm text-[rgb(var(--text-muted))]"
          >
            {t('status.incidents.historyEmpty')}
          </div>
        ) : (
          <div data-testid="status-incident-history-list" className="space-y-4">
            {statusData.incidentHistory.map((inc) => (
              <IncidentCard key={inc.id} incident={inc} />
            ))}
          </div>
        )}
      </section>

      {/* Support Link Footer Box */}
      <div className="surface rounded-2xl border border-[rgb(var(--border-base))] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm font-medium text-[rgb(var(--text-primary))]">
          {t('status.helpFooter.question')}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink href="/help" variant="secondary" size="sm">
            {t('status.helpFooter.helpCta')}
          </ButtonLink>
          <Link
            href={localizePath('/contact', locale)}
            className="text-xs font-semibold text-primary-600 hover:underline px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            {t('status.helpFooter.contactCta')}
          </Link>
        </div>
      </div>
    </div>
  );
}
