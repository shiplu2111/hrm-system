import { DataTable, DataTableBody, DataTableHead, SortableHeader, type SortDirection } from '@/components/ui/DataTable';
import { StatusPill } from '@/components/ui/StatusPill';
import { reportsCopy as copy } from '@/lib/reports-copy';
import { formatCell, isEmptyCell, statusTone, type AnalyzedColumn, type ReportRow } from '@/lib/report-table';

interface Props {
  columns: AnalyzedColumn[];
  rows: ReportRow[];
  sort: { key: string; dir: SortDirection } | null;
  onSort: (key: string) => void;
  /** Formatted totals keyed by column; omitted when no column can be summed. */
  totals: Record<string, string> | null;
}

const alignClass = (column: AnalyzedColumn) => (column.kind === 'number' ? 'text-right' : 'text-left');

export function ReportResultTable({ columns, rows, sort, onSort, totals }: Props) {
  const totalsLabelKey = totals ? columns.find((column) => column.kind !== 'number')?.key : undefined;

  return (
    <DataTable className="max-h-[65vh] overflow-y-auto">
      <DataTableHead>
        <tr>
          {columns.map((column) => (
            <th
              key={column.key}
              scope="col"
              aria-sort={sort?.key === column.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
              className={`px-4 py-3 whitespace-nowrap ${alignClass(column)}`}
            >
              <SortableHeader
                label={column.label}
                active={sort?.key === column.key}
                direction={sort?.key === column.key ? sort.dir : 'asc'}
                onSort={() => onSort(column.key)}
              />
            </th>
          ))}
        </tr>
      </DataTableHead>
      <DataTableBody>
        {rows.map((row, index) => (
          <tr key={index} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
            {columns.map((column) => {
              const value = row[column.key];
              return (
                <td
                  key={column.key}
                  className={`px-4 py-2.5 whitespace-nowrap ${alignClass(column)} ${
                    column.kind === 'number' ? 'tabular-nums text-primary' : 'text-primary'
                  }`}
                >
                  {isEmptyCell(value) ? (
                    <span className="text-muted">{copy.none}</span>
                  ) : column.kind === 'status' ? (
                    <StatusPill tone={statusTone(value)}>{formatCell(column, value)}</StatusPill>
                  ) : (
                    formatCell(column, value)
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </DataTableBody>
      {totals ? (
        <tfoot className="sticky bottom-0 bg-[rgb(var(--bg-muted))] shadow-[0_-1px_0_rgb(var(--border-base))]">
          <tr>
            {columns.map((column) => (
              <td
                key={column.key}
                className={`px-4 py-2.5 whitespace-nowrap font-semibold text-primary ${alignClass(column)} ${
                  column.kind === 'number' ? 'tabular-nums' : ''
                }`}
              >
                {column.key === totalsLabelKey ? copy.totals : (totals[column.key] ?? '')}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </DataTable>
  );
}
