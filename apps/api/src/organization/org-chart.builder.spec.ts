import {
  buildOrgChart,
  type OrgChartEmployeeInput,
  type OrgChartRequisitionInput,
} from './org-chart.builder';

function employee(
  id: string,
  managerId: string | null,
  overrides: Partial<OrgChartEmployeeInput> = {},
): OrgChartEmployeeInput {
  return {
    id,
    employeeNumber: id.toUpperCase(),
    firstName: id,
    lastName: 'Test',
    status: 'active',
    hireDate: '2024-01-01',
    email: null,
    phone: null,
    managerId,
    designationId: null,
    designationName: null,
    departmentId: null,
    departmentName: null,
    jobLevel: null,
    exitType: null,
    exitDate: null,
    ...overrides,
  };
}

function requisition(
  id: string,
  overrides: Partial<OrgChartRequisitionInput> = {},
): OrgChartRequisitionInput {
  return {
    id,
    referenceNumber: `REQ-${id}`,
    title: 'Engineer',
    status: 'open',
    headcount: 1,
    hired: 0,
    activeCandidates: 0,
    openedAt: null,
    requestedByEmployeeId: null,
    designationId: null,
    departmentId: null,
    departmentName: null,
    jobLevel: null,
    ...overrides,
  };
}

const byId = (nodes: ReturnType<typeof buildOrgChart>['nodes']) =>
  new Map(nodes.map((n) => [n.id, n]));

describe('buildOrgChart', () => {
  it('links employees through manager ids and computes depth and span', () => {
    const { nodes, summary } = buildOrgChart(
      [employee('ceo', null), employee('cto', 'ceo'), employee('dev1', 'cto'), employee('dev2', 'cto')],
      [],
      [],
    );
    const map = byId(nodes);
    expect(map.get('dev1')?.parentId).toBe('cto');
    expect(summary).toMatchObject({ headcount: 4, topLevel: 1, maxDepth: 3, averageSpan: 1.5 });
  });

  it('keeps a departed manager as a vacated seat while reports remain, and drops leavers without reports', () => {
    const { nodes, summary } = buildOrgChart(
      [
        employee('ceo', null),
        employee('lead', 'ceo', {
          status: 'terminated',
          exitType: 'resignation',
          exitDate: '2026-08-31',
        }),
        employee('dev', 'lead'),
        employee('gone', 'ceo', { status: 'terminated' }),
      ],
      [],
      [],
    );
    const map = byId(nodes);
    expect(map.get('lead')).toMatchObject({ kind: 'vacated', employee: null });
    expect(map.get('lead')?.vacated).toEqual({
      previousHolder: { id: 'lead', employeeNumber: 'LEAD', name: 'lead Test', exitType: 'resignation' },
      since: '2026-08-31',
    });
    expect(map.get('dev')?.parentId).toBe('lead');
    expect(map.has('gone')).toBe(false);
    expect(summary.vacatedPositions).toBe(1);
  });

  it('breaks manager cycles and ignores unknown managers', () => {
    const { nodes } = buildOrgChart(
      [employee('a', 'b'), employee('b', 'a'), employee('c', 'missing'), employee('d', 'd')],
      [],
      [],
    );
    const roots = nodes.filter((n) => n.parentId === null).map((n) => n.id).sort();
    expect(roots).toEqual(['b', 'c', 'd']);
    expect(byId(nodes).get('a')?.parentId).toBe('b');
  });

  it('places requisition openings under the requester, then the department head, then the top level', () => {
    const { nodes, summary } = buildOrgChart(
      [
        employee('ceo', null, { departmentId: 'exec' }),
        employee('eng-head', 'ceo', { departmentId: 'eng' }),
        employee('eng-dev', 'eng-head', { departmentId: 'eng' }),
      ],
      [
        requisition('r1', { requestedByEmployeeId: 'eng-dev', headcount: 3, hired: 1 }),
        requisition('r2', { departmentId: 'frontend', status: 'pending_approval' }),
        requisition('r3', { departmentId: 'nowhere' }),
        requisition('r4', { headcount: 2, hired: 2 }),
      ],
      [
        { id: 'eng', parentDepartmentId: null },
        { id: 'frontend', parentDepartmentId: 'eng' },
      ],
    );
    const map = byId(nodes);
    expect(map.get('requisition:r1')).toMatchObject({ parentId: 'eng-dev' });
    expect(map.get('requisition:r1')?.requisition).toMatchObject({ openings: 2, placement: 'requester' });
    expect(map.get('requisition:r2')).toMatchObject({ parentId: 'eng-head' });
    expect(map.get('requisition:r2')?.requisition?.placement).toBe('department');
    expect(map.get('requisition:r3')).toMatchObject({ parentId: null });
    expect(map.get('requisition:r3')?.requisition?.placement).toBe('unplaced');
    expect(map.has('requisition:r4')).toBe(false);
    expect(summary).toMatchObject({ openRequisitions: 3, openSeats: 3, pendingSeats: 1, topLevel: 1 });
  });
});
