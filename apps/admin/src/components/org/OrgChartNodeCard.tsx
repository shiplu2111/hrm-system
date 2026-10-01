import { ChevronDown, ChevronUp, UserPlus, UserX } from 'lucide-react';
import type { OrgChartNode } from '@hrm/shared-types';
import { daysSince, initials, nodeLabel, type ChartTreeNode } from '@/lib/org-chart';

const STATUS_CHIP: Partial<Record<string, { label: string; className: string }>> = {
  on_leave: {
    label: 'On leave',
    className: 'bg-warning-50 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300',
  },
  inactive: {
    label: 'Inactive',
    className: 'bg-[rgb(var(--bg-muted))] text-secondary',
  },
};

function cardClasses(node: OrgChartNode, selected: boolean, dimmed: boolean): string {
  const base =
    'relative w-56 rounded-lg border text-left p-3 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600';
  const kind =
    node.kind === 'employee'
      ? 'surface border-base shadow-card hover:shadow-card-hover'
      : node.kind === 'vacated'
        ? 'border-dashed border-warning-400 dark:border-warning-700 bg-warning-50/60 dark:bg-warning-950/20 hover:bg-warning-50'
        : 'border-dashed border-accent-300 dark:border-accent-700 bg-accent-50/50 dark:bg-accent-950/20 hover:bg-accent-50';
  const state = selected ? 'ring-2 ring-accent-600 shadow-card-hover' : '';
  return `${base} ${kind} ${state} ${dimmed ? 'opacity-35' : ''}`;
}

export function OrgChartNodeCard({
  entry,
  selected,
  highlighted,
  dimmed,
  collapsed,
  onSelect,
  onToggle,
}: {
  entry: ChartTreeNode;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const { node } = entry;
  const label = nodeLabel(node);
  const status = node.employee ? STATUS_CHIP[node.employee.status] : undefined;
  const hasChildren = entry.children.length > 0;

  return (
    <div className="relative flex flex-col items-center" data-node-id={node.id}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${label}${node.title ? `, ${node.title}` : ''}`}
        className={`${cardClasses(node, selected, dimmed)} ${highlighted ? 'animate-pulse' : ''}`}
      >
        <div className="flex items-start gap-2.5">
          {node.kind === 'employee' ? (
            <div className="h-9 w-9 rounded-full bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300 flex items-center justify-center text-xs font-semibold shrink-0">
              {initials(label)}
            </div>
          ) : (
            <div
              className={`h-9 w-9 rounded-full border border-dashed flex items-center justify-center shrink-0 ${
                node.kind === 'vacated'
                  ? 'border-warning-500 text-warning-700 dark:text-warning-400'
                  : 'border-accent-400 text-accent-700 dark:text-accent-300'
              }`}
            >
              {node.kind === 'vacated' ? <UserX className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div
              className={`text-sm font-semibold truncate ${
                node.kind === 'employee' ? 'text-primary' : 'text-secondary'
              }`}
              title={label}
            >
              {label}
            </div>
            <div className="text-xs text-secondary truncate" title={node.title ?? undefined}>
              {node.kind === 'requisition'
                ? node.departmentName ?? 'No department'
                : node.title ?? <span className="italic text-muted">No designation</span>}
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5 flex-wrap min-h-[20px]">
          {node.kind === 'employee' ? (
            <>
              {node.departmentName ? (
                <span className="max-w-[9rem] truncate rounded-sm bg-[rgb(var(--bg-muted))] px-1.5 py-0.5 text-2xs text-secondary">
                  {node.departmentName}
                </span>
              ) : null}
              {node.jobLevel ? (
                <span className="rounded-sm border border-base px-1.5 py-0.5 font-mono text-2xs text-secondary" title={node.jobLevel.name}>
                  {node.jobLevel.code}
                </span>
              ) : null}
              {status ? (
                <span className={`rounded-sm px-1.5 py-0.5 text-2xs font-medium ${status.className}`}>
                  {status.label}
                </span>
              ) : null}
            </>
          ) : node.kind === 'vacated' ? (
            <>
              <span className="rounded-sm bg-warning-100 dark:bg-warning-900/40 px-1.5 py-0.5 text-2xs font-medium text-warning-800 dark:text-warning-300">
                Vacated
              </span>
              <span className="text-2xs text-muted truncate">
                was {node.vacated?.previousHolder.name}
              </span>
            </>
          ) : (
            <>
              <span
                className={`rounded-sm px-1.5 py-0.5 text-2xs font-medium ${
                  node.requisition?.status === 'open'
                    ? 'bg-accent-100 text-accent-800 dark:bg-accent-900/50 dark:text-accent-200'
                    : 'bg-warning-100 text-warning-800 dark:bg-warning-900/40 dark:text-warning-300'
                }`}
              >
                {node.requisition?.status === 'open' ? 'Hiring' : 'Pending approval'}
              </span>
              <span className="text-2xs text-secondary">
                {node.requisition?.openings} opening{node.requisition?.openings === 1 ? '' : 's'}
              </span>
              {node.requisition?.activeCandidates ? (
                <span className="text-2xs text-muted">· {node.requisition.activeCandidates} in pipeline</span>
              ) : null}
            </>
          )}
        </div>

        {node.kind === 'vacated' && node.vacated?.since ? (
          <div className="mt-1 text-2xs text-warning-700 dark:text-warning-400">
            Open {daysSince(node.vacated.since)} days
          </div>
        ) : null}
      </button>

      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${entry.children.length} reports of ${label}`}
          className={`relative z-10 -mt-2.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium shadow-sm transition-colors ${
            dimmed ? 'opacity-35' : ''
          } ${
            collapsed
              ? 'bg-accent-600 border-accent-600 text-white hover:bg-accent-700'
              : 'surface border-base text-secondary hover:text-primary'
          }`}
        >
          {entry.children.length}
          {collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
          {collapsed && entry.vacanciesBelow > 0 ? (
            <span className="ml-0.5 rounded-full bg-warning-400 text-warning-950 px-1 leading-4">
              {entry.vacanciesBelow} open
            </span>
          ) : null}
        </button>
      ) : null}
    </div>
  );
}
