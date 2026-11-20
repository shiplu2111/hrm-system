import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  PencilLine,
} from 'lucide-react';
import type {
  AttendanceRegisterDay,
  EmployeeAttendanceHistoryView,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import {
  attendanceCalendarTileClass,
  attendanceDayBadgeTone,
} from '@/components/attendance/attendance-status';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatAttendanceMinutes } from '@/lib/my-api';

type ViewMode = 'calendar' | 'list';

interface AttendanceHistorySectionProps {
  monthKey: string;
  canNextMonth: boolean;
  onChangeMonth: (delta: -1 | 1) => void;
  history: EmployeeAttendanceHistoryView | null;
  loading: boolean;
  canRequestCorrection: boolean;
  onRequestCorrection: (day: AttendanceRegisterDay) => void;
}

const DEFAULT_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function mondayBasedOffset(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const utcDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return (utcDay + 6) % 7;
}

function formatMonthTitle(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function AttendanceHistorySection({
  monthKey,
  canNextMonth,
  onChangeMonth,
  history,
  loading,
  canRequestCorrection,
  onRequestCorrection,
}: AttendanceHistorySectionProps) {
  const { t } = useAppTranslation();
  const emDash = t('common.emDash');
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  const rawWeekdays = t('attendance.myPage.weekdays', { returnObjects: true });
  const weekdays =
    Array.isArray(rawWeekdays) && rawWeekdays.length === 7
      ? (rawWeekdays as string[])
      : DEFAULT_WEEKDAYS;

  const leadingBlanks = useMemo(() => {
    const firstKey = history?.days[0]?.date ?? `${monthKey}-01`;
    return mondayBasedOffset(firstKey);
  }, [history?.days, monthKey]);

  const counts = history?.counts ?? {};
  const presentCount =
    (counts.present ?? 0) + (counts.wfh ?? 0) + (counts.business_trip ?? 0);
  const lateOrHalfCount =
    (counts.late ?? 0) + (counts.early_leave ?? 0) + (counts.half_day ?? 0);
  const absentCount = counts.absent ?? 0;
  const totalNetMinutes = history?.netMinutes ?? 0;
  const todayKey = history?.today ?? new Date().toISOString().slice(0, 10);

  const statusLabel = (status: AttendanceRegisterDay['status']) =>
    t(`attendance.statusValue.${status}`, {
      defaultValue: status.replace(/_/g, ' '),
    });

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent-600" />
          <CardTitle>{t('attendance.myPage.historyTitle')}</CardTitle>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-base surface p-0.5">
            <button
              type="button"
              onClick={() => onChangeMonth(-1)}
              aria-label={t('attendance.myPage.previousMonth')}
              className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2.5 text-xs font-semibold text-primary min-w-[120px] text-center">
              {formatMonthTitle(monthKey)}
            </span>
            <button
              type="button"
              onClick={() => onChangeMonth(1)}
              disabled={!canNextMonth}
              aria-label={t('attendance.myPage.nextMonth')}
              className="p-1.5 rounded-md text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))] disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="inline-flex items-center rounded-lg border border-base surface p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              {t('attendance.myPage.calendarView')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/50 dark:text-accent-300'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              {t('attendance.myPage.listView')}
            </button>
          </div>
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border border-success-200 bg-success-50/60 dark:border-success-800/60 dark:bg-success-950/30 px-3 py-2">
            <div className="text-[11px] font-medium text-success-700 dark:text-success-300">
              {t('attendance.myPage.summaryPresent')}
            </div>
            <div className="text-lg font-bold text-primary">{presentCount}</div>
          </div>
          <div className="rounded-lg border border-warning-200 bg-warning-50/60 dark:border-warning-800/60 dark:bg-warning-950/30 px-3 py-2">
            <div className="text-[11px] font-medium text-warning-700 dark:text-warning-300">
              {t('attendance.myPage.summaryLateHalf')}
            </div>
            <div className="text-lg font-bold text-primary">{lateOrHalfCount}</div>
          </div>
          <div className="rounded-lg border border-error-200 bg-error-50/60 dark:border-error-800/60 dark:bg-error-950/30 px-3 py-2">
            <div className="text-[11px] font-medium text-error-700 dark:text-error-300">
              {t('attendance.myPage.summaryAbsent')}
            </div>
            <div className="text-lg font-bold text-primary">{absentCount}</div>
          </div>
          <div className="rounded-lg border border-base bg-[rgb(var(--bg-muted))] px-3 py-2">
            <div className="text-[11px] font-medium text-secondary">
              {t('attendance.myPage.summaryHours')}
            </div>
            <div className="text-lg font-bold text-primary">
              {formatAttendanceMinutes(totalNetMinutes)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="success" dot className="capitalize">
            {statusLabel('present')}
          </Badge>
          <Badge tone="warning" dot className="capitalize">
            {statusLabel('late')}
          </Badge>
          <Badge tone="error" dot className="capitalize">
            {statusLabel('absent')}
          </Badge>
          <Badge tone="accent" dot className="capitalize">
            {statusLabel('scheduled')}
          </Badge>
          <Badge tone="neutral" dot className="capitalize">
            {statusLabel('leave')} / {statusLabel('holiday')}
          </Badge>
        </div>

        {loading && !history ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 14 }, (_, idx) => (
              <Skeleton key={idx} className="h-20 w-full" />
            ))}
          </div>
        ) : !history || history.days.length === 0 ? (
          <p className="text-sm text-muted py-6 text-center">
            {t('attendance.myPage.noHistory')}
          </p>
        ) : viewMode === 'calendar' ? (
          <div className="overflow-x-auto">
            <div className="min-w-[640px] space-y-2">
              <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted">
                {weekdays.map((dayName) => (
                  <div key={dayName} className="py-1">
                    {dayName}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: leadingBlanks }, (_, idx) => (
                  <div
                    key={`blank-${idx}`}
                    className="min-h-[86px] rounded-lg border border-dashed border-base/50 bg-[rgb(var(--bg-muted))]/30"
                  />
                ))}
                {history.days.map((day) => {
                  const dayNum = Number(day.date.slice(8, 10));
                  const isFuture = day.date > todayKey;
                  const canEdit = canRequestCorrection && !isFuture;
                  const tone = attendanceDayBadgeTone(day.status);
                  return (
                    <div
                      key={day.date}
                      className={`min-h-[86px] rounded-lg border p-2 flex flex-col justify-between transition-colors ${attendanceCalendarTileClass(day.status)} ${
                        day.date === todayKey ? 'ring-2 ring-accent-500/40' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-primary">
                          {dayNum}
                        </span>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => onRequestCorrection(day)}
                            title={t('attendance.myPage.requestCorrection')}
                            aria-label={`${t('attendance.myPage.requestCorrection')} ${day.date}`}
                            className="p-1 rounded hover:bg-[rgb(var(--bg-hover))] text-muted hover:text-accent-600"
                          >
                            <PencilLine className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <Badge
                          tone={tone}
                          dot
                          className="capitalize max-w-full truncate text-[10px] px-1.5 py-0"
                        >
                          {statusLabel(day.status)}
                        </Badge>
                        {day.clockInDisplay || day.clockOutDisplay ? (
                          <div className="text-[10px] text-secondary truncate">
                            {day.clockInDisplay ?? emDash} – {day.clockOutDisplay ?? emDash}
                          </div>
                        ) : day.holidayName ? (
                          <div className="text-[10px] text-muted truncate">
                            {day.holidayName}
                          </div>
                        ) : day.leaveTypeName ? (
                          <div className="text-[10px] text-muted truncate">
                            {day.leaveTypeName}
                          </div>
                        ) : null}
                        {day.flags.missedPunch && (
                          <div className="text-[10px] font-medium text-error-600 flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">
                              {t('attendance.myPage.missedPunch')}
                            </span>
                          </div>
                        )}
                        {day.flags.pendingCorrection && (
                          <div className="text-[10px] font-medium text-warning-700 dark:text-warning-300 truncate">
                            {t('attendance.myPage.pendingCorrectionBadge')}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base text-left text-[11px] font-semibold uppercase tracking-wider text-muted">
                  <th className="py-2 pr-3">{t('attendance.myPage.colDate')}</th>
                  <th className="py-2 pr-3">{t('attendance.myPage.colStatus')}</th>
                  <th className="py-2 pr-3">{t('attendance.myPage.colShift')}</th>
                  <th className="py-2 pr-3">{t('attendance.myPage.colIn')}</th>
                  <th className="py-2 pr-3">{t('attendance.myPage.colOut')}</th>
                  <th className="py-2 pr-3">{t('attendance.myPage.colWorked')}</th>
                  {canRequestCorrection && (
                    <th className="py-2 text-right">
                      {t('attendance.myPage.colActions')}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {[...history.days].reverse().map((day) => {
                  const isFuture = day.date > todayKey;
                  return (
                    <tr key={day.date} className="hover:bg-[rgb(var(--bg-hover))]">
                      <td className="py-2.5 pr-3 font-medium text-primary whitespace-nowrap">
                        {day.date}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge
                            tone={attendanceDayBadgeTone(day.status)}
                            dot
                            className="capitalize"
                          >
                            {statusLabel(day.status)}
                          </Badge>
                          {day.flags.missedPunch && (
                            <Badge tone="error">
                              {t('attendance.myPage.missedPunch')}
                            </Badge>
                          )}
                          {day.flags.pendingCorrection && (
                            <Badge tone="warning">
                              {t('attendance.myPage.pendingCorrectionBadge')}
                            </Badge>
                          )}
                          {day.flags.corrected && (
                            <Badge tone="info">
                              {t('attendance.myPage.correctedBadge')}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-secondary">
                        {day.shiftName ?? day.holidayName ?? day.leaveTypeName ?? emDash}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-primary whitespace-nowrap">
                        {day.clockInDisplay ?? emDash}
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-primary whitespace-nowrap">
                        {day.clockOutDisplay ?? emDash}
                      </td>
                      <td className="py-2.5 pr-3 text-secondary whitespace-nowrap">
                        {day.netMinutes !== null
                          ? formatAttendanceMinutes(day.netMinutes)
                          : emDash}
                      </td>
                      {canRequestCorrection && (
                        <td className="py-2.5 text-right whitespace-nowrap">
                          {!isFuture && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRequestCorrection(day)}
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                              {t('attendance.myPage.requestCorrection')}
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

