import { useMemo, useState } from 'react';
import { CheckCircle2, Crosshair } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  DataTable,
  DataTableBody,
  DataTableHead,
  SortableHeader,
  type SortDirection,
} from '@/components/ui/DataTable';
import { daysSince, nodeLabel, vacancyWeight, type ChartIndex, type ChartTreeNode } from '@/lib/org-chart';

type VacancyFilter = 'all' | 'vacated' | 'open' | 'pending_approval';
type SortKey = 'position' | 'department' | 'openings' | 'age';

function vacancyAge(entry: ChartTreeNode): number | null {
  const { node } = entry;
  return daysSince(node.vacated?.since ?? node.requisition?.openedAt ?? null);
}

function matchesFilter(entry: ChartTreeNode, filter: VacancyFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'vacated') return entry.node.kind === 'vacated';
  return entry.node.requisition?.status === filter;
}

export function OrgVacancyList({
  index,
  onLocate,
}: {
  index: ChartIndex;
  onLocate: (id: string) => void;
}) {
  const [filter, setFilter] = useState<VacancyFilter>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDirection }>({ key: 'age', dir: 'desc' });

  const all = useMemo(
    () => [...index.byId.values()].filter((e) => e.node.kind !== 'employee'),
    [index],
  );

  const counts = useMemo(
    () => ({
      all: all.length,
      vacated: all.filter((e) => matchesFilter(e, 'vacated')).length,
      open: all.filter((e) => matchesFilter(e, 'open')).length,
      pending_approval: all.filter((e) => matchesFilter(e, 'pending_approval')).length,
    }),
    [all],
  );

  const rows = useMemo(() => {
    const factor = sort.dir === 'asc' ? 1 : -1;
    return all
      .filter((e) => matchesFilter(e, filter))
      .sort((a, b) => {
        let cmp: number;
        if (sort.key === 'openings') cmp = vacancyWeight(a.node) - vacancyWeight(b.node);
        else if (sort.key === 'age') cmp = (vacancyAge(a) ?? -1) - (vacancyAge(b) ?? -1);
        else if (sort.key === 'department')
          cmp = (a.node.departmentName ?? '').localeCompare(b.node.departmentName ?? '');
        else cmp = (a.node.title ?? '').localeCompare(b.node.title ?? '');
        return cmp * factor || (a.node.title ?? '').localeCompare(b.node.title ?? '');
      });
  }, [all, filter, sort]);

  const toggleSort = (key: SortKey) =>
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }));

  if (all.length === 0) {
    return (
      <EmptyState
        compact
        icon={CheckCircle2}
        title="No vacant positions"
        description="Every manager seat is filled and there are no open or pending requisitions."
      />
    );
  }

  const chips: Array<{ key: VacancyFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'vacated', label: 'Vacated seats' },
    { key: 'open', label: 'Hiring' },
    { key: 'pending_approval', label: 'Pending approval' },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2 px-5 py-3 border-b border-base" role="radiogroup" aria-label="Vacancy type">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            role="radio"
            aria-checked={filter === chip.key}
            onClick={() => setFilter(chip.key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              filter === chip.key
                ? 'border-accent-600 bg-accent-600 text-white'
                : 'border-base text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            {chip.label} <span className="tabular-nums opacity-80">{counts[chip.key]}</span>
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No vacancies of this type.</p>
      ) : (
        <DataTable>
          <DataTableHead>
            <tr>
              <th className="text-left px-5 py-2.5">
                <SortableHeader label="Position" active={sort.key === 'position'} direction={sort.dir} onSort={() => toggleSort('position')} />
              </th>
              <th className="text-left px-5 py-2.5">Type</th>
              <th className="text-left px-5 py-2.5 hidden md:table-cell">
                <SortableHeader label="Department" active={sort.key === 'department'} direction={sort.dir} onSort={() => toggleSort('department')} />
              </th>
              <th className="text-left px-5 py-2.5 hidden lg:table-cell">Reports to</th>
              <th className="text-right px-5 py-2.5">
                <SortableHeader label="Seats" active={sort.key === 'openings'} direction={sort.dir} onSort={() => toggleSort('openings')} />
              </th>
              <th className="text-right px-5 py-2.5">
                <SortableHeader label="Open for" active={sort.key === 'age'} direction={sort.dir} onSort={() => toggleSort('age')} />
              </th>
              <th className="w-24" />
            </tr>
          </DataTableHead>
          <DataTableBody>
            {rows.map((entry) => {
              const { node } = entry;
              const parentId = index.parentOf.get(node.id);
              const parent = parentId ? index.byId.get(parentId) : undefined;
              const age = vacancyAge(entry);
              return (
                <tr key={node.id} className="hover:bg-[rgb(var(--bg-hover))]">
                  <td className="px-5 py-3">
                    <div className="font-medium text-primary">{node.title ?? 'Untitled position'}</div>
                    <div className="text-2xs text-muted">
                      {node.kind === 'vacated'
                        ? `Previously ${node.vacated?.previousHolder.name} · ${entry.children.length} awaiting a manager`
                        : `${node.requisition?.referenceNumber} · ${node.requisition?.activeCandidates ?? 0} in pipeline`}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {node.kind === 'vacated' ? (
                      <Badge tone="warning">Vacated</Badge>
                    ) : node.requisition?.status === 'open' ? (
                      <Badge tone="accent">Hiring</Badge>
                    ) : (
                      <Badge tone="warning">Pending approval</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-secondary hidden md:table-cell">{node.departmentName ?? '—'}</td>
                  <td className="px-5 py-3 text-secondary hidden lg:table-cell">
                    {parent ? nodeLabel(parent.node) : <span className="text-muted">Top level</span>}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-primary">{vacancyWeight(node)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-secondary">
                    {age === null ? '—' : `${age} d`}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onLocate(node.id)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-accent-700 dark:text-accent-300 hover:bg-[rgb(var(--bg-hover))]"
                    >
                      <Crosshair className="h-3.5 w-3.5" /> Locate
                    </button>
                  </td>
                </tr>
              );
            })}
          </DataTableBody>
        </DataTable>
      )}
    </div>
  );
}
