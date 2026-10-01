export type ReportCategory = 'payroll' | 'attendance' | 'hr';

export type ReportExportFormat = 'csv' | 'xlsx';

export interface ReportColumn {
  key: string;
  label: string;
}

/**
 * How a report uses the from/to range: `historical` filters past activity, `upcoming`
 * looks for dates falling inside a future window, `snapshot` ignores it (current state).
 */
export type ReportPeriodMode = 'historical' | 'upcoming' | 'snapshot';

export interface ReportDefinition {
  id: string;
  category: ReportCategory;
  title: string;
  description: string;
  periodMode: ReportPeriodMode;
}

export interface ReportPeriod {
  from: string;
  to: string;
}

export interface ReportResult {
  reportId: string;
  title: string;
  category: ReportCategory;
  generatedAt: string;
  period: ReportPeriod;
  columns: ReportColumn[];
  rows: Array<Record<string, string | number | null>>;
  summary?: Record<string, string | number>;
  rowCount: number;
}

export interface ReportCatalogView {
  reports: ReportDefinition[];
}
