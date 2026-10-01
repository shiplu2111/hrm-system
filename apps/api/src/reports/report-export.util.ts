import type { ReportColumn, ReportExportFormat } from '@hrm/shared-types';
import * as XLSX from 'xlsx';

type ReportCell = string | number | null | undefined;

const DECIMAL_STRING = /^-?\d+\.\d+$/;

export function serializeReportCsv(
  columns: ReportColumn[],
  rows: Array<Record<string, string | number | null>>,
): string {
  const lines = [
    columns.map((col) => escapeCsv(col.label)).join(','),
    ...rows.map((row) => columns.map((col) => escapeCsv(row[col.key])).join(',')),
  ];
  // BOM so Excel opens the file as UTF-8 instead of the system code page.
  return `\uFEFF${lines.join('\r\n')}`;
}

export function serializeReportXlsx(
  columns: ReportColumn[],
  rows: Array<Record<string, string | number | null>>,
  sheetName: string,
): Buffer {
  const data = [
    columns.map((col) => col.label),
    ...rows.map((row) => columns.map((col) => toSheetCell(row[col.key]))),
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

/** Amounts arrive as fixed-point strings; store them as numbers so they can be summed. */
function toSheetCell(value: ReportCell): string | number {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  return DECIMAL_STRING.test(value) ? Number(value) : value;
}

export function escapeCsv(value: ReportCell): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  // Spreadsheet apps execute cells starting with these characters as formulas.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text) && !/^-\d+(\.\d+)?$/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
