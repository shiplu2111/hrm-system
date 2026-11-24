import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BackupStatus,
  BackupType,
  DataRequestStatus,
  DataRequestType,
  EmploymentStatus,
  RestoreRequestStatus,
  RestoreScope,
  RestoreTestStatus,
} from '@prisma/client';
import { PlatformBackupsService, PlatformStaffActor } from './platform-backups.service';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';

describe('PlatformBackupsService', () => {
  let service: PlatformBackupsService;
  let mockUnscoped: any;
  let audit: any;

  const mockActor1: PlatformStaffActor = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'initiator@platform.local',
    firstName: 'Alice',
    lastName: 'Initiator',
    roleId: 'role-1',
    roleName: 'Platform Admin',
  };

  const mockActor2: PlatformStaffActor = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'approver@platform.local',
    firstName: 'Bob',
    lastName: 'Approver',
    roleId: 'role-2',
    roleName: 'Platform Owner',
  };

  beforeEach(async () => {
    mockUnscoped = {
      backupRun: {
        count: jest.fn().mockResolvedValue(4),
        findFirst: jest.fn().mockResolvedValue({
          id: 'b-1',
          completedAt: new Date('2026-11-24T10:00:00Z'),
          sizeBytes: BigInt(256 * 1024 * 1024),
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'b-1',
            backupType: BackupType.full,
            storageDriver: 'local_disk',
            status: BackupStatus.completed,
            sizeBytes: BigInt(256 * 1024 * 1024),
            location: 'backups/2026-11-24/hrm_full.tar.gz',
            checksum: 'mock-sha256',
            includesFileStorage: true,
            retentionExpiry: new Date('2026-12-24T10:00:00Z'),
            startedAt: new Date('2026-11-24T09:55:00Z'),
            completedAt: new Date('2026-11-24T10:00:00Z'),
            errorMessage: null,
            restoreTestStatus: RestoreTestStatus.passed,
            restoreTestAt: new Date('2026-11-24T11:00:00Z'),
            restoreTestDurationMs: 1420,
            restoreTestDetails: { schemaValidated: true },
            createdAt: new Date('2026-11-24T09:55:00Z'),
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'b-1',
          includesFileStorage: true,
        }),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'b-created',
            ...data,
            createdAt: new Date(),
          }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'b-1',
            backupType: BackupType.full,
            storageDriver: 'local_disk',
            status: BackupStatus.completed,
            sizeBytes: BigInt(256 * 1024 * 1024),
            location: 'backups/2026-11-24/hrm_full.tar.gz',
            checksum: 'mock-sha256',
            includesFileStorage: true,
            retentionExpiry: new Date('2026-12-24T10:00:00Z'),
            startedAt: new Date('2026-11-24T09:55:00Z'),
            completedAt: new Date('2026-11-24T10:00:00Z'),
            errorMessage: null,
            restoreTestStatus: data.restoreTestStatus || RestoreTestStatus.passed,
            restoreTestAt: data.restoreTestAt || new Date(),
            restoreTestDurationMs: data.restoreTestDurationMs || 1420,
            restoreTestDetails: data.restoreTestDetails || {},
            createdAt: new Date('2026-11-24T09:55:00Z'),
          }),
        ),
      },
      restoreRequest: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'rr-1',
            ...data,
            createdAt: new Date(),
          }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'rr-1',
            backupRunId: 'b-1',
            scope: RestoreScope.tenant,
            tenantId: 'tenant-1',
            status: data.status,
            requestedByUserId: mockActor1.id,
            requestedByName: 'Alice Initiator',
            reason: 'Recover corrupted designations',
            approvedByUserId: data.approvedByUserId || null,
            approvedByName: data.approvedByName || null,
            approvedAt: data.approvedAt || null,
            rejectedByUserId: data.rejectedByUserId || null,
            rejectedByName: data.rejectedByName || null,
            rejectedAt: data.rejectedAt || null,
            rejectionReason: data.rejectionReason || null,
            jobId: data.jobId || null,
            startedAt: data.startedAt || null,
            completedAt: data.completedAt || null,
            errorMessage: null,
            logs: data.logs || null,
            createdAt: new Date(),
          }),
        ),
      },
      dataRequest: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'dr-1',
            ...data,
            createdAt: new Date(),
          }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'dr-1',
            tenantId: 'tenant-1',
            type: DataRequestType.tenant_export,
            status: DataRequestStatus.completed,
            targetEmployeeId: null,
            requestedByUserId: mockActor1.id,
            requestedByName: 'Alice Initiator',
            reason: 'Offboarding export',
            archiveUrl: data.archiveUrl || '/download/dr-1',
            archiveSizeBytes: BigInt(18 * 1024 * 1024),
            archiveExpiresAt: new Date(Date.now() + 7 * 86400000),
            anonymizedSummary: null,
            jobId: 'job_export_1',
            startedAt: new Date(),
            completedAt: new Date(),
            errorMessage: null,
            logs: {},
            createdAt: new Date(),
          }),
        ),
      },
      tenant: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([{ id: 'tenant-1', name: 'Acme Corp', subdomain: 'acme' }]),
        findUnique: jest.fn().mockResolvedValue({ id: 'tenant-1', name: 'Acme Corp', subdomain: 'acme' }),
      },
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'emp-1',
          tenantId: 'tenant-1',
          employeeNumber: 'EMP-001',
          firstName: 'John',
          lastName: 'Doe',
          user: { id: 'usr-1', email: 'john@acme.com' },
          payrollRuns: [{ id: 'pr-1' }, { id: 'pr-2' }],
          taxProfiles: [{ id: 'tp-1' }],
        }),
        update: jest.fn().mockResolvedValue({ id: 'emp-1' }),
      },
      user: {
        update: jest.fn().mockResolvedValue({ id: 'usr-1' }),
      },
      refreshToken: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const mockPrisma = {
      unscoped: mockUnscoped,
    };

    audit = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformBackupsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: PlatformAuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<PlatformBackupsService>(PlatformBackupsService);
  });

  it('should compute KPI summary metrics correctly', async () => {
    const summary = await service.getSummary();

    expect(summary.totalBackups).toBe(4);
    expect(summary.completedBackups).toBe(4);
    expect(summary.lastBackupSizeFormatted).toBe('256.00 MB');
    expect(summary.pendingRestoreApprovals).toBe(1);
  });

  it('should trigger a new backup run with automatic local file storage inclusion', async () => {
    const result = await service.triggerBackup(
      { backupType: 'full', storageDriver: 'local_disk' },
      mockActor1,
    );

    expect(result.status).toBe('completed');
    expect(result.includesFileStorage).toBe(true);
    expect(result.checksum).toBeDefined();
    expect(result.retentionExpiry).toBeDefined();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'backup_restore',
        action: 'backup.run',
      }),
    );
  });

  it('should run an automated restore test and record verification details', async () => {
    const result = await service.runRestoreTest('b-1', mockActor1);

    expect(result.restoreTestStatus).toBe('passed');
    expect(result.restoreTestDetails).toBeDefined();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'backup_restore',
        action: 'restore_test.execute',
      }),
    );
  });

  it('should enforce dual approval: reject self-approval of restore requests', async () => {
    mockUnscoped.restoreRequest.findUnique.mockResolvedValue({
      id: 'rr-1',
      requestedByUserId: mockActor1.id,
      status: RestoreRequestStatus.pending_approval,
    });

    await expect(service.approveRestoreRequest('rr-1', mockActor1)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should approve and execute tenant-level restore with isolated boundary guarantees', async () => {
    mockUnscoped.restoreRequest.findUnique.mockResolvedValue({
      id: 'rr-1',
      backupRunId: 'b-1',
      scope: RestoreScope.tenant,
      tenantId: 'tenant-1',
      requestedByUserId: mockActor1.id, // Alice initiated
      status: RestoreRequestStatus.pending_approval,
      backupRun: { location: 'backups/hrm.tar.gz' },
      tenant: { name: 'Acme Corp', subdomain: 'acme' },
    });

    // Bob approves (different actor)
    const result = await service.approveRestoreRequest('rr-1', mockActor2);

    expect(result.status).toBe('completed');
    expect(result.approvedByUserId).toBe(mockActor2.id);
    expect(result.logs?.isolationGuaranteed).toBe(true);
    expect(result.logs?.foreignTenantsModified).toBe(0);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'backup_restore',
        action: 'restore.execute',
      }),
    );
  });

  it('should generate tenant data export archive for portability (SYSTEM_SETTINGS §5)', async () => {
    const result = await service.createTenantExport(
      { tenantId: 'tenant-1', reason: 'Annual GDPR audit' },
      mockActor1,
    );

    expect(result.status).toBe('completed');
    expect(result.archiveUrl).toContain('/api/v1/platform/backups/data-requests/');
    expect(result.archiveSizeBytes).toBeDefined();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'data_compliance',
        action: 'tenant_export.generate',
      }),
    );
  });

  it('should execute employee anonymization scrubbing PII while preserving statutory payroll records (SECURITY §9)', async () => {
    const result = await service.createEmployeeAnonymization(
      {
        tenantId: 'tenant-1',
        targetEmployeeId: 'emp-1',
        reason: 'Right to be forgotten request',
      },
      mockActor1,
    );

    expect(result.status).toBe('completed');
    expect(result.anonymizedSummary?.scrubbedFields).toContain('firstName');
    expect(result.anonymizedSummary?.statutoryPayrollRecordsPreserved).toBe(2);
    expect(result.anonymizedSummary?.auditLogsRetained).toBe(true);
    expect(mockUnscoped.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          firstName: 'Anonymized',
          employmentStatus: EmploymentStatus.terminated,
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'data_compliance',
        action: 'employee.anonymize',
      }),
    );
  });
});
