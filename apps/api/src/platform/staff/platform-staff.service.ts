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
import {
  ActiveOwnerCheckResult,
  Platform2faResetRequestView,
  PlatformPermissionDefinition,
  PlatformRoleRecord,
  PlatformSecurityStats,
  PlatformStaffLoginHistoryView,
  PlatformStaffSessionView,
  PlatformUserDetailedView,
  PLATFORM_PERMISSION_DEFINITIONS,
  RevokeSessionResult,
  RevokeUserSessionsResult,
} from '@hrm/shared-types';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { TotpService } from '../auth/totp.service';
import {
  CreatePlatformRoleDto,
  CreatePlatformUserDto,
  InvitePlatformUserDto,
  PlatformLoginHistoryFilterDto,
  PlatformSessionFilterDto,
  Request2faResetDto,
  Review2faResetDto,
  UpdatePlatformRoleDto,
  UpdatePlatformUserDto,
} from './dto/create-platform-user.dto';
import {
  assessUnusualLocation,
  determinePlatform2faResult,
  parsePlatformUserAgent,
  resolvePlatformIpLocation,
} from './helpers/platform-geo-device.helper';

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

  /**
   * Returns available platform permission module and action definitions (matrix template).
   */
  getRoleDefinitions(): PlatformPermissionDefinition[] {
    return PLATFORM_PERMISSION_DEFINITIONS;
  }

  /**
   * Checks the active Platform Owner status and returns an advisory warning
   * when active owners count is <= 1 (Last Active Owner Protection).
   */
  async getActiveOwnerStatus(): Promise<ActiveOwnerCheckResult> {
    const [activeOwnerCount, totalOwnerCount] = await Promise.all([
      this.prisma.unscoped.platformUser.count({
        where: { role: { name: 'Platform Owner' }, isActive: true },
      }),
      this.prisma.unscoped.platformUser.count({
        where: { role: { name: 'Platform Owner' } },
      }),
    ]);
    const isAtRisk = activeOwnerCount <= 1;
    return {
      activeOwnerCount,
      totalOwnerCount,
      isAtRisk,
      warningMessage: isAtRisk
        ? 'High Governance Risk: Only 1 active Platform Owner account exists. Any demotion or deactivation would leave zero active Platform Owners with root governance access.'
        : null,
    };
  }

  /**
   * Lists all platform roles, user counts, active user counts, and permissions.
   */
  async listRoles(): Promise<PlatformRoleRecord[]> {
    const roles = await this.prisma.unscoped.platformRole.findMany({
      include: {
        permissions: {
          select: { module: true, action: true },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    const activeUserCounts = await this.prisma.unscoped.platformUser.groupBy({
      by: ['roleId'],
      where: { isActive: true },
      _count: { id: true },
    });
    const activeMap = new Map(activeUserCounts.map((a) => [a.roleId, a._count.id]));

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions,
      userCount: r._count.users,
      activeUserCount: activeMap.get(r.id) ?? 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /**
   * Retrieves single platform role by ID.
   */
  async getRole(id: string): Promise<PlatformRoleRecord> {
    const r = await this.prisma.unscoped.platformRole.findUnique({
      where: { id },
      include: {
        permissions: { select: { module: true, action: true } },
        _count: { select: { users: true } },
      },
    });
    if (!r) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Platform role not found',
      });
    }
    const activeUserCount = await this.prisma.unscoped.platformUser.count({
      where: { roleId: id, isActive: true },
    });
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions,
      userCount: r._count.users,
      activeUserCount,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  /**
   * Creates a new custom platform role with permission matrix grants.
   * Only Platform Owner can create roles with user:manage or platform:manage.
   */
  async createRole(input: CreatePlatformRoleDto, actor: PlatformActorContext): Promise<PlatformRoleRecord> {
    const name = input.name.trim();
    const existing = await this.prisma.unscoped.platformRole.findUnique({ where: { name } });
    if (existing) {
      throw new ConflictException({
        code: 'ROLE_EXISTS',
        message: `A platform role with name '${name}' already exists`,
      });
    }

    // Role Hierarchy Rule: Only Platform Owner can grant root management permissions
    const grantsApex = input.permissions.some(
      (p) => (p.module === 'user' || p.module === 'platform') && p.action === 'manage',
    );
    if (grantsApex && actor.roleName !== 'Platform Owner') {
      throw new ForbiddenException({
        code: 'OWNER_RESTRICTION',
        message: 'Only a Platform Owner can grant user:manage or platform:manage permissions.',
      });
    }

    const created = await this.prisma.unscoped.platformRole.create({
      data: {
        name,
        description: input.description?.trim() || null,
        isSystem: false,
        permissions: {
          createMany: {
            data: input.permissions.map((p) => ({
              module: p.module.trim().toLowerCase(),
              action: p.action.trim().toLowerCase(),
            })),
            skipDuplicates: true,
          },
        },
      },
      include: {
        permissions: { select: { module: true, action: true } },
        _count: { select: { users: true } },
      },
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'create',
      module: 'platform_role',
      recordId: created.id,
      reason: `Created platform role '${created.name}' with ${created.permissions.length} permission grants`,
      newValue: {
        name: created.name,
        description: created.description,
        permissions: created.permissions,
      },
    });

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      isSystem: created.isSystem,
      permissions: created.permissions,
      userCount: created._count.users,
      activeUserCount: 0,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * Updates an existing platform role and its permission matrix.
   * Warns and protects against changes that would leave zero active Platform Owners.
   */
  async updateRole(id: string, input: UpdatePlatformRoleDto, actor: PlatformActorContext): Promise<PlatformRoleRecord> {
    const role = await this.prisma.unscoped.platformRole.findUnique({
      where: { id },
      include: {
        permissions: { select: { module: true, action: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Platform role not found',
      });
    }

    // Role Hierarchy & Last Active Owner Protection:
    if (role.name === 'Platform Owner') {
      if (input.name && input.name.trim() !== 'Platform Owner') {
        throw new BadRequestException({
          code: 'CANNOT_RENAME_OWNER_ROLE',
          message: 'The Platform Owner system role cannot be renamed.',
        });
      }

      if (actor.roleName !== 'Platform Owner') {
        throw new ForbiddenException({
          code: 'OWNER_RESTRICTION',
          message: 'Only a Platform Owner can edit permissions on the Platform Owner role.',
        });
      }

      if (input.permissions) {
        // Platform Owner MUST retain root platform:manage and user:manage permissions
        const hasPlatformManage = input.permissions.some(
          (p) => p.module === 'platform' && p.action === 'manage',
        );
        const hasUserManage = input.permissions.some(
          (p) => p.module === 'user' && p.action === 'manage',
        );

        if (!hasPlatformManage || !hasUserManage) {
          throw new BadRequestException({
            code: 'CANNOT_STRIP_OWNER_PERMISSIONS',
            message:
              'Cannot save changes: Stripping platform:manage or user:manage from Platform Owner would compromise root governance. At least one active Platform Owner with full management access must remain.',
          });
        }
      }
    }

    if (input.name && input.name.trim() !== role.name) {
      if (role.isSystem) {
        throw new BadRequestException({
          code: 'CANNOT_RENAME_SYSTEM_ROLE',
          message: 'System platform roles cannot be renamed.',
        });
      }
      const conflict = await this.prisma.unscoped.platformRole.findUnique({
        where: { name: input.name.trim() },
      });
      if (conflict) {
        throw new ConflictException({
          code: 'ROLE_EXISTS',
          message: `A platform role with name '${input.name.trim()}' already exists`,
        });
      }
    }

    if (input.permissions) {
      const grantsApex = input.permissions.some(
        (p) => (p.module === 'user' || p.module === 'platform') && p.action === 'manage',
      );
      if (grantsApex && actor.roleName !== 'Platform Owner') {
        throw new ForbiddenException({
          code: 'OWNER_RESTRICTION',
          message: 'Only a Platform Owner can grant user:manage or platform:manage permissions.',
        });
      }
    }

    await this.prisma.unscoped.$transaction(async (tx) => {
      if (input.permissions) {
        await tx.platformPermission.deleteMany({ where: { roleId: id } });
        if (input.permissions.length > 0) {
          await tx.platformPermission.createMany({
            data: input.permissions.map((p) => ({
              roleId: id,
              module: p.module.trim().toLowerCase(),
              action: p.action.trim().toLowerCase(),
            })),
            skipDuplicates: true,
          });
        }
      }

      await tx.platformRole.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        },
      });
    });

    const updated = await this.prisma.unscoped.platformRole.findUniqueOrThrow({
      where: { id },
      include: {
        permissions: { select: { module: true, action: true } },
        _count: { select: { users: true } },
      },
    });

    const activeUserCount = await this.prisma.unscoped.platformUser.count({
      where: { roleId: id, isActive: true },
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'update',
      module: 'platform_role',
      recordId: id,
      reason: `Updated platform role '${updated.name}' (permissions: ${updated.permissions.length})`,
      oldValue: { name: role.name, description: role.description, permissionCount: role.permissions.length },
      newValue: { name: updated.name, description: updated.description, permissionCount: updated.permissions.length },
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      isSystem: updated.isSystem,
      permissions: updated.permissions,
      userCount: updated._count.users,
      activeUserCount,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Deletes a custom platform role.
   * System roles and roles with active assigned users cannot be deleted.
   */
  async deleteRole(id: string, actor: PlatformActorContext): Promise<{ success: boolean; id: string }> {
    const role = await this.prisma.unscoped.platformRole.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
      },
    });
    if (!role) {
      throw new NotFoundException({
        code: 'ROLE_NOT_FOUND',
        message: 'Platform role not found',
      });
    }

    if (role.isSystem) {
      throw new BadRequestException({
        code: 'CANNOT_DELETE_SYSTEM_ROLE',
        message: 'System platform roles cannot be deleted.',
      });
    }

    if (role._count.users > 0) {
      throw new BadRequestException({
        code: 'ROLE_IN_USE',
        message: `Cannot delete role '${role.name}' because it is assigned to ${role._count.users} staff user(s). Reassign them first.`,
      });
    }

    await this.prisma.unscoped.platformRole.delete({ where: { id } });

    await this.auditService.log({
      userId: actor.id,
      action: 'delete',
      module: 'platform_role',
      recordId: id,
      reason: `Deleted custom platform role '${role.name}'`,
      oldValue: { name: role.name, description: role.description },
    });

    return { success: true, id };
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

  /**
   * List all platform staff active and historical sessions, enriched with parsed device and unusual location telemetry.
   */
  async listStaffSessions(
    filter?: PlatformSessionFilterDto,
    actor?: PlatformActorContext,
  ): Promise<PlatformStaffSessionView[]> {
    const now = new Date();
    const where: any = {};

    if (filter?.userId) {
      where.userId = filter.userId;
    }

    if (filter?.status === 'active') {
      where.isRevoked = false;
      where.expiresAt = { gt: now };
    } else if (filter?.status === 'revoked') {
      where.isRevoked = true;
    } else if (filter?.status === 'expired') {
      where.isRevoked = false;
      where.expiresAt = { lte: now };
    }

    if (filter?.search) {
      const q = filter.search.trim();
      where.OR = [
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { firstName: { contains: q, mode: 'insensitive' } } },
        { user: { lastName: { contains: q, mode: 'insensitive' } } },
        { ipAddress: { contains: q } },
      ];
    }

    const sessions = await this.prisma.unscoped.platformSession.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: { select: { name: true } },
            loginHistory: {
              where: { status: 'success' },
              select: { ipAddress: true, createdAt: true, status: true },
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          },
        },
      },
      orderBy: [{ isRevoked: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });

    const views: PlatformStaffSessionView[] = sessions.map((s) => {
      const parsedDevice = parsePlatformUserAgent(s.userAgent);
      const location = resolvePlatformIpLocation(s.ipAddress);
      const anomaly = assessUnusualLocation(s.ipAddress, s.createdAt, s.user.loginHistory);

      return {
        id: s.id,
        userId: s.userId,
        userName: `${s.user.firstName} ${s.user.lastName}`.trim(),
        userEmail: s.user.email,
        userRoleName: s.user.role.name,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        device: parsedDevice.device,
        browser: parsedDevice.browser,
        os: parsedDevice.os,
        location: location.location,
        country: location.country,
        city: location.city,
        countryCode: location.countryCode,
        isUnusualLocation: anomaly.isUnusual,
        unusualLocationReason: anomaly.reason,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        isRevoked: s.isRevoked,
        isCurrent: Boolean(actor && actor.id === s.userId && !s.isRevoked && s.expiresAt > now),
      };
    });

    if (filter?.unusualOnly) {
      return views.filter((v) => v.isUnusualLocation);
    }

    return views;
  }

  /**
   * Revoke any staff session by session ID with role-hierarchy governance.
   */
  async revokeStaffSession(
    sessionId: string,
    actor: PlatformActorContext,
    ip?: string,
    userAgent?: string,
  ): Promise<RevokeSessionResult> {
    const session = await this.prisma.unscoped.platformSession.findUnique({
      where: { id: sessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: { select: { name: true } },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Platform staff session not found',
      });
    }

    // Role Hierarchy Rule: Only Platform Owner can revoke another Platform Owner's session
    if (session.user.role.name === 'Platform Owner' && actor.roleName !== 'Platform Owner') {
      throw new ForbiddenException({
        code: 'OWNER_RESTRICTION',
        message: 'Only a Platform Owner can revoke an active session belonging to another Platform Owner.',
      });
    }

    if (session.isRevoked) {
      return {
        success: true,
        sessionId,
        isRevoked: true,
        message: 'Session was already revoked',
      };
    }

    await this.prisma.unscoped.platformSession.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'revoke_session',
      module: 'platform_session',
      recordId: sessionId,
      reason: `Revoked active session for staff member ${session.user.email} (${session.user.role.name})`,
      oldValue: { isRevoked: false },
      newValue: { isRevoked: true, revokedBy: actor.email },
      ipAddress: ip,
      userAgent,
    });

    return {
      success: true,
      sessionId,
      isRevoked: true,
      message: `Session revoked successfully for ${session.user.email}.`,
    };
  }

  /**
   * Revoke all active sessions for a staff member.
   */
  async revokeAllStaffSessions(
    userId: string,
    actor: PlatformActorContext,
    ip?: string,
    userAgent?: string,
  ): Promise<RevokeUserSessionsResult> {
    const user = await this.prisma.unscoped.platformUser.findUnique({
      where: { id: userId },
      include: { role: { select: { name: true } } },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Platform staff user not found',
      });
    }

    // Role Hierarchy Rule: Only Platform Owner can revoke a Platform Owner's sessions
    if (user.role.name === 'Platform Owner' && actor.roleName !== 'Platform Owner') {
      throw new ForbiddenException({
        code: 'OWNER_RESTRICTION',
        message: 'Only a Platform Owner can revoke all sessions for another Platform Owner.',
      });
    }

    const activeSessionsCount = await this.prisma.unscoped.platformSession.count({
      where: { userId, isRevoked: false },
    });

    await this.prisma.unscoped.platformSession.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'revoke_all_sessions',
      module: 'platform_session',
      recordId: userId,
      reason: `Revoked all (${activeSessionsCount}) active sessions for ${user.email} (${user.role.name})`,
      newValue: { revokedCount: activeSessionsCount, targetUserId: userId },
      ipAddress: ip,
      userAgent,
    });

    return {
      success: true,
      userId,
      revokedCount: activeSessionsCount,
      message: `Successfully revoked all ${activeSessionsCount} active session(s) for ${user.email}.`,
    };
  }

  /**
   * List all staff logins, complete with IP, device, success/failure, 2FA result, and unusual location flags.
   */
  async listStaffLoginHistory(
    filter?: PlatformLoginHistoryFilterDto,
    actor?: PlatformActorContext,
  ): Promise<{ items: PlatformStaffLoginHistoryView[]; total: number; unusualCount: number }> {
    const where: any = {};

    if (filter?.userId) {
      where.userId = filter.userId;
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.search) {
      const q = filter.search.trim();
      where.OR = [
        { email: { contains: q, mode: 'insensitive' } },
        { user: { firstName: { contains: q, mode: 'insensitive' } } },
        { user: { lastName: { contains: q, mode: 'insensitive' } } },
        { ipAddress: { contains: q } },
      ];
    }

    const take = filter?.limit ?? 100;
    const skip = filter?.offset ?? (filter?.page ? Math.max(0, filter.page - 1) * take : 0);

    const [records, total] = await Promise.all([
      this.prisma.unscoped.platformLoginHistory.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: { select: { name: true } },
              loginHistory: {
                where: { status: 'success' },
                select: { ipAddress: true, createdAt: true, status: true },
                orderBy: { createdAt: 'desc' },
                take: 20,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.unscoped.platformLoginHistory.count({ where }),
    ]);

    let unusualCount = 0;
    const items: PlatformStaffLoginHistoryView[] = records.map((r) => {
      const parsedDevice = parsePlatformUserAgent(r.userAgent);
      const loc = resolvePlatformIpLocation(r.ipAddress);
      const anomaly = assessUnusualLocation(r.ipAddress, r.createdAt, r.user?.loginHistory ?? []);
      const twoFactorResult = determinePlatform2faResult(r.status, r.failureReason);

      if (anomaly.isUnusual) {
        unusualCount++;
      }

      return {
        id: r.id,
        userId: r.userId,
        userName: r.user ? `${r.user.firstName} ${r.user.lastName}`.trim() : undefined,
        email: r.email,
        userRoleName: r.user?.role?.name,
        status: r.status as any,
        failureReason: r.failureReason,
        twoFactorResult,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        device: parsedDevice.device,
        browser: parsedDevice.browser,
        os: parsedDevice.os,
        location: loc.location,
        country: loc.country,
        city: loc.city,
        countryCode: loc.countryCode,
        isUnusualLocation: anomaly.isUnusual,
        unusualLocationReason: anomaly.reason,
        createdAt: r.createdAt.toISOString(),
      };
    });

    const filteredItems = filter?.unusualOnly ? items.filter((i) => i.isUnusualLocation) : items;

    return {
      items: filteredItems,
      total: filter?.unusualOnly ? filteredItems.length : total,
      unusualCount,
    };
  }

  /**
   * Aggregate security stats: active sessions, 24h logins, unusual location flags.
   */
  async getSecurityStats(): Promise<PlatformSecurityStats> {
    const now = new Date();
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [activeSessions, totalLogins24h, failedLogins24h] = await Promise.all([
      this.prisma.unscoped.platformSession.findMany({
        where: { isRevoked: false, expiresAt: { gt: now } },
        include: {
          user: {
            select: {
              loginHistory: {
                where: { status: 'success' },
                select: { ipAddress: true, createdAt: true, status: true },
                orderBy: { createdAt: 'desc' },
                take: 15,
              },
            },
          },
        },
      }),
      this.prisma.unscoped.platformLoginHistory.count({
        where: { createdAt: { gte: past24h } },
      }),
      this.prisma.unscoped.platformLoginHistory.count({
        where: { createdAt: { gte: past24h }, status: { not: 'success' } },
      }),
    ]);

    const distinctUserIds = new Set<string>();
    let unusualSessionCount = 0;

    for (const s of activeSessions) {
      distinctUserIds.add(s.userId);
      const anomaly = assessUnusualLocation(s.ipAddress, s.createdAt, s.user.loginHistory);
      if (anomaly.isUnusual) {
        unusualSessionCount++;
      }
    }

    const recentLogins = await this.prisma.unscoped.platformLoginHistory.findMany({
      where: { createdAt: { gte: past24h } },
      include: {
        user: {
          select: {
            loginHistory: {
              where: { status: 'success' },
              select: { ipAddress: true, createdAt: true, status: true },
              orderBy: { createdAt: 'desc' },
              take: 15,
            },
          },
        },
      },
      take: 100,
    });

    let unusualLoginsCount = 0;
    for (const l of recentLogins) {
      const anomaly = assessUnusualLocation(l.ipAddress, l.createdAt, l.user?.loginHistory ?? []);
      if (anomaly.isUnusual) {
        unusualLoginsCount++;
      }
    }

    return {
      totalActiveSessions: activeSessions.length,
      distinctStaffWithSessions: distinctUserIds.size,
      unusualLocationSessionsCount: unusualSessionCount,
      recentLogins24hCount: totalLogins24h,
      failedLogins24hCount: failedLogins24h,
      unusualLoginsCount,
    };
  }
}
