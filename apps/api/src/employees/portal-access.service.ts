import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmploymentStatus, Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import type {
  EmployeePortalAccessState,
  EmployeePortalAccessView,
  EmployeePortalCredentialsResult,
  EmployeePortalManageBlockedReason,
  EmployeePortalRoleOption,
} from '@hrm/shared-types';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser, PermissionClaim } from '../auth/auth.types';
import { hashPassword } from '../auth/password-policy.utils';
import { PrismaService } from '../database/prisma.service';
import { getTenantIdFromSession } from '../tenant/tenant.context';
import type {
  CreatePortalAccessDto,
  UpdatePortalAccessDto,
} from './dto/portal-access.dto';

const PLATFORM_ROLE_NAME = 'Super Admin';
const SELF_SERVICE_ROLE_NAME = 'Employee';
const AUDIT_MODULE = 'portal_access';

const TEMP_PASSWORD_SETS = [
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  'abcdefghijkmnpqrstuvwxyz',
  '23456789',
  '!@#$%*?-',
] as const;
const TEMP_PASSWORD_LENGTH = 12;

const userInclude = {
  role: { include: { permissions: true } },
} satisfies Prisma.UserInclude;

type UserWithRole = Prisma.UserGetPayload<{ include: typeof userInclude }>;
type RoleWithPermissions = Prisma.RoleGetPayload<{ include: { permissions: true } }>;

/** 12 characters drawn from every policy class, without look-alike glyphs (0/O, 1/l/I). */
export function generateTemporaryPassword(): string {
  const all = TEMP_PASSWORD_SETS.join('');
  const chars = TEMP_PASSWORD_SETS.map((set) => set[randomInt(set.length)]);
  while (chars.length < TEMP_PASSWORD_LENGTH) {
    chars.push(all[randomInt(all.length)]);
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

@Injectable()
export class PortalAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listAssignableRoles(actor: AuthenticatedUser): Promise<EmployeePortalRoleOption[]> {
    const roles = await this.prisma.scoped.role.findMany({
      include: { permissions: true },
      orderBy: { name: 'asc' },
    });
    return roles
      .filter((role) => this.canAssignRole(actor, role))
      .map((role) => ({ id: role.id, name: role.name }));
  }

  async getAccess(
    actor: AuthenticatedUser,
    employeeId: string,
  ): Promise<EmployeePortalAccessState> {
    const employee = await this.findEmployee(employeeId);
    const user = await this.findUser(employeeId);
    return {
      access: user ? this.toView(user) : null,
      suggestedEmail: this.workEmail(employee.personalInfo),
      canGrant: employee.employmentStatus !== EmploymentStatus.terminated,
      manageBlockedReason: this.manageBlockedReason(actor, employeeId, user),
    };
  }

  async createAccess(
    actor: AuthenticatedUser,
    employeeId: string,
    dto: CreatePortalAccessDto,
  ): Promise<EmployeePortalCredentialsResult> {
    const tenantId = this.requireTenantId();
    const employee = await this.findEmployee(employeeId);
    this.assertNotSelf(actor, employeeId);
    this.assertCanGrant(employee.employmentStatus);

    if (await this.findUser(employeeId)) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'This employee already has a login',
      });
    }

    const email = dto.email.trim().toLowerCase();
    const role = await this.findAssignableRole(actor, dto.roleId);
    await this.assertEmailAvailable(tenantId, email);

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const user = await this.prisma.unscoped.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          tenantId,
          employeeId,
          roleId: role.id,
          email,
          passwordHash,
          mustChangePassword: true,
        },
        include: userInclude,
      });
      await this.audit.log(
        {
          tenantId,
          userId: actor.id,
          action: 'create',
          module: AUDIT_MODULE,
          recordId: created.id,
          newValue: { employeeId, email, roleId: role.id, roleName: role.name },
        },
        tx,
      );
      return created;
    });

    return { access: this.toView(user), temporaryPassword };
  }

  async resetPassword(
    actor: AuthenticatedUser,
    employeeId: string,
  ): Promise<EmployeePortalCredentialsResult> {
    const tenantId = this.requireTenantId();
    const employee = await this.findEmployee(employeeId);
    const existing = await this.requireManageableUser(actor, employeeId);
    this.assertCanGrant(employee.employmentStatus);

    if (!existing.isActive) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Enable this login before resetting its password',
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const user = await this.prisma.unscoped.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          mustChangePassword: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
        include: userInclude,
      });
      await this.revokeSessions(tx, existing.id);
      await this.audit.log(
        {
          tenantId,
          userId: actor.id,
          action: 'update',
          module: AUDIT_MODULE,
          recordId: existing.id,
          newValue: { employeeId, passwordReset: true },
        },
        tx,
      );
      return updated;
    });

    return { access: this.toView(user), temporaryPassword };
  }

  async updateAccess(
    actor: AuthenticatedUser,
    employeeId: string,
    dto: UpdatePortalAccessDto,
  ): Promise<EmployeePortalAccessView> {
    const tenantId = this.requireTenantId();
    const employee = await this.findEmployee(employeeId);
    const existing = await this.requireManageableUser(actor, employeeId);

    const data: Prisma.UserUncheckedUpdateInput = {};
    const oldValue: Record<string, unknown> = {};
    const newValue: Record<string, unknown> = {};

    if (dto.email !== undefined) {
      const email = dto.email.trim().toLowerCase();
      if (email !== existing.email) {
        await this.assertEmailAvailable(tenantId, email, existing.id);
        data.email = email;
        oldValue.email = existing.email;
        newValue.email = email;
      }
    }

    if (dto.roleId !== undefined && dto.roleId !== existing.roleId) {
      const role = await this.findAssignableRole(actor, dto.roleId);
      data.roleId = role.id;
      oldValue.roleName = existing.role.name;
      newValue.roleName = role.name;
    }

    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
      if (dto.isActive) {
        this.assertCanGrant(employee.employmentStatus);
        data.failedLoginAttempts = 0;
        data.lockedUntil = null;
      }
      data.isActive = dto.isActive;
      oldValue.isActive = existing.isActive;
      newValue.isActive = dto.isActive;
    }

    if (Object.keys(newValue).length === 0) {
      return this.toView(existing);
    }

    const revoke = data.isActive === false || data.roleId !== undefined;

    const user = await this.prisma.unscoped.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: existing.id },
        data,
        include: userInclude,
      });
      if (revoke) {
        await this.revokeSessions(tx, existing.id);
      }
      await this.audit.log(
        {
          tenantId,
          userId: actor.id,
          action: newValue.isActive === false ? 'suspend' : 'update',
          module: AUDIT_MODULE,
          recordId: existing.id,
          oldValue: { employeeId, ...oldValue },
          newValue: { employeeId, ...newValue },
        },
        tx,
      );
      return updated;
    });

    return this.toView(user);
  }

  private requireTenantId(): string {
    const tenantId = getTenantIdFromSession();
    if (!tenantId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tenant context is required',
      });
    }
    return tenantId;
  }

  private async findEmployee(employeeId: string) {
    const employee = await this.prisma.scoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: { id: true, employmentStatus: true, personalInfo: true },
    });
    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Employee not found',
      });
    }
    return employee;
  }

  private async findUser(employeeId: string): Promise<UserWithRole | null> {
    return this.prisma.unscoped.user.findFirst({
      where: { employeeId, tenantId: this.requireTenantId() },
      include: userInclude,
    });
  }

  private async requireManageableUser(
    actor: AuthenticatedUser,
    employeeId: string,
  ): Promise<UserWithRole> {
    const user = await this.findUser(employeeId);
    if (!user) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'This employee does not have a login yet',
      });
    }
    this.assertNotSelf(actor, employeeId);
    if (!this.canAssignRole(actor, user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'This login has permissions beyond your own and can only be managed by a higher role',
      });
    }
    return user;
  }

  private async findAssignableRole(
    actor: AuthenticatedUser,
    roleId: string,
  ): Promise<RoleWithPermissions> {
    const role = await this.prisma.scoped.role.findFirst({
      where: { id: roleId },
      include: { permissions: true },
    });
    if (!role) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Role not found' });
    }
    if (!this.canAssignRole(actor, role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `You cannot assign the ${role.name} role because it has permissions you do not have`,
      });
    }
    return role;
  }

  /**
   * Blocks privilege escalation: an admin can only hand out permissions they hold themselves.
   * The Employee role is exempt — its grants (e.g. leave:create) apply to the holder's own records.
   */
  private canAssignRole(
    actor: AuthenticatedUser,
    role: { name: string; permissions: { module: string; action: string }[] },
  ): boolean {
    if (role.name === PLATFORM_ROLE_NAME) return false;
    if (role.name === SELF_SERVICE_ROLE_NAME) return true;
    const held = new Set(actor.permissions.map((p: PermissionClaim) => `${p.module}:${p.action}`));
    return role.permissions.every((p) => held.has(`${p.module}:${p.action}`));
  }

  private manageBlockedReason(
    actor: AuthenticatedUser,
    employeeId: string,
    user: UserWithRole | null,
  ): EmployeePortalManageBlockedReason | null {
    if (actor.employeeId === employeeId) return 'self';
    if (user && !this.canAssignRole(actor, user.role)) return 'role_privilege';
    return null;
  }

  private assertNotSelf(actor: AuthenticatedUser, employeeId: string): void {
    if (actor.employeeId === employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You cannot manage your own login here — use Change password instead',
      });
    }
  }

  private assertCanGrant(status: EmploymentStatus): void {
    if (status === EmploymentStatus.terminated) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Terminated employees cannot be given portal access',
      });
    }
  }

  private async assertEmailAvailable(
    tenantId: string,
    email: string,
    exceptUserId?: string,
  ): Promise<void> {
    const clash = await this.prisma.unscoped.user.findFirst({
      where: {
        tenantId,
        email: { equals: email, mode: 'insensitive' },
        ...(exceptUserId ? { NOT: { id: exceptUserId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Another login in this organization already uses this email',
      });
    }
  }

  private async revokeSessions(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private workEmail(personalInfo: Prisma.JsonValue): string | null {
    if (!personalInfo || typeof personalInfo !== 'object' || Array.isArray(personalInfo)) {
      return null;
    }
    const contact = (personalInfo as Record<string, unknown>).contact;
    if (!contact || typeof contact !== 'object') return null;
    const email = (contact as Record<string, unknown>).email;
    return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
  }

  private toView(user: UserWithRole): EmployeePortalAccessView {
    return {
      employeeId: user.employeeId!,
      userId: user.id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      isLocked: !!user.lockedUntil && user.lockedUntil > new Date(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
