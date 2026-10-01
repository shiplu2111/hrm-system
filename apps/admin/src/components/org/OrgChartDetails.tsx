import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  Briefcase,
  CalendarDays,
  Crosshair,
  Mail,
  Phone,
  UserPlus,
  Users,
  UserX,
  X,
} from 'lucide-react';
import { usePermission } from '@hrm/portal-ui';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  daysSince,
  formatDate,
  initials,
  nodeLabel,
  tenure,
  type ChartIndex,
  type ChartTreeNode,
} from '@/lib/org-chart';

const STATUS_LABEL = {
  active: { label: 'Active', tone: 'success' },
  on_leave: { label: 'On leave', tone: 'warning' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  terminated: { label: 'Terminated', tone: 'error' },
} as const;

const PLACEMENT_NOTE = {
  requester: 'Shown under the manager who raised the requisition.',
  department: 'No active requester, so it is shown under the most senior person in its department.',
  unplaced: 'No requester or staffed department, so it is shown at the top level.',
} as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-2xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      {children}
    </section>
  );
}

function Field({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 text-muted">{icon}</span>
      <div className="min-w-0">
        <div className="text-2xs text-muted">{label}</div>
        <div className="text-primary break-words">{children}</div>
      </div>
    </div>
  );
}

function PersonLink({ entry, onSelect }: { entry: ChartTreeNode; onSelect: (id: string) => void }) {
  const { node } = entry;
  const label = nodeLabel(node);
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className="w-full flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-[rgb(var(--bg-hover))] transition-colors"
    >
      <span
        className={`h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-2xs font-semibold ${
          node.kind === 'employee'
            ? 'bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300'
            : node.kind === 'vacated'
              ? 'border border-dashed border-warning-500 text-warning-700'
              : 'border border-dashed border-accent-400 text-accent-700'
        }`}
      >
        {node.kind === 'employee' ? initials(label) : node.kind === 'vacated' ? <UserX className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${node.kind === 'employee' ? 'text-primary' : 'text-secondary italic'}`}>
          {label}
        </span>
        <span className="block truncate text-2xs text-muted">
          {node.kind === 'requisition'
            ? `${node.requisition?.openings} opening(s) · ${node.requisition?.referenceNumber}`
            : node.title ?? 'No designation'}
        </span>
      </span>
      {entry.teamSize > 0 ? <span className="text-2xs text-muted tabular-nums">{entry.teamSize}</span> : null}
    </button>
  );
}

export function OrgChartDetails({
  entry,
  index,
  onSelect,
  onFocusHere,
  onLocate,
  onOpenProfile,
  onOpenRecruitment,
  onClose,
}: {
  entry: ChartTreeNode;
  index: ChartIndex;
  onSelect: (id: string) => void;
  onFocusHere: (id: string) => void;
  onLocate: (id: string) => void;
  onOpenProfile: (employeeId: string) => void;
  onOpenRecruitment: () => void;
  onClose: () => void;
}) {
  const canViewEmployee = usePermission('employee', 'view');
  const canViewRecruitment = usePermission('recruitment', 'view');
  const canCreateRequisition = usePermission('recruitment', 'create');
  const { node } = entry;
  const parentId = index.parentOf.get(node.id) ?? null;
  const parent = parentId ? index.byId.get(parentId) : undefined;
  const people = entry.children.filter((c) => c.node.kind !== 'requisition');
  const openings = entry.children.filter((c) => c.node.kind === 'requisition');
  const label = nodeLabel(node);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-base px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          {node.kind === 'employee' ? (
            <div className="h-11 w-11 shrink-0 rounded-full bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300 flex items-center justify-center text-sm font-semibold">
              {initials(label)}
            </div>
          ) : (
            <div
              className={`h-11 w-11 shrink-0 rounded-full border border-dashed flex items-center justify-center ${
                node.kind === 'vacated' ? 'border-warning-500 text-warning-700' : 'border-accent-400 text-accent-700'
              }`}
            >
              {node.kind === 'vacated' ? <UserX className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-primary">{label}</h2>
            <p className="truncate text-sm text-secondary">
              {node.kind === 'requisition' ? node.requisition?.referenceNumber : node.title ?? 'No designation'}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {node.employee ? (
                <Badge tone={STATUS_LABEL[node.employee.status].tone} dot>
                  {STATUS_LABEL[node.employee.status].label}
                </Badge>
              ) : node.kind === 'vacated' ? (
                <Badge tone="warning" dot>Vacated seat</Badge>
              ) : (
                <Badge tone={node.requisition?.status === 'open' ? 'accent' : 'warning'} dot>
                  {node.requisition?.status === 'open' ? 'Hiring' : 'Pending approval'}
                </Badge>
              )}
              {node.jobLevel ? (
                <Badge tone="neutral" title={node.jobLevel.name}>
                  <span className="font-mono">{node.jobLevel.code}</span> {node.jobLevel.name}
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="rounded p-1 text-muted hover:bg-[rgb(var(--bg-hover))] hover:text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto scrollbar-thin px-4 py-4">
        {node.employee ? (
          <Section title="Details">
            <Field icon={<Briefcase className="h-4 w-4" />} label="Department">
              {node.departmentName ?? <span className="text-muted">Not assigned</span>}
            </Field>
            <Field icon={<CalendarDays className="h-4 w-4" />} label="Joined">
              {formatDate(node.employee.hireDate)}{' '}
              <span className="text-muted">({tenure(node.employee.hireDate)})</span>
            </Field>
            {node.employee.email ? (
              <Field icon={<Mail className="h-4 w-4" />} label="Email">
                <a href={`mailto:${node.employee.email}`} className="text-accent-700 dark:text-accent-300 hover:underline">
                  {node.employee.email}
                </a>
              </Field>
            ) : null}
            {node.employee.phone ? (
              <Field icon={<Phone className="h-4 w-4" />} label="Phone">
                <a href={`tel:${node.employee.phone}`} className="text-accent-700 dark:text-accent-300 hover:underline">
                  {node.employee.phone}
                </a>
              </Field>
            ) : null}
            <div className="text-2xs text-muted font-mono">{node.employee.employeeNumber}</div>
          </Section>
        ) : null}

        {node.vacated ? (
          <Section title="Vacancy">
            <div className="rounded-lg border border-warning-200 dark:border-warning-800/60 bg-warning-50 dark:bg-warning-950/30 p-3 text-sm text-warning-800 dark:text-warning-200">
              {people.length} {people.length === 1 ? 'person reports' : 'people report'} to this seat without an
              active manager.
              {node.vacated.since ? ` Vacant for ${daysSince(node.vacated.since)} days.` : ''}
            </div>
            <Field icon={<UserX className="h-4 w-4" />} label="Previously held by">
              {node.vacated.previousHolder.name}{' '}
              <span className="font-mono text-2xs text-muted">{node.vacated.previousHolder.employeeNumber}</span>
              {canViewEmployee ? (
                <button
                  type="button"
                  onClick={() => onOpenProfile(node.vacated!.previousHolder.id)}
                  className="ml-1.5 inline-flex items-center text-2xs text-accent-700 dark:text-accent-300 hover:underline"
                >
                  Profile <ArrowUpRight className="h-3 w-3" />
                </button>
              ) : null}
            </Field>
            <Field icon={<CalendarDays className="h-4 w-4" />} label="Exit">
              {node.vacated.previousHolder.exitType
                ? `${node.vacated.previousHolder.exitType === 'resignation' ? 'Resigned' : 'Terminated'} · ${formatDate(node.vacated.since)}`
                : 'No exit event recorded'}
            </Field>
            <Field icon={<Briefcase className="h-4 w-4" />} label="Department">
              {node.departmentName ?? <span className="text-muted">Not assigned</span>}
            </Field>
          </Section>
        ) : null}

        {node.requisition ? (
          <Section title="Requisition">
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-primary font-medium">
                  {node.requisition.filled} of {node.requisition.headcount} filled
                </span>
                <span className="text-secondary">{node.requisition.openings} open</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-[rgb(var(--bg-muted))] overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-600"
                  style={{ width: `${(node.requisition.filled / Math.max(1, node.requisition.headcount)) * 100}%` }}
                />
              </div>
            </div>
            <Field icon={<Users className="h-4 w-4" />} label="Candidates in pipeline">
              {node.requisition.activeCandidates}
            </Field>
            <Field icon={<Briefcase className="h-4 w-4" />} label="Department">
              {node.departmentName ?? <span className="text-muted">Not set</span>}
            </Field>
            <Field icon={<CalendarDays className="h-4 w-4" />} label="Opened">
              {node.requisition.openedAt
                ? `${formatDate(node.requisition.openedAt)} (${daysSince(node.requisition.openedAt)} days ago)`
                : 'Not opened yet'}
            </Field>
            <p className="text-2xs text-muted">{PLACEMENT_NOTE[node.requisition.placement]}</p>
          </Section>
        ) : null}

        <Section title="Reports to">
          {parent ? (
            <PersonLink entry={parent} onSelect={onSelect} />
          ) : (
            <p className="text-sm text-muted">
              {node.kind === 'employee' ? 'No manager assigned (top level)' : 'Top level'}
            </p>
          )}
        </Section>

        {people.length > 0 ? (
          <Section title={`Direct reports (${people.length})`}>
            <div className="-mx-2 space-y-0.5">
              {people.map((child) => (
                <PersonLink key={child.node.id} entry={child} onSelect={onSelect} />
              ))}
            </div>
            {entry.teamSize > people.length ? (
              <p className="text-2xs text-muted">{entry.teamSize} people in this reporting line in total.</p>
            ) : null}
          </Section>
        ) : null}

        {openings.length > 0 ? (
          <Section title={`Open requisitions (${openings.length})`}>
            <div className="-mx-2 space-y-0.5">
              {openings.map((child) => (
                <PersonLink key={child.node.id} entry={child} onSelect={onSelect} />
              ))}
            </div>
          </Section>
        ) : null}

        {entry.vacanciesBelow > 0 && node.kind !== 'requisition' ? (
          <p className="text-xs text-warning-700 dark:text-warning-400">
            {entry.vacanciesBelow} vacant position{entry.vacanciesBelow === 1 ? '' : 's'} in this reporting line.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-base px-4 py-3">
        {node.employee && canViewEmployee ? (
          <Button variant="primary" size="sm" onClick={() => onOpenProfile(node.employee!.id)}>
            View profile <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {node.kind === 'vacated' && canCreateRequisition ? (
          <Button variant="primary" size="sm" onClick={onOpenRecruitment}>
            <UserPlus className="h-3.5 w-3.5" /> Raise requisition
          </Button>
        ) : null}
        {node.kind === 'requisition' && canViewRecruitment ? (
          <Button variant="primary" size="sm" onClick={onOpenRecruitment}>
            Open in Recruitment <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        {entry.children.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={() => onFocusHere(node.id)}>
            <Users className="h-3.5 w-3.5" /> View this team only
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => onLocate(node.id)}>
          <Crosshair className="h-3.5 w-3.5" /> Centre
        </Button>
      </div>
    </div>
  );
}
