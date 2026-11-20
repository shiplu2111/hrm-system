import { BadRequestException, ForbiddenException } from '@nestjs/common';
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

describe('WorkplaceIncidentsService rule-resolved country reporting fields', () => {
  const reportingSchemaSnapshot = {
    regulatorName: 'Safe Work Australia',
    regulatorReferenceLabel: 'Safe Work Notification Reference',
    regulatorReportDeadlineHours: 24,
    regulatorReportRequiredSeverities: ['high', 'critical'],
    notifiableIncidentTypes: ['injury'],
    reportingFields: [
      {
        key: 'notifiableIncidentCategory',
        label: 'WHS Notifiable Category',
        type: 'select',
        requiredWhenRegulatorNotifiable: true,
        options: [
          { value: 'serious_injury_illness', label: 'Serious injury or illness' },
          { value: 'non_notifiable', label: 'Non-notifiable' },
        ],
      },
      {
        key: 'immediateContainmentActions',
        label: 'Immediate Containment & Make-Safe Actions',
        type: 'textarea',
        required: true,
      },
    ],
  };

  function setupRuleTest() {
    const prisma = {
      unscoped: {
        employee: { findFirst: jest.fn().mockResolvedValue({ id: 'emp-1' }) },
        workplaceIncident: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
            id: 'inc-new',
            tenantId: 'tenant-1',
            companyId: 'company-1',
            incidentNumber: data.incidentNumber,
            incidentType: data.incidentType,
            severity: data.severity,
            status: 'reported',
            location: data.location,
            occurredAt: data.occurredAt,
            description: data.description,
            reportedByEmployeeId: data.reportedByEmployeeId,
            gpsLat: null,
            gpsLng: null,
            regulatorReportRequired: data.regulatorReportRequired,
            regulatorReportDueAt: data.regulatorReportDueAt,
            regulatorReportSubmittedAt: null,
            regulatorReportSubmittedByUserId: null,
            regulatorSubmittedByUser: null,
            regulatorReferenceNumber: null,
            regulatorName: data.regulatorName,
            countrySpecificData: data.countrySpecificData,
            resolvedRuleSnapshot: data.resolvedRuleSnapshot,
            investigationNotes: null,
            resolvedAt: null,
            createdByUserId: 'user-admin',
            createdAt: new Date('2026-11-10T01:00:00.000Z'),
            updatedAt: new Date('2026-11-10T01:00:00.000Z'),
            reportedByEmployee: { firstName: 'Alex', lastName: 'Thompson' },
            parties: [],
          })),
          findUnique: jest.fn().mockResolvedValue({
            id: 'inc-1',
            tenantId: 'tenant-1',
            companyId: 'company-1',
            incidentNumber: 'WSH-2026-001',
            incidentType: 'injury',
            severity: 'high',
            status: 'under_investigation',
            location: 'Warehouse',
            occurredAt: new Date('2026-11-10T01:00:00.000Z'),
            description: 'Fall',
            reportedByEmployeeId: 'emp-1',
            gpsLat: null,
            gpsLng: null,
            regulatorReportRequired: true,
            regulatorReportDueAt: new Date('2026-11-11T01:00:00.000Z'),
            regulatorReportSubmittedAt: null,
            regulatorReportSubmittedByUserId: null,
            regulatorSubmittedByUser: null,
            regulatorReferenceNumber: null,
            regulatorName: 'Safe Work Australia',
            countrySpecificData: { immediateContainmentActions: 'Isolated area' },
            resolvedRuleSnapshot: reportingSchemaSnapshot,
            investigationNotes: null,
            resolvedAt: null,
            createdByUserId: 'user-admin',
            createdAt: new Date('2026-11-10T01:00:00.000Z'),
            updatedAt: new Date('2026-11-10T01:00:00.000Z'),
            reportedByEmployee: { firstName: 'Alex', lastName: 'Thompson' },
            parties: [],
          }),
          update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
            id: 'inc-1',
            tenantId: 'tenant-1',
            companyId: 'company-1',
            incidentNumber: 'WSH-2026-001',
            incidentType: 'injury',
            severity: 'high',
            status: data.status ?? 'under_investigation',
            location: 'Warehouse',
            occurredAt: new Date('2026-11-10T01:00:00.000Z'),
            description: 'Fall',
            reportedByEmployeeId: 'emp-1',
            gpsLat: null,
            gpsLng: null,
            regulatorReportRequired: true,
            regulatorReportDueAt: new Date('2026-11-11T01:00:00.000Z'),
            regulatorReportSubmittedAt: data.regulatorReportSubmittedAt ?? null,
            regulatorReportSubmittedByUserId: 'user-admin',
            regulatorSubmittedByUser: {
              id: 'user-admin',
              email: 'admin@cmsnbd.com',
              employee: { firstName: 'Sarah', lastName: 'Chen' },
            },
            regulatorReferenceNumber: data.regulatorReferenceNumber ?? null,
            regulatorName: 'Safe Work Australia',
            countrySpecificData: data.countrySpecificData ?? { immediateContainmentActions: 'Isolated area' },
            resolvedRuleSnapshot: reportingSchemaSnapshot,
            investigationNotes: data.investigationNotes ?? null,
            resolvedAt: null,
            createdByUserId: 'user-admin',
            createdAt: new Date('2026-11-10T01:00:00.000Z'),
            updatedAt: new Date('2026-11-10T02:00:00.000Z'),
            reportedByEmployee: { firstName: 'Alex', lastName: 'Thompson' },
            parties: [],
          })),
        },
      },
    };
    const companyScope = {
      assertCompanyInTenant: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const notification = { emit: jest.fn().mockResolvedValue(undefined) };
    const rulesService = {
      resolveWithMetadataForEmployee: jest.fn().mockResolvedValue({
        rules: {
          incidentReporting: reportingSchemaSnapshot,
        },
        layers: [
          { layer: 'global', applied: true, ruleId: 'rule-global' },
          { layer: 'country', applied: true, ruleId: 'rule-aus' },
          { layer: 'state', applied: false, ruleId: null },
          { layer: 'company', applied: false, ruleId: null },
          { layer: 'employee_contract', applied: false, ruleId: null },
        ],
      }),
    };
    const dataScope = {
      employeeIds: jest.fn().mockResolvedValue(null),
      assertEmployeeInScope: jest.fn().mockResolvedValue(undefined),
    };
    const service = new WorkplaceIncidentsService(
      prisma as never,
      companyScope as never,
      audit as never,
      notification as never,
      rulesService as never,
      dataScope as never,
    );
    const adminUser: AuthenticatedUser = {
      id: 'user-admin',
      tenantId: 'tenant-1',
      roleId: 'role-admin',
      roleName: 'HR Admin',
      employeeId: null,
      email: 'admin@cmsnbd.com',
      permissions: [],
    };
    return { service, prisma, audit, adminUser };
  }

  it('resolves country reporting schema and validates countrySpecificData on create', async () => {
    const { service, adminUser } = setupRuleTest();
    const created = await service.create(
      'company-1',
      {
        incidentType: 'injury',
        severity: 'high',
        location: 'Loading Dock',
        occurredAt: '2026-11-10T01:00:00.000Z',
        description: 'Back strain',
        reportedByEmployeeId: 'emp-1',
        countrySpecificData: {
          immediateContainmentActions: 'Cleared dock and assisted worker',
          notifiableIncidentCategory: 'serious_injury_illness',
        },
      },
      adminUser,
    );

    expect(created.regulatorReportRequired).toBe(true);
    expect(created.regulatorName).toBe('Safe Work Australia');
    expect(created.countrySpecificData).toEqual({
      immediateContainmentActions: 'Cleared dock and assisted worker',
      notifiableIncidentCategory: 'serious_injury_illness',
    });
    expect(created.resolvedReportingConfig?.reportingFields).toHaveLength(2);
    expect(created.resolvedReportingConfig?.resolvedLayers?.[1].layer).toBe('country');
  });

  it('requires regulator-notifiable country fields when marking regulator report submitted', async () => {
    const { service, adminUser } = setupRuleTest();

    await expect(
      service.update(
        'inc-1',
        { regulatorReportSubmitted: true, regulatorReferenceNumber: 'SW-991' },
        adminUser,
      ),
    ).rejects.toThrow(BadRequestException);

    const updated = await service.update(
      'inc-1',
      {
        regulatorReportSubmitted: true,
        regulatorReferenceNumber: 'SW-991',
        countrySpecificData: {
          notifiableIncidentCategory: 'serious_injury_illness',
          immediateContainmentActions: 'Isolated area',
        },
      },
      adminUser,
    );

    expect(updated.regulatorReferenceNumber).toBe('SW-991');
    expect(updated.regulatorReportSubmittedByName).toBe('Sarah Chen');
  });
});
