export type ReportCategory = 'payroll' | 'attendance' | 'hr';

export type ReportExportFormat = 'csv' | 'xlsx';

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportDefinition {
  id: string;
  category: ReportCategory;
  title: string;
  description: string;
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
