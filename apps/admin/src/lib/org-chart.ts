import type { OrgChartNode } from '@hrm/shared-types';

export interface ChartTreeNode {
  node: OrgChartNode;
  children: ChartTreeNode[];
  depth: number;
  /** People (filled + vacated seats) anywhere below this node. */
  teamSize: number;
  /** Vacated seats and requisition openings anywhere below this node. */
  vacanciesBelow: number;
}

export interface ChartIndex {
  roots: ChartTreeNode[];
  byId: Map<string, ChartTreeNode>;
  parentOf: Map<string, string | null>;
}

const KIND_ORDER: Record<OrgChartNode['kind'], number> = { employee: 0, vacated: 1, requisition: 2 };

export function nodeLabel(node: OrgChartNode): string {
  if (node.employee) return `${node.employee.firstName} ${node.employee.lastName}`.trim();
  if (node.kind === 'vacated') return 'Vacant seat';
  return node.title ?? 'Open position';
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function vacancyWeight(node: OrgChartNode): number {
  if (node.kind === 'vacated') return 1;
  if (node.kind === 'requisition') return node.requisition?.openings ?? 0;
  return 0;
}

export function isVacancy(node: OrgChartNode): boolean {
  return node.kind !== 'employee';
}

/** Filled seats first (by name), then vacated seats, then openings. */
function compareNodes(a: ChartTreeNode, b: ChartTreeNode): number {
  return (
    KIND_ORDER[a.node.kind] - KIND_ORDER[b.node.kind] ||
    nodeLabel(a.node).localeCompare(nodeLabel(b.node), undefined, { sensitivity: 'base' })
  );
}

export function indexChart(nodes: OrgChartNode[]): ChartIndex {
  const byId = new Map<string, ChartTreeNode>();
  const parentOf = new Map<string, string | null>();
  for (const node of nodes) {
    byId.set(node.id, { node, children: [], depth: 0, teamSize: 0, vacanciesBelow: 0 });
  }
  const roots: ChartTreeNode[] = [];
  for (const entry of byId.values()) {
    const parent = entry.node.parentId ? byId.get(entry.node.parentId) : undefined;
    parentOf.set(entry.node.id, parent ? parent.node.id : null);
    if (parent) parent.children.push(entry);
    else roots.push(entry);
  }

  const finalize = (entry: ChartTreeNode, depth: number) => {
    entry.depth = depth;
    entry.children.sort(compareNodes);
    let teamSize = 0;
    let vacancies = 0;
    for (const child of entry.children) {
      finalize(child, depth + 1);
      teamSize += child.teamSize + (child.node.kind === 'requisition' ? 0 : 1);
      vacancies += child.vacanciesBelow + vacancyWeight(child.node);
    }
    entry.teamSize = teamSize;
    entry.vacanciesBelow = vacancies;
  };
  for (const root of roots) finalize(root, 0);
  roots.sort((a, b) => b.teamSize - a.teamSize || compareNodes(a, b));

  return { roots, byId, parentOf };
}

export function ancestorIds(index: ChartIndex, id: string): string[] {
  const out: string[] = [];
  let cur = index.parentOf.get(id) ?? null;
  while (cur) {
    out.unshift(cur);
    cur = index.parentOf.get(cur) ?? null;
  }
  return out;
}

/** Nodes with children below `levels` are collapsed, so the chart opens `levels` deep. */
export function collapsedBeyond(index: ChartIndex, levels: number): Set<string> {
  const collapsed = new Set<string>();
  for (const entry of index.byId.values()) {
    if (entry.children.length > 0 && entry.depth >= levels - 1) collapsed.add(entry.node.id);
  }
  return collapsed;
}

export interface ChartSearchHit {
  node: OrgChartNode;
  score: number;
}

export function searchChart(index: ChartIndex, query: string, limit = 8): ChartSearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: ChartSearchHit[] = [];
  for (const { node } of index.byId.values()) {
    const name = nodeLabel(node).toLowerCase();
    const fields = [
      name,
      node.employee?.employeeNumber.toLowerCase() ?? '',
      node.vacated?.previousHolder.name.toLowerCase() ?? '',
      node.requisition?.referenceNumber.toLowerCase() ?? '',
      node.title?.toLowerCase() ?? '',
      node.departmentName?.toLowerCase() ?? '',
    ];
    let score = 0;
    if (name.startsWith(q)) score = 4;
    else if (fields[1] === q || fields[3] === q) score = 4;
    else if (name.includes(q) || fields[2].includes(q)) score = 3;
    else if (fields[4].includes(q)) score = 2;
    else if (fields.some((f) => f.includes(q))) score = 1;
    if (score) hits.push({ node, score });
  }
  return hits
    .sort((a, b) => b.score - a.score || nodeLabel(a.node).localeCompare(nodeLabel(b.node)))
    .slice(0, limit);
}

/** Department ids including every sub-department of `departmentId`. */
export function departmentScope(
  departmentId: string,
  departments: Array<{ id: string; parentDepartmentId: string | null }>,
): Set<string> {
  const scope = new Set([departmentId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of departments) {
      if (d.parentDepartmentId && scope.has(d.parentDepartmentId) && !scope.has(d.id)) {
        scope.add(d.id);
        grew = true;
      }
    }
  }
  return scope;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function tenure(hireDate: string): string {
  const start = new Date(`${hireDate}T00:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 1) return 'Less than a month';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
  if (rest) parts.push(`${rest} mo`);
  return parts.join(' ');
}

export function daysSince(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
}
