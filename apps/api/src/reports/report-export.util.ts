import type { ReportColumn, ReportExportFormat } from '@hrm/shared-types';
import * as XLSX from 'xlsx';

export function serializeReportCsv(
  columns: ReportColumn[],
  rows: Array<Record<string, string | number | null>>,
): string {
  const header = columns.map((col) => escapeCsv(col.label)).join(',');
  const body = rows
    .map((row) =>
      columns
        .map((col) => escapeCsv(formatCell(row[col.key])))
        .join(','),
    )
    .join('\n');
  return `${header}\n${body}`;
}

export function serializeReportXlsx(
  columns: ReportColumn[],
  rows: Array<Record<string, string | number | null>>,
  sheetName: string,
): Buffer {
  const data = [
    columns.map((col) => col.label),
    ...rows.map((row) => columns.map((col) => formatCell(row[col.key]))),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function contentTypeForFormat(format: ReportExportFormat): string {
  return format === 'xlsx'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'text/csv; charset=utf-8';
}

export function fileExtensionForFormat(format: ReportExportFormat): string {
  return format === 'xlsx' ? 'xlsx' : 'csv';
}

function formatCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
