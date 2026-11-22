import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { TotpService } from '../auth/totp.service';

export interface DefaultPlatformRoleDefinition {
  name: string;
  description: string;
  permissions: Array<{ module: string; action: string }>;
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
  // Deterministic Base32 TOTP secret for local dev:
  // JBSWY3DPEHPK3PXP is standard RFC 3548 / 4648 test secret ("Hello!\xde\xad\xbe\xef")
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

  /**
   * Seeds default platform roles and their granular permissions.
   * Idempotent: safe to run on every startup or seed execution.
   */
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

  /**
   * Seeds the initial Platform Owner account for local development.
   */
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

    this.logger.log(
      `Seeded Platform Owner: ${DEMO_PLATFORM_OWNER.email} (TOTP Secret: ${DEMO_PLATFORM_OWNER.totpSecret})`,
    );

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
      this.logger.log('Seeded Compliance Admin: compliance.admin@cmsnbd.com');
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
      this.logger.log('Seeded Platform Admin: platform.admin@cmsnbd.com');
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

  async listUsers() {
    const users = await this.prisma.unscoped.platformUser.findMany({
      include: {
        role: {
          include: {
            permissions: {
              select: { module: true, action: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      roleId: u.roleId,
      roleName: u.role.name,
      isActive: u.isActive,
      totpEnabled: u.totpEnabled,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      permissions: u.role.permissions,
    }));
  }

  async createUser(input: {
    email: string;
    firstName: string;
    lastName: string;
    roleId: string;
    password?: string;
  }, actorId?: string) {
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
      userId: actorId ?? null,
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
        totpEnabled: user.totpEnabled,
        lastLoginAt: null,
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
    input: {
      roleId?: string;
      isActive?: boolean;
      firstName?: string;
      lastName?: string;
    },
    actorId?: string,
  ) {
    const user = await this.prisma.unscoped.platformUser.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Platform user not found',
      });
    }

    if (input.roleId) {
      const role = await this.prisma.unscoped.platformRole.findUnique({ where: { id: input.roleId } });
      if (!role) {
        throw new BadRequestException({
          code: 'INVALID_ROLE',
          message: 'Platform role not found',
        });
      }
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
      userId: actorId ?? null,
      action: 'update',
      module: 'platform_user',
      recordId: id,
      oldValue: { roleId: user.roleId, isActive: user.isActive },
      newValue: { roleId: updated.roleId, isActive: updated.isActive },
    });

    return {
      id: updated.id,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      roleId: updated.roleId,
      roleName: updated.role.name,
      isActive: updated.isActive,
      totpEnabled: updated.totpEnabled,
      lastLoginAt: updated.lastLoginAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      permissions: updated.role.permissions,
    };
  }
}
