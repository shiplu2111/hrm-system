import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, type PermissionAction, type Prisma } from '@prisma/client';
import type {
  PermissionCatalog,
  RoleDataScope,
  RolePermission,
  TenantRoleRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { DataScopeService } from '../rbac/data-scope.service';
import {
  MODULE_ACTIONS,
  NON_GRANTABLE_MODULES,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  SYSTEM_ROLE_NAMES,
} from '../rbac/rbac.constants';
import { getTenantIdFromSession } from '../tenant/tenant.context';
import type { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import {
  diffPermissions,
  missingFromHeld,
  normalizePermissions,
  permissionKey,
} from './role-permissions.util';

const ROLE_INCLUDE = {
  permissions: { orderBy: [{ module: 'asc' }, { action: 'asc' }] },
  _count: { select: { users: true } },
} satisfies Prisma.RoleInclude;

type RoleWithPermissions = Prisma.RoleGetPayload<{ include: typeof ROLE_INCLUDE }>;

/** Without these the editor would lock itself out of this screen. */
const SELF_LOCKOUT_PERMISSIONS: RolePermission[] = [
  { module: 'settings', action: 'view' },
  { module: 'settings', action: 'edit' },
];

const RESERVED_NAMES = new Set([...SYSTEM_ROLE_NAMES].map((name) => name.toLowerCase()));

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly dataScope: DataScopeService,
  ) {}

  getPermissionCatalog(): PermissionCatalog {
    return {
      modules: [...PERMISSION_MODULES],
      actions: [...PERMISSION_ACTIONS],
      moduleDefinitions: PERMISSION_MODULES.map((key) => ({
        key,
        actions: [...MODULE_ACTIONS[key]],
        grantable: !NON_GRANTABLE_MODULES.has(key),
      })),
    };
  }

  async listRoles(): Promise<RoleWithPermissions[]> {
    return this.prisma.scoped.role.findMany({
      include: ROLE_INCLUDE,
      orderBy: { name: 'asc' },
    });
  }

  async getRole(id: string): Promise<RoleWithPermissions> {
    const role = await this.prisma.scoped.role.findUnique({
      where: { id },
      include: ROLE_INCLUDE,
    });

    if (!role) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Role not found',
      });
    }

    return role;
  }

  async createCustomRole(
    dto: CreateRoleDto,
    actor: AuthenticatedUser,
  ): Promise<RoleWithPermissions> {
    const tenantId = this.requireTenant();
    const name = dto.name.trim();
    await this.assertNameAvailable(name);

    const permissions = normalizePermissions(dto.permissions);
    const dataScope = dto.dataScope ?? 'all';
    this.assertGrantable(permissions);
    await this.assertActorHolds(actor, permissions);
    await this.assertActorCanGrantScope(actor, dataScope);

    return this.prisma.unscoped.$transaction(async (tx) => {
      const role = await tx.role.create({ data: { name, tenantId, dataScope } });

      await tx.permission.createMany({
        data: permissions.map((permission) => ({
          roleId: role.id,
          module: permission.module,
          action: permission.action as PermissionAction,
        })),
      });

      await this.audit.log(
        {
          tenantId,
          userId: actor.id,
          action: AuditAction.create,
          module: 'settings',
          recordId: role.id,
          newValue: { entity: 'role', name, dataScope, permissions: permissions.map(permissionKey) },
        },
        tx,
      );

      return tx.role.findUniqueOrThrow({ where: { id: role.id }, include: ROLE_INCLUDE });
    });
  }

  async updateCustomRole(
    id: string,
    dto: UpdateRoleDto,
    actor: AuthenticatedUser,
  ): Promise<RoleWithPermissions> {
    const tenantId = this.requireTenant();
    const existing = await this.getRole(id);
    this.assertRoleIsMutable(existing.name);

    const name = dto.name?.trim();
    const renamed = name !== undefined && name !== existing.name;
    if (renamed) {
      await this.assertNameAvailable(name, id);
      await this.assertNotReferencedByWorkflows(tenantId, existing.name, 'rename');
    }

    const current = existing.permissions.map(({ module, action }) => ({ module, action }));
    const next = dto.permissions ? normalizePermissions(dto.permissions) : null;
    const { added, removed } = next ? diffPermissions(current, next) : { added: [], removed: [] };

    if (next) {
      this.assertGrantable(added);
      await this.assertActorHolds(actor, added);
      if (actor.roleId === id) {
        const lockedOut = missingFromHeld(SELF_LOCKOUT_PERMISSIONS, next);
        if (lockedOut.length > 0) {
          throw new BadRequestException({
            code: 'ROLE_SELF_LOCKOUT',
            message: `You can't remove ${lockedOut.map(permissionKey).join(' and ')} from your own role — you would lose access to role settings.`,
          });
        }
      }
    }

    const scopeChanged = dto.dataScope !== undefined && dto.dataScope !== existing.dataScope;
    if (scopeChanged) {
      await this.assertActorCanGrantScope(actor, dto.dataScope!);
    }

    if (!renamed && !scopeChanged && added.length === 0 && removed.length === 0) return existing;

    return this.prisma.unscoped.$transaction(async (tx) => {
      if (renamed || scopeChanged) {
        await tx.role.update({
          where: { id },
          data: {
            ...(renamed ? { name } : {}),
            ...(scopeChanged ? { dataScope: dto.dataScope } : {}),
          },
        });
      }

      if (removed.length > 0) {
        await tx.permission.deleteMany({
          where: {
            roleId: id,
            OR: removed.map((permission) => ({
              module: permission.module,
              action: permission.action as PermissionAction,
            })),
          },
        });
      }
      if (added.length > 0) {
        await tx.permission.createMany({
          data: added.map((permission) => ({
            roleId: id,
            module: permission.module,
            action: permission.action as PermissionAction,
          })),
        });
      }

      await this.audit.log(
        {
          tenantId,
          userId: actor.id,
          action: AuditAction.update,
          module: 'settings',
          recordId: id,
          oldValue: {
            entity: 'role',
            ...(renamed ? { name: existing.name } : {}),
            ...(scopeChanged ? { dataScope: existing.dataScope } : {}),
            ...(removed.length > 0 ? { removedPermissions: removed.map(permissionKey) } : {}),
          },
          newValue: {
            entity: 'role',
            ...(renamed ? { name } : {}),
            ...(scopeChanged ? { dataScope: dto.dataScope } : {}),
            ...(added.length > 0 ? { addedPermissions: added.map(permissionKey) } : {}),
          },
        },
        tx,
      );

      return tx.role.findUniqueOrThrow({ where: { id }, include: ROLE_INCLUDE });
    });
  }

  async deleteCustomRole(id: string, actor: AuthenticatedUser): Promise<void> {
    const tenantId = this.requireTenant();
    const existing = await this.getRole(id);
    this.assertRoleIsMutable(existing.name);

    if (existing._count.users > 0) {
      throw new ConflictException({
        code: 'ROLE_IN_USE',
        message: `This role is assigned to ${existing._count.users} ${existing._count.users === 1 ? 'user' : 'users'}. Move them to another role first.`,
      });
    }
    await this.assertNotReferencedByWorkflows(tenantId, existing.name, 'delete');

    await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.permission.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
      await this.audit.log(
        {
          tenantId,
          userId: actor.id,
          action: AuditAction.delete,
          module: 'settings',
          recordId: id,
          oldValue: {
            entity: 'role',
            name: existing.name,
            permissions: existing.permissions.map(permissionKey),
          },
        },
        tx,
      );
    });
  }

  private requireTenant(): string {
    const tenantId = getTenantIdFromSession();
    if (!tenantId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tenant context is required to manage roles',
      });
    }
    return tenantId;
  }

  private async assertNameAvailable(name: string, excludeRoleId?: string): Promise<void> {
    if (name.length < 2) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Role name must be at least 2 characters',
      });
    }
    const normalized = name.toLowerCase();
    if (RESERVED_NAMES.has(normalized)) {
      throw new ConflictException({
        code: 'SYSTEM_ROLE_NAME_RESERVED',
        message: `"${name}" is reserved for a default system role`,
      });
    }
    const roles = await this.prisma.scoped.role.findMany({ select: { id: true, name: true } });
    if (roles.some((role) => role.id !== excludeRoleId && role.name.trim().toLowerCase() === normalized)) {
      throw new ConflictException({
        code: 'ROLE_NAME_TAKEN',
        message: `A role named "${name}" already exists`,
      });
    }
  }

  private assertRoleIsMutable(roleName: string): void {
    if (SYSTEM_ROLE_NAMES.has(roleName)) {
      throw new ForbiddenException({
        code: 'SYSTEM_ROLE_IMMUTABLE',
        message: 'System roles cannot be modified or deleted',
      });
    }
  }

  private assertGrantable(permissions: RolePermission[]): void {
    const blocked = permissions.filter((permission) => NON_GRANTABLE_MODULES.has(permission.module));
    if (blocked.length > 0) {
      throw new BadRequestException({
        code: 'PERMISSION_NOT_GRANTABLE',
        message: `${blocked.map(permissionKey).join(', ')} can't be granted to company roles`,
      });
    }
  }

  /**
   * Nobody can hand out access they don't have themselves — otherwise settings:edit alone
   * would be a path to every permission. Checked against the DB, not the (possibly stale) token.
   */
  private async assertActorHolds(actor: AuthenticatedUser, permissions: RolePermission[]): Promise<void> {
    if (permissions.length === 0) return;
    const held =
      actor.authMethod === 'api_key' || actor.authMethod === 'oauth'
        ? actor.permissions
        : await this.prisma.unscoped.permission.findMany({
            where: { roleId: actor.roleId },
            select: { module: true, action: true },
          });
    const missing = missingFromHeld(permissions, held);
    if (missing.length > 0) {
      throw new ForbiddenException({
        code: 'PERMISSION_NOT_HELD',
        message: `You can only grant permissions you hold yourself. Missing: ${missing.map(permissionKey).join(', ')}`,
      });
    }
  }

  /** A team-scoped editor widening a role to company-wide data would be the same escalation. */
  private async assertActorCanGrantScope(
    actor: AuthenticatedUser,
    dataScope: RoleDataScope,
  ): Promise<void> {
    if (dataScope === 'team') return;
    if (await this.dataScope.isOrgWide(actor)) return;
    throw new ForbiddenException({
      code: 'DATA_SCOPE_NOT_HELD',
      message: 'Only users with company-wide access can create or edit company-wide roles',
    });
  }

  /** Approval steps match approvers by role name, so renaming or deleting would orphan them. */
  private async assertNotReferencedByWorkflows(
    tenantId: string,
    roleName: string,
    operation: 'rename' | 'delete',
  ): Promise<void> {
    const step = [{ roleName }];
    const [policies, definitions, pending] = await Promise.all([
      this.prisma.unscoped.leavePolicy.findMany({
        where: { company: { tenantId }, approvalSteps: { array_contains: step } },
        select: { leaveType: { select: { name: true } } },
      }),
      this.prisma.unscoped.workflowDefinition.findMany({
        where: { company: { tenantId }, steps: { array_contains: step } },
        select: { name: true },
      }),
      this.prisma.unscoped.workflowInstance.count({
        where: { tenantId, status: 'pending', steps: { array_contains: step } },
      }),
    ]);

    const uses = [
      ...definitions.map((definition) => `workflow "${definition.name}"`),
      ...[...new Set(policies.map((policy) => policy.leaveType.name))].map((name) => `${name} leave policy`),
      ...(pending > 0 ? [`${pending} pending ${pending === 1 ? 'approval' : 'approvals'}`] : []),
    ];
    if (uses.length > 0) {
      throw new ConflictException({
        code: 'ROLE_IN_WORKFLOW',
        message: `Can't ${operation} "${roleName}" — approval steps use it: ${uses.join(', ')}. Change those steps first.`,
      });
    }
  }

  static toResponse(role: RoleWithPermissions): TenantRoleRecord {
    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      dataScope: role.dataScope,
      isSystem: SYSTEM_ROLE_NAMES.has(role.name),
      userCount: role._count.users,
      permissions: role.permissions.map((permission) => ({
        module: permission.module,
        action: permission.action,
      })),
    };
  }
}
