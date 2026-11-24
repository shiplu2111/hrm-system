import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import type {
  Platform2faResetRequestView,
  PlatformUserDetailedView,
} from '@hrm/shared-types';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { TotpService } from '../auth/totp.service';
import {
  CreatePlatformUserDto,
  InvitePlatformUserDto,
  Request2faResetDto,
  Review2faResetDto,
  UpdatePlatformUserDto,
} from './dto/create-platform-user.dto';

export interface DefaultPlatformRoleDefinition {
  name: string;
  description: string;
  permissions: Array<{ module: string; action: string }>;
}

export interface PlatformActorContext {
  id: string;
  email: string;
  roleName: string;
}

export const DEFAULT_PLATFORM_ROLES: DefaultPlatformRoleDefinition[] = [
  {
    name: 'Platform Owner',
    description: 'Full administrative access across the platform, infrastructure, and governance.',
    permissions: [
      { module: 'platform', action: 'manage' },
      { module: 'tenant', action: 'manage' },
      { module: 'billing', action: 'manage' },
      { module: 'compliance', action: 'manage' },
      { module: 'country', action: 'manage' },
      { module: 'support', action: 'manage' },
      { module: 'audit', action: 'view' },
      { module: 'setting', action: 'manage' },
      { module: 'user', action: 'manage' },
    ],
  },
  {
    name: 'Platform Admin',
    description: 'Day-to-day platform administration, tenant lifecycle, and system maintenance.',
    permissions: [
      { module: 'platform', action: 'view' },
      { module: 'platform', action: 'edit' },
      { module: 'tenant', action: 'view' },
      { module: 'tenant', action: 'create' },
      { module: 'tenant', action: 'edit' },
      { module: 'tenant', action: 'delete' },
      { module: 'tenant', action: 'manage' },
      { module: 'compliance', action: 'view' },
      { module: 'compliance', action: 'edit' },
      { module: 'country', action: 'view' },
      { module: 'country', action: 'edit' },
      { module: 'billing', action: 'view' },
      { module: 'support', action: 'view' },
      { module: 'support', action: 'manage' },
      { module: 'audit', action: 'view' },
      { module: 'setting', action: 'view' },
      { module: 'setting', action: 'edit' },
      { module: 'user', action: 'view' },
      { module: 'user', action: 'create' },
      { module: 'user', action: 'edit' },
    ],
  },
  {
    name: 'Billing Admin',
    description: 'Subscription management, invoicing, plan configuration, and financial operations.',
    permissions: [
      { module: 'billing', action: 'view' },
      { module: 'billing', action: 'create' },
      { module: 'billing', action: 'edit' },
      { module: 'billing', action: 'manage' },
      { module: 'tenant', action: 'view' },
      { module: 'audit', action: 'view' },
      { module: 'platform', action: 'view' },
    ],
  },
  {
    name: 'Support Agent',
    description: 'Customer assistance, ticket resolution, and authorized tenant support views.',
    permissions: [
      { module: 'support', action: 'view' },
      { module: 'support', action: 'manage' },
      { module: 'support', action: 'impersonate' },
      { module: 'tenant', action: 'view' },
      { module: 'platform', action: 'view' },
    ],
  },
  {
    name: 'Compliance Admin',
    description: 'Statutory compliance, country rule packs, tax brackets, and regulatory baselines.',
    permissions: [
      { module: 'compliance', action: 'view' },
      { module: 'compliance', action: 'create' },
      { module: 'compliance', action: 'edit' },
      { module: 'compliance', action: 'manage' },
      { module: 'country', action: 'view' },
      { module: 'country', action: 'create' },
      { module: 'country', action: 'edit' },
      { module: 'country', action: 'manage' },
      { module: 'audit', action: 'view' },
      { module: 'platform', action: 'view' },
    ],
  },
  {
    name: 'Read-Only Auditor',
    description: 'Independent compliance and security auditing across platform operations and logs.',
    permissions: [
      { module: 'audit', action: 'view' },
      { module: 'platform', action: 'view' },
      { module: 'tenant', action: 'view' },
      { module: 'billing', action: 'view' },
      { module: 'compliance', action: 'view' },
      { module: 'country', action: 'view' },
      { module: 'support', action: 'view' },
    ],
  },
];

export const DEMO_PLATFORM_OWNER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'platform.owner@cmsnbd.com',
  firstName: 'Platform',
  lastName: 'Owner',
  password: 'password',
  totpSecret: 'JBSWY3DPEHPK3PXP',
};

@Injectable()
export class PlatformStaffService implements OnModuleInit {
  private readonly logger = new Logger(PlatformStaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fieldEncryption: FieldEncryptionService,
    private readonly totpService: TotpService,
    private readonly auditService: PlatformAuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.seedPlatformOwner();
    } catch (err: any) {
      this.logger.warn(`Failed to seed platform staff: ${err?.message}`);
    }
  }

  async seedDefaultRolesAndPermissions(): Promise<void> {
    for (const def of DEFAULT_PLATFORM_ROLES) {
      const role = await this.prisma.unscoped.platformRole.upsert({
        where: { name: def.name },
        create: {
          name: def.name,
          description: def.description,
          isSystem: true,
        },
        update: {
          description: def.description,
          isSystem: true,
        },
      });

      for (const perm of def.permissions) {
        await this.prisma.unscoped.platformPermission.upsert({
          where: {
            roleId_module_action: {
              roleId: role.id,
              module: perm.module,
              action: perm.action,
            },
          },
          create: {
            roleId: role.id,
            module: perm.module,
            action: perm.action,
          },
          update: {},
        });
      }
    }
  }

  async seedPlatformOwner(): Promise<void> {
    await this.seedDefaultRolesAndPermissions();

    const ownerRole = await this.prisma.unscoped.platformRole.findUnique({
      where: { name: 'Platform Owner' },
    });
    if (!ownerRole) {
      throw new Error('Platform Owner role missing after seed');
    }

    const passwordHash = await bcrypt.hash(DEMO_PLATFORM_OWNER.password, 12);
    const encryptedSecret = this.fieldEncryption.encrypt(DEMO_PLATFORM_OWNER.totpSecret);

    await this.prisma.unscoped.platformUser.upsert({
      where: { email: DEMO_PLATFORM_OWNER.email },
      create: {
        id: DEMO_PLATFORM_OWNER.id,
        email: DEMO_PLATFORM_OWNER.email,
        passwordHash,
        firstName: DEMO_PLATFORM_OWNER.firstName,
        lastName: DEMO_PLATFORM_OWNER.lastName,
        roleId: ownerRole.id,
        isActive: true,
        totpSecretEncrypted: encryptedSecret,
        totpEnabled: true,
      },
      update: {
        passwordHash,
        roleId: ownerRole.id,
        isActive: true,
        totpSecretEncrypted: encryptedSecret,
        totpEnabled: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Seed Compliance Admin for approval workflow testing & operation
    const complianceRole = await this.prisma.unscoped.platformRole.findUnique({
      where: { name: 'Compliance Admin' },
    });
    if (complianceRole) {
      await this.prisma.unscoped.platformUser.upsert({
        where: { email: 'compliance.admin@cmsnbd.com' },
        create: {
          email: 'compliance.admin@cmsnbd.com',
          passwordHash,
          firstName: 'Compliance',
          lastName: 'Admin',
          roleId: complianceRole.id,
          isActive: true,
          totpSecretEncrypted: encryptedSecret,
          totpEnabled: true,
        },
        update: {
          passwordHash,
          roleId: complianceRole.id,
          isActive: true,
          totpSecretEncrypted: encryptedSecret,
          totpEnabled: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    // Seed Platform Admin for independent approval
    const adminRole = await this.prisma.unscoped.platformRole.findUnique({
      where: { name: 'Platform Admin' },
    });
    if (adminRole) {
      await this.prisma.unscoped.platformUser.upsert({
        where: { email: 'platform.admin@cmsnbd.com' },
        create: {
          email: 'platform.admin@cmsnbd.com',
          passwordHash,
          firstName: 'Platform',
          lastName: 'Admin',
          roleId: adminRole.id,
          isActive: true,
          totpSecretEncrypted: encryptedSecret,
          totpEnabled: true,
        },
        update: {
          passwordHash,
          roleId: adminRole.id,
          isActive: true,
          totpSecretEncrypted: encryptedSecret,
          totpEnabled: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }
  }

  async listRoles() {
    return this.prisma.unscoped.platformRole.findMany({
      include: {
        permissions: {
          select: { module: true, action: true },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async listUsers(): Promise<PlatformUserDetailedView[]> {
    const users = await this.prisma.unscoped.platformUser.findMany({
      include: {
        role: {
          include: {
            permissions: {
              select: { module: true, action: true },
            },
          },
        },
        resetRequestsReceived: {
          where: { status: 'pending' },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    return users.map((u) => {
      let status: 'active' | 'invited' | 'deactivated';
      if (!u.isActive) {
        status = 'deactivated';
      } else if (!u.lastLoginAt) {
        status = 'invited';
      } else {
        status = 'active';
      }

      const pendingReset = u.resetRequestsReceived[0];

      return {
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        roleId: u.roleId,
        roleName: u.role.name,
        isActive: u.isActive,
        status,
        totpEnabled: u.totpEnabled,
        totpEnrolled: Boolean(u.totpSecretEncrypted),
        hasPending2faReset: Boolean(pendingReset),
        pending2faResetRequestId: pendingReset?.id ?? null,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        invitedAt: u.invitedAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        permissions: u.role.permissions,
      };
    });
  }

  /**
   * Invites a new platform staff user by email.
   * 2FA secret is purposefully left empty so 2FA enrolment is enforced on first login.
   * Only a Platform Owner can invite or assign a user to the Platform Owner role.
   */
  async inviteUser(input: InvitePlatformUserDto, actor?: PlatformActorContext) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.unscoped.platformUser.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: 'USER_EXISTS',
        message: 'A platform staff user with this email already exists',
      });
    }

    const role = await this.prisma.unscoped.platformRole.findUnique({ where: { id: input.roleId } });
    if (!role) {
      throw new BadRequestException({
        code: 'INVALID_ROLE',
        message: 'Platform role not found',
      });
    }

    // Role Hierarchy Rule: Only Platform Owner can create or assign Platform Owner role
    if (role.name === 'Platform Owner' && actor?.roleName !== 'Platform Owner') {
      throw new ForbiddenException({
        code: 'OWNER_RESTRICTION',
        message: 'Only a Platform Owner can invite or assign the Platform Owner role.',
      });
    }

    const temporaryPassword = input.temporaryPassword?.trim() || 'TempPass123!';
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const user = await this.prisma.unscoped.platformUser.create({
      data: {
        email,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        passwordHash,
        roleId: role.id,
        isActive: true,
        // Enforce 2FA enrollment on first login: secret is null
        totpSecretEncrypted: null,
        totpEnabled: false,
        invitedAt: new Date(),
      },
      include: {
        role: {
          include: {
            permissions: {
              select: { module: true, action: true },
            },
          },
        },
      },
    });

    await this.auditService.log({
      userId: actor?.id ?? null,
      action: 'invite',
      module: 'platform_user',
      recordId: user.id,
      reason: `Invited platform staff user ${user.email} with role ${role.name}`,
      newValue: {
        email: user.email,
        role: role.name,
        invitedAt: user.invitedAt,
        requires2faOnFirstLogin: true,
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: user.roleId,
        roleName: user.role.name,
        isActive: user.isActive,
        status: 'invited' as const,
        totpEnabled: false,
        totpEnrolled: false,
        hasPending2faReset: false,
        pending2faResetRequestId: null,
        lastLoginAt: null,
        invitedAt: user.invitedAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
        permissions: user.role.permissions,
      },
      temporaryPassword,
      requires2faOnFirstLogin: true,
    };
  }

  async createUser(input: CreatePlatformUserDto, actor?: PlatformActorContext) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.unscoped.platformUser.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException({
        code: 'USER_EXISTS',
        message: 'A platform user with this email already exists',
      });
    }

    const role = await this.prisma.unscoped.platformRole.findUnique({ where: { id: input.roleId } });
    if (!role) {
      throw new BadRequestException({
        code: 'INVALID_ROLE',
        message: 'Platform role not found',
      });
    }

    if (role.name === 'Platform Owner' && actor?.roleName !== 'Platform Owner') {
      throw new ForbiddenException({
        code: 'OWNER_RESTRICTION',
        message: 'Only a Platform Owner can create another Platform Owner.',
      });
    }

    const rawPassword = input.password ?? 'password';
    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const totpSecret = this.totpService.generateSecret();
    const totpSecretEncrypted = this.fieldEncryption.encrypt(totpSecret);

    const user = await this.prisma.unscoped.platformUser.create({
      data: {
        email,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        passwordHash,
        roleId: role.id,
        isActive: true,
        totpSecretEncrypted,
        totpEnabled: true,
      },
      include: {
        role: {
          include: {
            permissions: {
              select: { module: true, action: true },
            },
          },
        },
      },
    });

    await this.auditService.log({
      userId: actor?.id ?? null,
      action: 'create',
      module: 'platform_user',
      recordId: user.id,
      newValue: { email: user.email, role: role.name },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: user.roleId,
        roleName: user.role.name,
        isActive: user.isActive,
        status: 'active' as const,
        totpEnabled: user.totpEnabled,
        totpEnrolled: true,
        hasPending2faReset: false,
        pending2faResetRequestId: null,
        lastLoginAt: null,
        invitedAt: null,
        createdAt: user.createdAt.toISOString(),
        permissions: user.role.permissions,
      },
      totpSetup: {
        secret: totpSecret,
        qrUri: this.totpService.generateKeyUri(user.email, totpSecret),
      },
    };
  }

  async updateUser(
    id: string,
    input: UpdatePlatformUserDto,
    actor?: PlatformActorContext,
  ) {
    const user = await this.prisma.unscoped.platformUser.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Platform user not found',
      });
    }

    // Role Hierarchy Rule: Only Platform Owner can modify a Platform Owner
    if (user.role.name === 'Platform Owner' && actor?.roleName !== 'Platform Owner') {
      throw new ForbiddenException({
        code: 'OWNER_RESTRICTION',
        message: 'Only a Platform Owner can modify another Platform Owner.',
      });
    }

    if (input.roleId) {
      const newRole = await this.prisma.unscoped.platformRole.findUnique({ where: { id: input.roleId } });
      if (!newRole) {
        throw new BadRequestException({
          code: 'INVALID_ROLE',
          message: 'Platform role not found',
        });
      }

      if (newRole.name === 'Platform Owner' && actor?.roleName !== 'Platform Owner') {
        throw new ForbiddenException({
          code: 'OWNER_RESTRICTION',
          message: 'Only a Platform Owner can promote a user to Platform Owner.',
        });
      }

      // If demoting from Platform Owner, ensure at least one active Platform Owner remains
      if (user.role.name === 'Platform Owner' && newRole.name !== 'Platform Owner') {
        const activeOwnersCount = await this.prisma.unscoped.platformUser.count({
          where: { role: { name: 'Platform Owner' }, isActive: true },
        });
        if (activeOwnersCount <= 1) {
          throw new BadRequestException({
            code: 'LAST_OWNER_PROTECTION',
            message: 'Cannot demote the last remaining active Platform Owner.',
          });
        }
      }
    }

    // Deactivation handling if requested through updateUser
    if (input.isActive === false) {
      if (actor && actor.id === id) {
        throw new BadRequestException({
          code: 'CANNOT_DEACTIVATE_SELF',
          message: 'You cannot deactivate your own account.',
        });
      }
      if (user.role.name === 'Platform Owner') {
        const activeOwnersCount = await this.prisma.unscoped.platformUser.count({
          where: { role: { name: 'Platform Owner' }, isActive: true },
        });
        if (activeOwnersCount <= 1) {
          throw new BadRequestException({
            code: 'LAST_OWNER_PROTECTION',
            message: 'Cannot deactivate the last remaining active Platform Owner.',
          });
        }
      }
      // Revoke all active sessions immediately
      await this.prisma.unscoped.platformSession.updateMany({
        where: { userId: id, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    const updated = await this.prisma.unscoped.platformUser.update({
      where: { id },
      data: {
        ...(input.roleId ? { roleId: input.roleId } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.firstName ? { firstName: input.firstName.trim() } : {}),
        ...(input.lastName ? { lastName: input.lastName.trim() } : {}),
      },
      include: {
        role: {
          include: {
            permissions: { select: { module: true, action: true } },
          },
        },
      },
    });

    await this.auditService.log({
      userId: actor?.id ?? null,
      action: 'update',
      module: 'platform_user',
      recordId: id,
      oldValue: { roleId: user.roleId, isActive: user.isActive },
      newValue: { roleId: updated.roleId, isActive: updated.isActive },
    });

    let status: 'active' | 'invited' | 'deactivated';
    if (!updated.isActive) {
      status = 'deactivated';
    } else if (!updated.lastLoginAt) {
      status = 'invited';
    } else {
      status = 'active';
    }

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      roleId: updated.roleId,
      roleName: updated.role.name,
      isActive: updated.isActive,
      status,
      totpEnabled: updated.totpEnabled,
      totpEnrolled: Boolean(updated.totpSecretEncrypted),
      hasPending2faReset: false,
      pending2faResetRequestId: null,
      lastLoginAt: updated.lastLoginAt?.toISOString() ?? null,
      invitedAt: updated.invitedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      permissions: updated.role.permissions,
    };
  }

  /**
   * Deactivates a platform staff user.
   * Immediately revokes all active sessions for that user.
   * Only a Platform Owner can deactivate another Platform Owner.
   * Protects the last remaining active Platform Owner.
   */
  async deactivateUser(id: string, actor: PlatformActorContext) {
    if (id === actor.id) {
      throw new BadRequestException({
        code: 'CANNOT_DEACTIVATE_SELF',
        message: 'You cannot deactivate your own account.',
      });
    }

    const targetUser = await this.prisma.unscoped.platformUser.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!targetUser) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Platform user not found',
      });
    }

    if (targetUser.role.name === 'Platform Owner' && actor.roleName !== 'Platform Owner') {
      throw new ForbiddenException({
        code: 'OWNER_RESTRICTION',
        message: 'Only a Platform Owner can deactivate another Platform Owner.',
      });
    }

    if (targetUser.role.name === 'Platform Owner') {
      const activeOwnersCount = await this.prisma.unscoped.platformUser.count({
        where: { role: { name: 'Platform Owner' }, isActive: true },
      });
      if (activeOwnersCount <= 1) {
        throw new BadRequestException({
          code: 'LAST_OWNER_PROTECTION',
          message: 'Cannot deactivate the last remaining active Platform Owner.',
        });
      }
    }

    // Set isActive to false
    const updated = await this.prisma.unscoped.platformUser.update({
      where: { id },
      data: { isActive: false },
      include: {
        role: {
          include: {
            permissions: { select: { module: true, action: true } },
          },
        },
      },
    });

    // Immediately revoke all sessions for this user
    const revokedSessions = await this.prisma.unscoped.platformSession.updateMany({
      where: { userId: id, isRevoked: false },
      data: { isRevoked: true },
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'deactivate',
      module: 'platform_user',
      recordId: id,
      reason: `Deactivated platform staff user ${targetUser.email} and revoked ${revokedSessions.count} active sessions`,
      oldValue: { isActive: true },
      newValue: { isActive: false, revokedSessionCount: revokedSessions.count },
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      roleId: updated.roleId,
      roleName: updated.role.name,
      isActive: false,
      status: 'deactivated' as const,
      totpEnabled: updated.totpEnabled,
      totpEnrolled: Boolean(updated.totpSecretEncrypted),
      hasPending2faReset: false,
      pending2faResetRequestId: null,
      lastLoginAt: updated.lastLoginAt?.toISOString() ?? null,
      invitedAt: updated.invitedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      permissions: updated.role.permissions,
      revokedSessionCount: revokedSessions.count,
    };
  }

  /**
   * Reactivates a deactivated platform staff user.
   * Only a Platform Owner can reactivate another Platform Owner.
   */
  async reactivateUser(id: string, actor: PlatformActorContext) {
    const targetUser = await this.prisma.unscoped.platformUser.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!targetUser) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Platform user not found',
      });
    }

    if (targetUser.role.name === 'Platform Owner' && actor.roleName !== 'Platform Owner') {
      throw new ForbiddenException({
        code: 'OWNER_RESTRICTION',
        message: 'Only a Platform Owner can reactivate a Platform Owner.',
      });
    }

    const updated = await this.prisma.unscoped.platformUser.update({
      where: { id },
      data: { isActive: true },
      include: {
        role: {
          include: {
            permissions: { select: { module: true, action: true } },
          },
        },
      },
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'reactivate',
      module: 'platform_user',
      recordId: id,
      reason: `Reactivated platform staff user ${targetUser.email}`,
      oldValue: { isActive: false },
      newValue: { isActive: true },
    });

    let status: 'active' | 'invited' | 'deactivated';
    if (!updated.lastLoginAt) {
      status = 'invited';
    } else {
      status = 'active';
    }

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      roleId: updated.roleId,
      roleName: updated.role.name,
      isActive: true,
      status,
      totpEnabled: updated.totpEnabled,
      totpEnrolled: Boolean(updated.totpSecretEncrypted),
      hasPending2faReset: false,
      pending2faResetRequestId: null,
      lastLoginAt: updated.lastLoginAt?.toISOString() ?? null,
      invitedAt: updated.invitedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      permissions: updated.role.permissions,
    };
  }

  /**
   * Submits a request to reset a staff user's 2FA.
   * Requires another admin to review and approve (dual control).
   * Only a Platform Owner can request 2FA reset for another Platform Owner.
   */
  async request2faReset(targetUserId: string, input: Request2faResetDto, actor: PlatformActorContext): Promise<Platform2faResetRequestView> {
    const targetUser = await this.prisma.unscoped.platformUser.findUnique({
      where: { id: targetUserId },
      include: { role: true },
    });
    if (!targetUser) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Target platform user not found',
      });
    }

    if (!targetUser.totpSecretEncrypted) {
      throw new BadRequestException({
        code: 'NO_2FA_ENROLLED',
        message: 'This user does not currently have 2FA enrolled.',
      });
    }

    if (targetUser.role.name === 'Platform Owner' && actor.roleName !== 'Platform Owner') {
      throw new ForbiddenException({
        code: 'OWNER_RESTRICTION',
        message: 'Only a Platform Owner can request a 2FA reset for a Platform Owner.',
      });
    }

    // Check if there is already a pending reset request for this user
    const existingPending = await this.prisma.unscoped.platform2faResetRequest.findFirst({
      where: { targetUserId, status: 'pending' },
    });
    if (existingPending) {
      throw new ConflictException({
        code: 'PENDING_RESET_EXISTS',
        message: 'A 2FA reset request is already pending approval for this user.',
      });
    }

    const resetRequest = await this.prisma.unscoped.platform2faResetRequest.create({
      data: {
        targetUserId,
        requestedBy: actor.id,
        reason: input.reason.trim(),
        status: 'pending',
      },
      include: {
        targetUser: {
          select: { email: true, firstName: true, lastName: true, role: { select: { name: true } } },
        },
        requester: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'request_2fa_reset',
      module: 'platform_user',
      recordId: resetRequest.id,
      reason: `2FA reset requested for ${targetUser.email}: ${input.reason.trim()}`,
      newValue: {
        targetUserId,
        targetEmail: targetUser.email,
        requestedBy: actor.id,
        reason: input.reason.trim(),
      },
    });

    return {
      id: resetRequest.id,
      targetUserId: resetRequest.targetUserId,
      targetUserEmail: resetRequest.targetUser.email,
      targetUserName: `${resetRequest.targetUser.firstName} ${resetRequest.targetUser.lastName}`.trim(),
      targetUserRole: resetRequest.targetUser.role.name,
      requestedBy: resetRequest.requestedBy,
      requesterEmail: resetRequest.requester.email,
      requesterName: `${resetRequest.requester.firstName} ${resetRequest.requester.lastName}`.trim(),
      reason: resetRequest.reason,
      status: 'pending',
      reviewedBy: null,
      reviewerEmail: null,
      reviewerName: null,
      reviewedAt: null,
      reviewReason: null,
      createdAt: resetRequest.createdAt.toISOString(),
      updatedAt: resetRequest.updatedAt.toISOString(),
    };
  }

  /**
   * Lists all 2FA reset requests with requester, reviewer, and target user details.
   */
  async list2faResetRequests(): Promise<Platform2faResetRequestView[]> {
    const requests = await this.prisma.unscoped.platform2faResetRequest.findMany({
      include: {
        targetUser: {
          select: { id: true, email: true, firstName: true, lastName: true, role: { select: { name: true } } },
        },
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        reviewer: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return requests.map((r) => ({
      id: r.id,
      targetUserId: r.targetUserId,
      targetUserEmail: r.targetUser.email,
      targetUserName: `${r.targetUser.firstName} ${r.targetUser.lastName}`.trim(),
      targetUserRole: r.targetUser.role.name,
      requestedBy: r.requestedBy,
      requesterEmail: r.requester.email,
      requesterName: `${r.requester.firstName} ${r.requester.lastName}`.trim(),
      reason: r.reason,
      status: r.status,
      reviewedBy: r.reviewedBy,
      reviewerEmail: r.reviewer?.email ?? null,
      reviewerName: r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}`.trim() : null,
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
      reviewReason: r.reviewReason,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /**
   * Reviews a pending 2FA reset request.
   * ENFORCES FOUR-EYES PRINCIPLE: Another admin must approve; requester cannot self-approve.
   * If approved: Clears target user's TOTP secret and immediately revokes all their sessions.
   * Only a Platform Owner can review a request for another Platform Owner.
   */
  async review2faReset(
    requestId: string,
    input: Review2faResetDto,
    actor: PlatformActorContext,
  ): Promise<Platform2faResetRequestView> {
    const reqRecord = await this.prisma.unscoped.platform2faResetRequest.findUnique({
      where: { id: requestId },
      include: {
        targetUser: {
          include: { role: true },
        },
        requester: true,
      },
    });

    if (!reqRecord) {
      throw new NotFoundException({
        code: 'REQUEST_NOT_FOUND',
        message: '2FA reset request not found',
      });
    }

    if (reqRecord.status !== 'pending') {
      throw new BadRequestException({
        code: 'ALREADY_REVIEWED',
        message: `This 2FA reset request has already been ${reqRecord.status}`,
      });
    }

    // FOUR-EYES / DUAL CONTROL PRINCIPLE ENFORCEMENT
    if (reqRecord.requestedBy === actor.id) {
      throw new ForbiddenException({
        code: 'DUAL_CONTROL_REQUIRED',
        message:
          'Dual control required: you cannot approve your own 2FA reset request. Another administrator must approve it.',
      });
    }

    // Role Hierarchy Rule: Only Platform Owner can approve 2FA reset for Platform Owner
    if (reqRecord.targetUser.role.name === 'Platform Owner' && actor.roleName !== 'Platform Owner') {
      throw new ForbiddenException({
        code: 'OWNER_RESTRICTION',
        message: 'Only a Platform Owner can approve a 2FA reset request for a Platform Owner.',
      });
    }

    const now = new Date();
    const reviewReason = input.reviewReason?.trim() || (input.action === 'approve' ? 'Approved by administrator' : 'Rejected by administrator');

    if (input.action === 'approve') {
      // Clear 2FA on target user
      await this.prisma.unscoped.platformUser.update({
        where: { id: reqRecord.targetUserId },
        data: {
          totpSecretEncrypted: null,
          totpEnabled: false,
        },
      });

      // Revoke all active sessions immediately so user must re-authenticate and re-enroll
      await this.prisma.unscoped.platformSession.updateMany({
        where: { userId: reqRecord.targetUserId, isRevoked: false },
        data: { isRevoked: true },
      });

      const updated = await this.prisma.unscoped.platform2faResetRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          reviewedBy: actor.id,
          reviewedAt: now,
          reviewReason,
        },
        include: {
          targetUser: { select: { email: true, firstName: true, lastName: true, role: { select: { name: true } } } },
          requester: { select: { email: true, firstName: true, lastName: true } },
          reviewer: { select: { email: true, firstName: true, lastName: true } },
        },
      });

      await this.auditService.log({
        userId: actor.id,
        action: 'approve_2fa_reset',
        module: 'platform_user',
        recordId: requestId,
        reason: `2FA reset APPROVED for ${reqRecord.targetUser.email} (requested by ${reqRecord.requester.email}). All sessions revoked. Re-enrollment required on next login.`,
        oldValue: { status: 'pending' },
        newValue: {
          status: 'approved',
          reviewedBy: actor.id,
          reviewerEmail: actor.email,
          reviewReason,
        },
      });

      return {
        id: updated.id,
        targetUserId: updated.targetUserId,
        targetUserEmail: updated.targetUser.email,
        targetUserName: `${updated.targetUser.firstName} ${updated.targetUser.lastName}`.trim(),
        targetUserRole: updated.targetUser.role.name,
        requestedBy: updated.requestedBy,
        requesterEmail: updated.requester.email,
        requesterName: `${updated.requester.firstName} ${updated.requester.lastName}`.trim(),
        reason: updated.reason,
        status: 'approved',
        reviewedBy: updated.reviewedBy,
        reviewerEmail: updated.reviewer?.email ?? null,
        reviewerName: updated.reviewer ? `${updated.reviewer.firstName} ${updated.reviewer.lastName}`.trim() : null,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
        reviewReason: updated.reviewReason,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    } else {
      const updated = await this.prisma.unscoped.platform2faResetRequest.update({
        where: { id: requestId },
        data: {
          status: 'rejected',
          reviewedBy: actor.id,
          reviewedAt: now,
          reviewReason,
        },
        include: {
          targetUser: { select: { email: true, firstName: true, lastName: true, role: { select: { name: true } } } },
          requester: { select: { email: true, firstName: true, lastName: true } },
          reviewer: { select: { email: true, firstName: true, lastName: true } },
        },
      });

      await this.auditService.log({
        userId: actor.id,
        action: 'reject_2fa_reset',
        module: 'platform_user',
        recordId: requestId,
        reason: `2FA reset REJECTED for ${reqRecord.targetUser.email}. Reason: ${reviewReason}`,
        oldValue: { status: 'pending' },
        newValue: {
          status: 'rejected',
          reviewedBy: actor.id,
          reviewerEmail: actor.email,
          reviewReason,
        },
      });

      return {
        id: updated.id,
        targetUserId: updated.targetUserId,
        targetUserEmail: updated.targetUser.email,
        targetUserName: `${updated.targetUser.firstName} ${updated.targetUser.lastName}`.trim(),
        targetUserRole: updated.targetUser.role.name,
        requestedBy: updated.requestedBy,
        requesterEmail: updated.requester.email,
        requesterName: `${updated.requester.firstName} ${updated.requester.lastName}`.trim(),
        reason: updated.reason,
        status: 'rejected',
        reviewedBy: updated.reviewedBy,
        reviewerEmail: updated.reviewer?.email ?? null,
        reviewerName: updated.reviewer ? `${updated.reviewer.firstName} ${updated.reviewer.lastName}`.trim() : null,
        reviewedAt: updated.reviewedAt?.toISOString() ?? null,
        reviewReason: updated.reviewReason,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      };
    }
  }
}
