import type { ReportCategory } from '@hrm/shared-types';

/**
 * User-facing strings for the reports screens.
 * Kept in one catalogue so they can move into the i18n layer without touching components.
 */
export const reportsCopy = {
  eyebrow: 'Reports',
  title: 'Reports',
  description: 'Run payroll, attendance and HR reports for a date range, then export them to CSV or Excel.',
  hubNav: {
    label: 'Reports sections',
    reports: 'Reports',
    scheduled: 'Scheduled deliveries',
    import: 'Data import',
    export: 'Export templates',
  },
  categories: {
    payroll: 'Payroll',
    attendance: 'Attendance',
    hr: 'HR',
  } satisfies Record<ReportCategory, string>,
  categoryTabs: 'Report categories',
  reportList: (category: string) => `${category} reports`,
  catalogError: 'Could not load the report list.',
  noAccessTitle: 'No reports available',
  noAccessDescription: 'Your role doesn’t include access to company reports. Ask an administrator if you need them.',
  runError: 'Could not run this report.',
  exportError: 'Could not export this report.',
  retry: 'Try again',
  refresh: 'Refresh',
  exportCsv: 'Export CSV',
  exportExcel: 'Export Excel',
  exporting: 'Exporting…',
  exportScopeHint: 'Exports include every row for the selected period, not only the rows matching your search.',
  period: {
    label: 'Period',
    from: 'From',
    to: 'To',
    custom: 'Custom range',
    invalidRange: 'The start date must be on or before the end date.',
    invalidDate: 'Enter a complete date.',
    snapshot: 'Shows the current state — no date range applies.',
    upcomingHint: 'Lists dates that fall inside this window.',
    presets: {
      thisMonth: 'This month',
      lastMonth: 'Last month',
      thisQuarter: 'This quarter',
      lastQuarter: 'Last quarter',
      yearToDate: 'Year to date',
      lastYear: 'Last year',
      next30: 'Next 30 days',
      next90: 'Next 90 days',
      next12Months: 'Next 12 months',
    },
  },
  searchPlaceholder: 'Filter rows…',
  searchLabel: 'Filter report rows',
  rowCount: (shown: number, total: number) =>
    shown === total ? `${total.toLocaleString()} ${total === 1 ? 'row' : 'rows'}` : `${shown.toLocaleString()} of ${total.toLocaleString()} rows`,
  generatedAt: (time: string) => `Generated ${time}`,
  totals: 'Total',
  summaryLabels: {
    totalNetPay: 'Total net pay',
    totalHeadcount: 'Total headcount',
  } as Record<string, string>,
  empty: {
    title: 'No records for this period',
    historical: 'Nothing was recorded between these dates.',
    upcoming: 'Nothing falls due inside this window.',
    snapshot: 'There is no data for this report yet.',
    widenHistorical: 'Show year to date',
    widenUpcoming: 'Look 12 months ahead',
  },
  noMatchTitle: 'No rows match your filter',
  noMatchDescription: 'Try a different search term.',
  clearFilter: 'Clear filter',
  none: '—',
} as const;
