import { useCallback, useEffect, useMemo, useState } from 'react';
import { Send, Timer } from 'lucide-react';
import type {
  TimesheetEntryRecord,
  TimesheetEntryStatus,
  TimesheetProjectRecord,
  WorkflowApprovalRoute,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { usePermissions } from '@hrm/portal-ui';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { MyTimesheetEntryForm } from '@/components/my/timesheet/MyTimesheetEntryForm';
import { useMyEmployee } from '@/components/my/useMyEmployee';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Form';
import {
  createTimesheetEntry,
  getTimesheetApprovalRoute,
  listTimesheetEntries,
  listTimesheetProjects,
  submitTimesheetEntry,
  type CreateTimesheetEntryInput,
} from '@/lib/timesheets-api';
import {
  currentStepLabel,
  formatEntryDate,
  formatHours,
  formatTimeRange,
  latestDecisionComment,
  presetRange,
  timesheetStatusTone,
} from '@/lib/timesheet-display';
import { ApiError } from '@/lib/tenant-api-client';

type PeriodKey = 'this_week' | 'last_week' | 'this_month' | 'last_month';
type StatusFilter = 'all' | 'pending_approval' | 'approved' | 'rejected' | 'draft';

const STATUS_TABS: StatusFilter[] = [
  'all',
  'pending_approval',
  'approved',
  'rejected',
  'draft',
];

export function MyTimesheetsPage() {
  const { t } = useAppTranslation();
  const { can } = usePermissions();
  const {
    employeeId,
    companyId,
    loading: profileLoading,
    error: profileError,
  } = useMyEmployee();

  const canCreate = can('attendance', 'create');

  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [projects, setProjects] = useState<TimesheetProjectRecord[]>([]);
  const [entries, setEntries] = useState<TimesheetEntryRecord[]>([]);
  const [approvalRoute, setApprovalRoute] = useState<WorkflowApprovalRoute | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!employeeId || !companyId) {
      if (!profileLoading) setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const range = presetRange(period);
      const statusParam: TimesheetEntryStatus | undefined =
        statusFilter === 'all' ? undefined : statusFilter;
      const [projectRows, entryRows, routeData] = await Promise.all([
        listTimesheetProjects(companyId),
        listTimesheetEntries(companyId, {
          employeeId,
          fromDate: range.from,
          toDate: range.to,
          status: statusParam,
        }),
        getTimesheetApprovalRoute(companyId),
      ]);
      setProjects(projectRows);
      setEntries(entryRows);
      setApprovalRoute(routeData);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('errors.loadEmployeeData'),
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, employeeId, period, profileLoading, statusFilter, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (input: CreateTimesheetEntryInput) => {
    if (!companyId) return;
    await createTimesheetEntry(companyId, input);
    setNotice(
      input.submit
        ? t('timesheet.entrySubmitted')
        : t('timesheet.entrySavedDraft'),
    );
    await load();
  };

  const handleSubmitDraft = async (entryId: string) => {
    setSubmittingId(entryId);
    setError(null);
    try {
      await submitTimesheetEntry(entryId);
      setNotice(t('timesheet.entrySubmitted'));
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('common.unknownError'),
      );
    } finally {
      setSubmittingId(null);
    }
  };

  const summary = useMemo(() => {
    let total = 0;
    let billable = 0;
    let pending = 0;
    let approved = 0;
    for (const item of entries) {
      total += item.totalHours;
      billable += item.billableHours;
      if (item.status === 'pending_approval') pending += 1;
      if (item.status === 'approved') approved += item.totalHours;
    }
    return { total, billable, pending, approved };
  }, [entries]);

  const shownError = profileError ?? error;

  return (
    <MyPageLayout
      title={t('timesheet.title')}
      subtitle={t('timesheet.subtitle')}
      loading={loading || profileLoading}
      error={shownError}
      onRetry={() => void load()}
    >
      {notice ? (
        <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-2.5 text-sm text-success-700 dark:border-success-800 dark:bg-success-950/30 dark:text-success-300">
          {notice}
        </div>
      ) : null}

      {employeeId && companyId ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardBody className="py-3">
                <div className="text-xs text-muted">{t('timesheet.summaryTotal')}</div>
                <div className="text-xl font-bold text-primary mt-0.5">
                  {formatHours(summary.total)}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="py-3">
                <div className="text-xs text-muted">{t('timesheet.summaryBillable')}</div>
                <div className="text-xl font-bold text-accent-600 mt-0.5">
                  {formatHours(summary.billable)}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="py-3">
                <div className="text-xs text-muted">{t('timesheet.summaryPending')}</div>
                <div className="text-xl font-bold text-warning-600 mt-0.5">
                  {summary.pending}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="py-3">
                <div className="text-xs text-muted">{t('timesheet.summaryApproved')}</div>
                <div className="text-xl font-bold text-success-600 mt-0.5">
                  {formatHours(summary.approved)}
                </div>
              </CardBody>
            </Card>
          </div>

          {canCreate && (
            <MyTimesheetEntryForm
              employeeId={employeeId}
              projects={projects}
              approvalRoute={approvalRoute}
              onCreate={handleCreate}
            />
          )}

          <Card>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-accent-600" />
                {t('timesheet.historyTitle')}
              </CardTitle>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as PeriodKey)}
                  className="w-auto min-w-[140px]"
                >
                  {(['this_week', 'last_week', 'this_month', 'last_month'] as const).map(
                    (key) => (
                      <option key={key} value={key}>
                        {t(`timesheet.period.${key}`)}
                      </option>
                    ),
                  )}
                </Select>
              </div>
            </CardHeader>

            <CardBody className="space-y-4">
              <div className="flex flex-wrap gap-1.5">
                {STATUS_TABS.map((tab) => {
                  const active = statusFilter === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatusFilter(tab)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-accent-50 text-accent-700 border-accent-200 dark:bg-accent-950/50 dark:text-accent-300 dark:border-accent-800'
                          : 'surface text-secondary border-base hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
                      }`}
                    >
                      {t(`timesheet.status.${tab}`)}
                    </button>
                  );
                })}
              </div>

              {entries.length === 0 ? (
                <EmptyState
                  compact
                  icon={Timer}
                  title={t('timesheet.historyTitle')}
                  description={t('timesheet.emptyHistory')}
                />
              ) : (
                <div className="divide-y divide-[rgb(var(--border-base))]">
                  {entries.map((entry) => {
                    const stepText = currentStepLabel(entry);
                    const rejectionText =
                      entry.status === 'rejected'
                        ? latestDecisionComment(entry)
                        : null;
                    return (
                      <div
                        key={entry.id}
                        className="py-3 first:pt-0 last:pb-0 flex flex-wrap items-start justify-between gap-3 text-sm"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-primary">
                              {entry.taskName}
                            </span>
                            <Badge tone={timesheetStatusTone(entry)} dot>
                              {t(`timesheet.status.${entry.status}`, {
                                defaultValue: entry.displayStatus,
                              })}
                            </Badge>
                            <Badge tone={entry.isBillable ? 'accent' : 'neutral'}>
                              {entry.isBillable
                                ? t('timesheet.billableBadge')
                                : t('timesheet.nonBillableBadge')}
                            </Badge>
                          </div>

                          <div className="text-xs text-secondary flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>{formatEntryDate(entry.entryDate)}</span>
                            {entry.projectName ? (
                              <span className="font-medium text-primary">
                                {entry.projectName}
                              </span>
                            ) : null}
                            <span className="font-mono">
                              {formatTimeRange(entry)}
                            </span>
                            <span>
                              {formatHours(entry.totalHours)}
                              {entry.breakMinutes > 0
                                ? ` (-${entry.breakMinutes}m)`
                                : ''}
                            </span>
                          </div>

                          {entry.notes ? (
                            <p className="text-xs text-muted">{entry.notes}</p>
                          ) : null}

                          {stepText ? (
                            <p className="text-xs text-warning-700 dark:text-warning-300">
                              {stepText}
                            </p>
                          ) : null}

                          {rejectionText ? (
                            <p className="text-xs text-error-600 dark:text-error-400">
                              {t('timesheet.rejectionNote', {
                                comment: rejectionText,
                              })}
                            </p>
                          ) : null}
                        </div>

                        {canCreate && entry.status === 'draft' && (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={submittingId === entry.id}
                            onClick={() => void handleSubmitDraft(entry.id)}
                          >
                            <Send className="h-3.5 w-3.5" />
                            {submittingId === entry.id
                              ? t('common.submitting')
                              : t('timesheet.submitAction')}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </MyPageLayout>
  );
}

