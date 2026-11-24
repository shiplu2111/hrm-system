import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { TotpService } from '../auth/totp.service';
import { PlatformStaffService } from './platform-staff.service';

describe('PlatformStaffService', () => {
  let service: PlatformStaffService;
  let prismaMock: any;
  let fieldEncryptionMock: any;
  let totpServiceMock: any;
  let auditServiceMock: any;

  const mockOwnerRole = { id: 'role-owner', name: 'Platform Owner', isSystem: true };
  const mockAdminRole = { id: 'role-admin', name: 'Platform Admin', isSystem: true };
  const mockSupportRole = { id: 'role-support', name: 'Support Agent', isSystem: true };

  const ownerActor = { id: 'user-owner', email: 'owner@cmsnbd.com', roleName: 'Platform Owner' };
  const adminActor = { id: 'user-admin', email: 'admin@cmsnbd.com', roleName: 'Platform Admin' };

  beforeEach(async () => {
    prismaMock = {
      unscoped: {
        platformRole: {
          upsert: jest.fn(),
          findUnique: jest.fn(),
          findUniqueOrThrow: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        platformPermission: {
          upsert: jest.fn(),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        platformUser: {
          upsert: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          count: jest.fn(),
          groupBy: jest.fn().mockResolvedValue([]),
        },
        platformSession: {
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        platform2faResetRequest: {
          findFirst: jest.fn(),
          findUnique: jest.fn(),
          findMany: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        $transaction: jest.fn((cb: any) => cb(prismaMock.unscoped)),
      },
    };

    fieldEncryptionMock = {
      encrypt: jest.fn((str) => `enc_${str}`),
      decrypt: jest.fn((str) => str.replace('enc_', '')),
    };

    totpServiceMock = {
      generateSecret: jest.fn(() => 'MOCKSECRET32CHARS'),
      generateKeyUri: jest.fn(() => 'otpauth://totp/HRM:test?secret=MOCK'),
      verifyCode: jest.fn(() => true),
    };

    auditServiceMock = {
      log: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformStaffService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: FieldEncryptionService, useValue: fieldEncryptionMock },
        { provide: TotpService, useValue: totpServiceMock },
        { provide: PlatformAuditService, useValue: auditServiceMock },
      ],
    }).compile();

    service = module.get<PlatformStaffService>(PlatformStaffService);
  });

  describe('inviteUser', () => {
    it('successfully invites a user with no pre-configured 2FA secret (forcing first-login enrollment)', async () => {
      prismaMock.unscoped.platformUser.findUnique.mockResolvedValue(null);
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue(mockSupportRole);
      prismaMock.unscoped.platformUser.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          ...data,
          id: 'user-new',
          createdAt: new Date(),
          role: { ...mockSupportRole, permissions: [] },
        }),
      );

      const result = await service.inviteUser(
        {
          email: 'agent@cmsnbd.com',
          firstName: 'Agent',
          lastName: 'Smith',
          roleId: mockSupportRole.id,
          temporaryPassword: 'TempPassword123!',
        },
        adminActor,
      );

      expect(result.user.email).toBe('agent@cmsnbd.com');
      expect(result.user.status).toBe('invited');
      expect(result.user.totpEnrolled).toBe(false);
      expect(result.temporaryPassword).toBe('TempPassword123!');
      expect(result.requires2faOnFirstLogin).toBe(true);

      expect(prismaMock.unscoped.platformUser.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'agent@cmsnbd.com',
            totpSecretEncrypted: null,
            totpEnabled: false,
          }),
        }),
      );
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'invite', module: 'platform_user' }),
      );
    });

    it('prevents non-Platform Owner from inviting someone as Platform Owner', async () => {
      prismaMock.unscoped.platformUser.findUnique.mockResolvedValue(null);
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue(mockOwnerRole);

      await expect(
        service.inviteUser(
          {
            email: 'newowner@cmsnbd.com',
            firstName: 'New',
            lastName: 'Owner',
            roleId: mockOwnerRole.id,
          },
          adminActor, // actor is Platform Admin, not Platform Owner
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows Platform Owner to invite someone as Platform Owner', async () => {
      prismaMock.unscoped.platformUser.findUnique.mockResolvedValue(null);
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue(mockOwnerRole);
      prismaMock.unscoped.platformUser.create.mockImplementation(({ data }: any) =>
        Promise.resolve({
          ...data,
          id: 'user-new-owner',
          createdAt: new Date(),
          role: { ...mockOwnerRole, permissions: [] },
        }),
      );

      const result = await service.inviteUser(
        {
          email: 'newowner@cmsnbd.com',
          firstName: 'New',
          lastName: 'Owner',
          roleId: mockOwnerRole.id,
        },
        ownerActor, // actor is Platform Owner
      );

      expect(result.user.email).toBe('newowner@cmsnbd.com');
      expect(result.user.roleName).toBe('Platform Owner');
    });

    it('rejects duplicate email with ConflictException', async () => {
      prismaMock.unscoped.platformUser.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.inviteUser(
          {
            email: 'existing@cmsnbd.com',
            firstName: 'Jane',
            lastName: 'Doe',
            roleId: mockSupportRole.id,
          },
          adminActor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('deactivateUser', () => {
    it('prevents deactivating oneself', async () => {
      await expect(service.deactivateUser('user-admin', adminActor)).rejects.toThrow(BadRequestException);
    });

    it('prevents non-Platform Owner from deactivating a Platform Owner', async () => {
      prismaMock.unscoped.platformUser.findUnique.mockResolvedValue({
        id: 'user-target-owner',
        email: 'targetowner@cmsnbd.com',
        role: mockOwnerRole,
        isActive: true,
      });

      await expect(service.deactivateUser('user-target-owner', adminActor)).rejects.toThrow(ForbiddenException);
    });

    it('prevents deactivating the last active Platform Owner', async () => {
      prismaMock.unscoped.platformUser.findUnique.mockResolvedValue({
        id: 'user-target-owner',
        email: 'targetowner@cmsnbd.com',
        role: mockOwnerRole,
        isActive: true,
      });
      prismaMock.unscoped.platformUser.count.mockResolvedValue(1); // Only 1 active owner!

      await expect(service.deactivateUser('user-target-owner', ownerActor)).rejects.toThrow(BadRequestException);
    });

    it('successfully deactivates user and immediately revokes all active sessions', async () => {
      prismaMock.unscoped.platformUser.findUnique.mockResolvedValue({
        id: 'user-target-support',
        email: 'support@cmsnbd.com',
        role: mockSupportRole,
        isActive: true,
      });
      prismaMock.unscoped.platformUser.update.mockResolvedValue({
        id: 'user-target-support',
        email: 'support@cmsnbd.com',
        firstName: 'Support',
        lastName: 'Agent',
        roleId: mockSupportRole.id,
        role: { ...mockSupportRole, permissions: [] },
        isActive: false,
        totpEnabled: true,
        totpSecretEncrypted: 'enc_secret',
        lastLoginAt: new Date(),
        invitedAt: null,
        createdAt: new Date(),
      });

      const result = await service.deactivateUser('user-target-support', adminActor);

      expect(result.isActive).toBe(false);
      expect(result.status).toBe('deactivated');
      expect(prismaMock.unscoped.platformSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-target-support', isRevoked: false },
        data: { isRevoked: true },
      });
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'deactivate', module: 'platform_user' }),
      );
    });
  });

  describe('request2faReset', () => {
    it('rejects if target user does not have 2FA enrolled', async () => {
      prismaMock.unscoped.platformUser.findUnique.mockResolvedValue({
        id: 'user-target',
        email: 'target@cmsnbd.com',
        role: mockSupportRole,
        totpSecretEncrypted: null, // No 2FA enrolled!
      });

      await expect(
        service.request2faReset('user-target', { reason: 'Lost device' }, adminActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('prevents non-Platform Owner from requesting 2FA reset for a Platform Owner', async () => {
      prismaMock.unscoped.platformUser.findUnique.mockResolvedValue({
        id: 'user-owner',
        email: 'owner@cmsnbd.com',
        role: mockOwnerRole,
        totpSecretEncrypted: 'enc_secret',
      });

      await expect(
        service.request2faReset('user-owner', { reason: 'Lost device' }, adminActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates a pending 2FA reset request and audit logs', async () => {
      prismaMock.unscoped.platformUser.findUnique.mockResolvedValue({
        id: 'user-target',
        email: 'target@cmsnbd.com',
        role: mockSupportRole,
        totpSecretEncrypted: 'enc_secret',
      });
      prismaMock.unscoped.platform2faResetRequest.findFirst.mockResolvedValue(null);
      prismaMock.unscoped.platform2faResetRequest.create.mockResolvedValue({
        id: 'req-1',
        targetUserId: 'user-target',
        requestedBy: adminActor.id,
        reason: 'Lost phone on vacation',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        targetUser: { email: 'target@cmsnbd.com', firstName: 'Target', lastName: 'User', role: { name: 'Support Agent' } },
        requester: { email: adminActor.email, firstName: 'Admin', lastName: 'User' },
      });

      const result = await service.request2faReset('user-target', { reason: 'Lost phone on vacation' }, adminActor);

      expect(result.id).toBe('req-1');
      expect(result.status).toBe('pending');
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'request_2fa_reset', module: 'platform_user' }),
      );
    });
  });

  describe('review2faReset', () => {
    const mockPendingRequest = {
      id: 'req-1',
      targetUserId: 'user-target',
      requestedBy: 'user-admin', // requested by user-admin
      reason: 'Lost authenticator',
      status: 'pending',
      targetUser: {
        id: 'user-target',
        email: 'target@cmsnbd.com',
        role: mockSupportRole,
      },
      requester: {
        id: 'user-admin',
        email: 'admin@cmsnbd.com',
        firstName: 'Platform',
        lastName: 'Admin',
      },
    };

    it('ENFORCES FOUR-EYES PRINCIPLE: forbids requester from approving their own request', async () => {
      prismaMock.unscoped.platform2faResetRequest.findUnique.mockResolvedValue(mockPendingRequest);

      // Actor is user-admin (the requester)
      await expect(
        service.review2faReset('req-1', { action: 'approve' }, adminActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a different admin to approve: wipes 2FA secret and revokes all active sessions', async () => {
      prismaMock.unscoped.platform2faResetRequest.findUnique.mockResolvedValue(mockPendingRequest);
      prismaMock.unscoped.platform2faResetRequest.update.mockResolvedValue({
        ...mockPendingRequest,
        status: 'approved',
        reviewedBy: ownerActor.id,
        reviewedAt: new Date(),
        reviewReason: 'Approved by owner',
        createdAt: new Date(),
        updatedAt: new Date(),
        targetUser: { email: 'target@cmsnbd.com', firstName: 'Target', lastName: 'User', role: { name: 'Support Agent' } },
        requester: { email: 'admin@cmsnbd.com', firstName: 'Platform', lastName: 'Admin' },
        reviewer: { email: ownerActor.email, firstName: 'Platform', lastName: 'Owner' },
      });

      // Actor is ownerActor (different from requester user-admin)
      const result = await service.review2faReset('req-1', { action: 'approve' }, ownerActor);

      expect(result.status).toBe('approved');

      // Check that 2FA secret is cleared on target user
      expect(prismaMock.unscoped.platformUser.update).toHaveBeenCalledWith({
        where: { id: 'user-target' },
        data: { totpSecretEncrypted: null, totpEnabled: false },
      });

      // Check that all active sessions for target user are immediately revoked
      expect(prismaMock.unscoped.platformSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-target', isRevoked: false },
        data: { isRevoked: true },
      });

      // Check audit log
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'approve_2fa_reset', module: 'platform_user' }),
      );
    });

    it('allows a different admin to reject the request and records audit log', async () => {
      prismaMock.unscoped.platform2faResetRequest.findUnique.mockResolvedValue(mockPendingRequest);
      prismaMock.unscoped.platform2faResetRequest.update.mockResolvedValue({
        ...mockPendingRequest,
        status: 'rejected',
        reviewedBy: ownerActor.id,
        reviewedAt: new Date(),
        reviewReason: 'Could not verify identity',
        createdAt: new Date(),
        updatedAt: new Date(),
        targetUser: { email: 'target@cmsnbd.com', firstName: 'Target', lastName: 'User', role: { name: 'Support Agent' } },
        requester: { email: 'admin@cmsnbd.com', firstName: 'Platform', lastName: 'Admin' },
        reviewer: { email: ownerActor.email, firstName: 'Platform', lastName: 'Owner' },
      });

      const result = await service.review2faReset(
        'req-1',
        { action: 'reject', reviewReason: 'Could not verify identity' },
        ownerActor,
      );

      expect(result.status).toBe('rejected');
      expect(prismaMock.unscoped.platformUser.update).not.toHaveBeenCalled();
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'reject_2fa_reset', module: 'platform_user' }),
      );
    });
  });

  describe('getActiveOwnerStatus', () => {
    it('warns when only 1 active Platform Owner remains (isAtRisk = true)', async () => {
      prismaMock.unscoped.platformUser.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
      const status = await service.getActiveOwnerStatus();
      expect(status.activeOwnerCount).toBe(1);
      expect(status.isAtRisk).toBe(true);
      expect(status.warningMessage).toContain('High Governance Risk');
    });

    it('reports healthy governance when 2 or more active Platform Owners exist', async () => {
      prismaMock.unscoped.platformUser.count.mockResolvedValueOnce(2).mockResolvedValueOnce(2);
      const status = await service.getActiveOwnerStatus();
      expect(status.activeOwnerCount).toBe(2);
      expect(status.isAtRisk).toBe(false);
      expect(status.warningMessage).toBeNull();
    });
  });

  describe('createRole', () => {
    it('successfully creates a custom role with permission matrix', async () => {
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue(null);
      prismaMock.unscoped.platformRole.create.mockResolvedValue({
        id: 'role-devops',
        name: 'DevOps Operator',
        description: 'Infrastructure ops',
        isSystem: false,
        permissions: [{ module: 'setting', action: 'edit' }],
        _count: { users: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createRole(
        {
          name: 'DevOps Operator',
          description: 'Infrastructure ops',
          permissions: [{ module: 'setting', action: 'edit' }],
        },
        adminActor,
      );

      expect(res.name).toBe('DevOps Operator');
      expect(res.permissions).toHaveLength(1);
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', module: 'platform_role' }),
      );
    });

    it('forbids non-Platform Owner from creating a role with platform:manage or user:manage', async () => {
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue(null);
      await expect(
        service.createRole(
          {
            name: 'Shadow Admin',
            permissions: [{ module: 'platform', action: 'manage' }],
          },
          adminActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows Platform Owner to grant platform:manage on custom role', async () => {
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue(null);
      prismaMock.unscoped.platformRole.create.mockResolvedValue({
        id: 'role-custom-lead',
        name: 'Lead Admin',
        isSystem: false,
        permissions: [{ module: 'platform', action: 'manage' }],
        _count: { users: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.createRole(
        {
          name: 'Lead Admin',
          permissions: [{ module: 'platform', action: 'manage' }],
        },
        ownerActor,
      );
      expect(res.name).toBe('Lead Admin');
    });

    it('rejects duplicate role name with ConflictException', async () => {
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue({ id: 'role-1', name: 'Existing' });
      await expect(
        service.createRole({ name: 'Existing', permissions: [] }, adminActor),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateRole', () => {
    it('prevents non-Platform Owner from modifying the Platform Owner role', async () => {
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue(mockOwnerRole);
      await expect(
        service.updateRole(mockOwnerRole.id, { description: 'New desc' }, adminActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('prevents renaming the Platform Owner role', async () => {
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue(mockOwnerRole);
      await expect(
        service.updateRole(mockOwnerRole.id, { name: 'Renamed Owner' }, ownerActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('ENFORCES LAST ACTIVE OWNER PROTECTION: prevents stripping root platform:manage and user:manage from Platform Owner', async () => {
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue({
        ...mockOwnerRole,
        permissions: [{ module: 'platform', action: 'manage' }, { module: 'user', action: 'manage' }],
        _count: { users: 1 },
      });

      // Attempting to remove user:manage
      await expect(
        service.updateRole(
          mockOwnerRole.id,
          {
            permissions: [{ module: 'platform', action: 'manage' }], // user:manage missing!
          },
          ownerActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully updates role permissions and writes audit log', async () => {
      const customRole = {
        id: 'role-custom',
        name: 'Custom Auditor',
        isSystem: false,
        permissions: [],
        _count: { users: 0 },
      };
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue(customRole);
      prismaMock.unscoped.platformRole.findUniqueOrThrow.mockResolvedValue({
        ...customRole,
        permissions: [{ module: 'audit', action: 'view' }],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prismaMock.unscoped.platformUser.count.mockResolvedValue(0);

      const res = await service.updateRole(
        'role-custom',
        {
          permissions: [{ module: 'audit', action: 'view' }],
        },
        adminActor,
      );

      expect(res.permissions).toHaveLength(1);
      expect(prismaMock.unscoped.platformPermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role-custom' } });
      expect(prismaMock.unscoped.platformPermission.createMany).toHaveBeenCalledWith({
        data: [{ roleId: 'role-custom', module: 'audit', action: 'view' }],
        skipDuplicates: true,
      });
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'update', module: 'platform_role' }),
      );
    });
  });

  describe('deleteRole', () => {
    it('prevents deleting system roles', async () => {
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue({
        id: 'role-system',
        name: 'Platform Admin',
        isSystem: true,
        _count: { users: 0 },
      });

      await expect(service.deleteRole('role-system', ownerActor)).rejects.toThrow(BadRequestException);
    });

    it('prevents deleting custom roles that have active users assigned', async () => {
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue({
        id: 'role-used',
        name: 'Support Tier 2',
        isSystem: false,
        _count: { users: 3 },
      });

      await expect(service.deleteRole('role-used', adminActor)).rejects.toThrow(BadRequestException);
    });

    it('successfully deletes an unassigned custom role', async () => {
      prismaMock.unscoped.platformRole.findUnique.mockResolvedValue({
        id: 'role-empty',
        name: 'Temp Role',
        isSystem: false,
        _count: { users: 0 },
      });

      const res = await service.deleteRole('role-empty', adminActor);
      expect(res.success).toBe(true);
      expect(prismaMock.unscoped.platformRole.delete).toHaveBeenCalledWith({ where: { id: 'role-empty' } });
      expect(auditServiceMock.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', module: 'platform_role' }),
      );
    });
  });
});
