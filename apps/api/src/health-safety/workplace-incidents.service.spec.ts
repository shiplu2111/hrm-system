import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { WorkplaceIncidentsService } from './workplace-incidents.service';

describe('WorkplaceIncidentsService data scope', () => {
  const prisma = {
    unscoped: {
      workplaceIncident: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    },
  };
  const companyScope = {
    assertCompanyInTenant: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
  };
  const dataScope = {
    employeeIdFilter: jest.fn().mockResolvedValue(undefined),
    employeeIds: jest.fn().mockResolvedValue(null),
    canAccessEmployee: jest.fn().mockResolvedValue(true),
    assertEmployeeInScope: jest.fn().mockResolvedValue(undefined),
    isOrgWide: jest.fn().mockResolvedValue(true),
  };

  const manager: AuthenticatedUser = {
    id: 'user-mgr',
    tenantId: 'tenant-1',
    roleId: 'role-manager',
    roleName: 'Manager',
    employeeId: 'emp-mgr',
    email: 'manager@example.com',
    permissions: [],
  };

  const incident = (overrides: Record<string, unknown> = {}) => ({
    id: 'incident-1',
    tenantId: 'tenant-1',
    companyId: 'company-1',
    incidentNumber: 'INC-2026-001',
    incidentType: 'injury',
    severity: 'minor',
    status: 'reported',
    location: 'Warehouse',
    occurredAt: new Date('2026-09-01T00:00:00.000Z'),
    description: 'Slip',
    reportedByEmployeeId: 'emp-other',
    gpsLat: null,
    gpsLng: null,
    regulatorReportRequired: false,
    regulatorReportDueAt: null,
    regulatorReportSubmittedAt: null,
    regulatorName: null,
    investigationNotes: null,
    resolvedAt: null,
    createdByUserId: 'user-other',
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-01T00:00:00.000Z'),
    reportedByEmployee: { firstName: 'Out', lastName: 'Side' },
    parties: [] as Array<{ employeeId: string; partyRole: string; employee: { firstName: string; lastName: string } }>,
    ...overrides,
  });

  let service: WorkplaceIncidentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    dataScope.employeeIds.mockResolvedValue(['emp-mgr', 'emp-report']);
    service = new WorkplaceIncidentsService(
      prisma as never,
      companyScope as never,
      {} as never,
      {} as never,
      {} as never,
      dataScope as never,
    );
  });

  it('rejects an incident outside the manager reporting line', async () => {
    prisma.unscoped.workplaceIncident.findUnique.mockResolvedValue(incident());

    await expect(service.getById('incident-1', manager)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows an incident involving a direct report', async () => {
    prisma.unscoped.workplaceIncident.findUnique.mockResolvedValue(
      incident({
        parties: [
          {
            employeeId: 'emp-report',
            partyRole: 'injured',
            employee: { firstName: 'Direct', lastName: 'Report' },
          },
        ],
      }),
    );

    await expect(service.getById('incident-1', manager)).resolves.toMatchObject({
      id: 'incident-1',
    });
  });

  it('filters the list to reporter, party, or creator in scope', async () => {
    prisma.unscoped.workplaceIncident.findMany.mockResolvedValue([]);

    await service.list('company-1', {}, manager);

    expect(prisma.unscoped.workplaceIncident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [
            {
              OR: [
                { reportedByEmployeeId: { in: ['emp-mgr', 'emp-report'] } },
                { parties: { some: { employeeId: { in: ['emp-mgr', 'emp-report'] } } } },
                { createdByUserId: 'user-mgr' },
              ],
            },
          ],
        }),
      }),
    );
  });

  it('does not restrict org-wide users', async () => {
    dataScope.employeeIds.mockResolvedValue(null);
    prisma.unscoped.workplaceIncident.findUnique.mockResolvedValue(incident());

    await expect(service.getById('incident-1', manager)).resolves.toMatchObject({
      id: 'incident-1',
    });
  });
});
