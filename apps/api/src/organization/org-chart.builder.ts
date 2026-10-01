import type {
  EmploymentStatus,
  OrgChartNode,
  OrgChartSummary,
} from '@hrm/shared-types';

export interface OrgChartJobLevel {
  id: string;
  code: string;
  name: string;
  rank: number;
}

export interface OrgChartEmployeeInput {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  status: EmploymentStatus;
  hireDate: string;
  email: string | null;
  phone: string | null;
  managerId: string | null;
  designationId: string | null;
  designationName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  jobLevel: OrgChartJobLevel | null;
  exitType: 'resignation' | 'termination' | null;
  exitDate: string | null;
}

export interface OrgChartRequisitionInput {
  id: string;
  referenceNumber: string;
  title: string;
  status: 'open' | 'pending_approval';
  headcount: number;
  hired: number;
  activeCandidates: number;
  openedAt: string | null;
  requestedByEmployeeId: string | null;
  designationId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  jobLevel: OrgChartJobLevel | null;
}

export interface OrgChartDepartmentInput {
  id: string;
  parentDepartmentId: string | null;
}

export interface OrgChartBuildResult {
  nodes: OrgChartNode[];
  summary: OrgChartSummary;
}

/**
 * Builds the reporting tree from employees.manager_id.
 * - Terminated employees are dropped unless someone still reports to them, in which case
 *   their seat becomes a `vacated` node so the reports stay attached to the right branch.
 * - Manager links that point outside the set (other company, soft-deleted) or form a cycle
 *   are cut, making that employee a top-level node.
 * - Requisition openings hang off their requester, else the most senior employee in their
 *   department (walking up parent departments), else the top level.
 */
export function buildOrgChart(
  employees: OrgChartEmployeeInput[],
  requisitions: OrgChartRequisitionInput[],
  departments: OrgChartDepartmentInput[],
): OrgChartBuildResult {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const parent = new Map<string, string | null>();
  for (const e of employees) {
    parent.set(e.id, e.managerId && e.managerId !== e.id && byId.has(e.managerId) ? e.managerId : null);
  }
  breakCycles(parent);

  const children = new Map<string, string[]>();
  for (const [id, p] of parent) {
    if (!p) continue;
    const list = children.get(p) ?? [];
    list.push(id);
    children.set(p, list);
  }

  const included = new Map<string, boolean>();
  const isIncluded = (id: string): boolean => {
    const cached = included.get(id);
    if (cached !== undefined) return cached;
    included.set(id, false);
    const self = byId.get(id)!;
    let result = self.status !== 'terminated';
    for (const child of children.get(id) ?? []) {
      if (isIncluded(child)) result = true;
    }
    included.set(id, result);
    return result;
  };

  const nodes: OrgChartNode[] = [];
  for (const e of employees) {
    if (!isIncluded(e.id)) continue;
    const vacated = e.status === 'terminated';
    nodes.push({
      id: e.id,
      kind: vacated ? 'vacated' : 'employee',
      parentId: parent.get(e.id) ?? null,
      title: e.designationName,
      designationId: e.designationId,
      departmentId: e.departmentId,
      departmentName: e.departmentName,
      jobLevel: e.jobLevel,
      employee: vacated
        ? null
        : {
            id: e.id,
            employeeNumber: e.employeeNumber,
            firstName: e.firstName,
            lastName: e.lastName,
            status: e.status,
            hireDate: e.hireDate,
            email: e.email,
            phone: e.phone,
          },
      vacated: vacated
        ? {
            previousHolder: {
              id: e.id,
              employeeNumber: e.employeeNumber,
              name: `${e.firstName} ${e.lastName}`.trim(),
              exitType: e.exitType,
            },
            since: e.exitDate,
          }
        : null,
      requisition: null,
    });
  }

  const depth = computeDepths(nodes);
  const seniorByDepartment = mostSeniorByDepartment(nodes, depth, children);
  const departmentParent = new Map(departments.map((d) => [d.id, d.parentDepartmentId]));

  for (const r of requisitions) {
    const openings = Math.max(0, r.headcount - r.hired);
    if (openings === 0) continue;

    let parentId: string | null = null;
    let placement: 'requester' | 'department' | 'unplaced' = 'unplaced';
    const requester = r.requestedByEmployeeId ? byId.get(r.requestedByEmployeeId) : undefined;
    if (requester && requester.status !== 'terminated') {
      parentId = requester.id;
      placement = 'requester';
    } else {
      const head = findDepartmentHead(r.departmentId, seniorByDepartment, departmentParent);
      if (head) {
        parentId = head;
        placement = 'department';
      }
    }

    nodes.push({
      id: `requisition:${r.id}`,
      kind: 'requisition',
      parentId,
      title: r.title,
      designationId: r.designationId,
      departmentId: r.departmentId,
      departmentName: r.departmentName,
      jobLevel: r.jobLevel,
      employee: null,
      vacated: null,
      requisition: {
        requisitionId: r.id,
        referenceNumber: r.referenceNumber,
        status: r.status,
        headcount: r.headcount,
        filled: r.hired,
        openings,
        activeCandidates: r.activeCandidates,
        openedAt: r.openedAt,
        placement,
      },
    });
    depth.set(`requisition:${r.id}`, parentId ? (depth.get(parentId) ?? 0) + 1 : 0);
  }

  return { nodes, summary: summarize(nodes, depth) };
}

function breakCycles(parent: Map<string, string | null>): void {
  const state = new Map<string, 1 | 2>();
  for (const start of parent.keys()) {
    const path: string[] = [];
    let cur: string | null = start;
    while (cur && !state.has(cur)) {
      state.set(cur, 1);
      path.push(cur);
      cur = parent.get(cur) ?? null;
    }
    if (cur && state.get(cur) === 1) {
      parent.set(path[path.length - 1], null);
    }
    for (const id of path) state.set(id, 2);
  }
}

function computeDepths(nodes: OrgChartNode[]): Map<string, number> {
  const kids = new Map<string | null, string[]>();
  for (const n of nodes) {
    const list = kids.get(n.parentId) ?? [];
    list.push(n.id);
    kids.set(n.parentId, list);
  }
  const depth = new Map<string, number>();
  const queue: Array<[string, number]> = (kids.get(null) ?? []).map((id) => [id, 0]);
  while (queue.length) {
    const [id, d] = queue.shift()!;
    depth.set(id, d);
    for (const child of kids.get(id) ?? []) queue.push([child, d + 1]);
  }
  return depth;
}

/** Shallowest filled seat per department; ties go to the larger team. */
function mostSeniorByDepartment(
  nodes: OrgChartNode[],
  depth: Map<string, number>,
  children: Map<string, string[]>,
): Map<string, string> {
  const best = new Map<string, OrgChartNode>();
  for (const n of nodes) {
    if (n.kind !== 'employee' || !n.departmentId) continue;
    const current = best.get(n.departmentId);
    if (!current) {
      best.set(n.departmentId, n);
      continue;
    }
    const dn = depth.get(n.id) ?? 0;
    const dc = depth.get(current.id) ?? 0;
    const sn = children.get(n.id)?.length ?? 0;
    const sc = children.get(current.id)?.length ?? 0;
    if (dn < dc || (dn === dc && sn > sc)) best.set(n.departmentId, n);
  }
  return new Map([...best].map(([dept, node]) => [dept, node.id]));
}

function findDepartmentHead(
  departmentId: string | null,
  seniorByDepartment: Map<string, string>,
  departmentParent: Map<string, string | null>,
): string | null {
  const seen = new Set<string>();
  let cur = departmentId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const head = seniorByDepartment.get(cur);
    if (head) return head;
    cur = departmentParent.get(cur) ?? null;
  }
  return null;
}

function summarize(nodes: OrgChartNode[], depth: Map<string, number>): OrgChartSummary {
  const reports = new Map<string, number>();
  for (const n of nodes) {
    if (n.kind === 'requisition' || !n.parentId) continue;
    reports.set(n.parentId, (reports.get(n.parentId) ?? 0) + 1);
  }
  const spans = [...reports.values()];
  const requisitions = nodes.filter((n) => n.kind === 'requisition');

  return {
    headcount: nodes.filter((n) => n.kind === 'employee').length,
    vacatedPositions: nodes.filter((n) => n.kind === 'vacated').length,
    openRequisitions: requisitions.length,
    openSeats: requisitions
      .filter((n) => n.requisition?.status === 'open')
      .reduce((sum, n) => sum + (n.requisition?.openings ?? 0), 0),
    pendingSeats: requisitions
      .filter((n) => n.requisition?.status === 'pending_approval')
      .reduce((sum, n) => sum + (n.requisition?.openings ?? 0), 0),
    topLevel: nodes.filter((n) => n.kind !== 'requisition' && !n.parentId).length,
    maxDepth: nodes.length ? Math.max(...nodes.map((n) => depth.get(n.id) ?? 0)) + 1 : 0,
    averageSpan: spans.length
      ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length) * 10) / 10
      : 0,
  };
}
