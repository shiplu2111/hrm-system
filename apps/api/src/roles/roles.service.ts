import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PermissionAction, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  SYSTEM_ROLE_NAMES,
} from '../rbac/rbac.constants';
import { getTenantIdFromSession } from '../tenant/tenant.context';
import type { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

type RoleWithPermissions = Prisma.RoleGetPayload<{
  include: { permissions: true };
}>;

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  getPermissionCatalog() {
    return {
      modules: [...PERMISSION_MODULES],
      actions: [...PERMISSION_ACTIONS],
    };
  }

  async listRoles(): Promise<RoleWithPermissions[]> {
    return this.prisma.scoped.role.findMany({
      include: {
        permissions: { orderBy: [{ module: 'asc' }, { action: 'asc' }] },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getRole(id: string): Promise<RoleWithPermissions> {
    const role = await this.prisma.scoped.role.findUnique({
      where: { id },
      include: {
        permissions: { orderBy: [{ module: 'asc' }, { action: 'asc' }] },
      },
    });

    if (!role) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Role not found',
      });
    }

    return role;
  }

  async createCustomRole(dto: CreateRoleDto): Promise<RoleWithPermissions> {
    this.assertCustomRoleName(dto.name);
    const tenantId = getTenantIdFromSession();
    if (!tenantId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Tenant context is required to create roles',
      });
    }

    const permissions = this.deduplicatePermissions(dto.permissions);

    return this.prisma.unscoped.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: dto.name.trim(),
          tenantId,
        },
      });

      await tx.permission.createMany({
        data: permissions.map((permission) => ({
          roleId: role.id,
          module: permission.module,
          action: permission.action as PermissionAction,
        })),
      });

      return tx.role.findUniqueOrThrow({
        where: { id: role.id },
        include: {
          permissions: { orderBy: [{ module: 'asc' }, { action: 'asc' }] },
        },
      });
    });
  }

  async updateCustomRole(
    id: string,
    dto: UpdateRoleDto,
  ): Promise<RoleWithPermissions> {
    const existing = await this.getRole(id);
    this.assertRoleIsMutable(existing.name);

    if (dto.name && dto.name.trim() !== existing.name) {
      this.assertCustomRoleName(dto.name);
    }

    return this.prisma.unscoped.$transaction(async (tx) => {
      if (dto.name) {
        await tx.role.update({
          where: { id },
          data: { name: dto.name.trim() },
        });
      }

      if (dto.permissions) {
        const permissions = this.deduplicatePermissions(dto.permissions);
        await tx.permission.deleteMany({ where: { roleId: id } });
        await tx.permission.createMany({
          data: permissions.map((permission) => ({
            roleId: id,
            module: permission.module,
            action: permission.action as PermissionAction,
          })),
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id },
        include: {
          permissions: { orderBy: [{ module: 'asc' }, { action: 'asc' }] },
        },
      });
    });
  }

  async deleteCustomRole(id: string): Promise<void> {
    const existing = await this.getRole(id);
    this.assertRoleIsMutable(existing.name);

    const assignedUsers = await this.prisma.scoped.user.count({
      where: { roleId: id },
    });

    if (assignedUsers > 0) {
      throw new ConflictException({
        code: 'ROLE_IN_USE',
        message: 'Role is assigned to users and cannot be deleted',
      });
    }

    await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.permission.deleteMany({ where: { roleId: id } });
      await tx.role.delete({ where: { id } });
    });
  }

  private assertCustomRoleName(name: string): void {
    const normalized = name.trim();
    if (SYSTEM_ROLE_NAMES.has(normalized)) {
      throw new ConflictException({
        code: 'SYSTEM_ROLE_NAME_RESERVED',
        message: `Role name "${normalized}" is reserved for a system role`,
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

  private deduplicatePermissions(
    permissions: CreateRoleDto['permissions'],
  ): CreateRoleDto['permissions'] {
    const seen = new Set<string>();
    const unique: CreateRoleDto['permissions'] = [];

    for (const permission of permissions) {
      const key = `${permission.module}:${permission.action}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(permission);
      }
    }

    return unique;
  }

  static toResponse(role: RoleWithPermissions) {
    return {
      id: role.id,
      tenantId: role.tenantId,
      name: role.name,
      isSystem: SYSTEM_ROLE_NAMES.has(role.name),
      permissions: role.permissions.map((permission) => ({
        module: permission.module,
        action: permission.action,
      })),
    };
  }
}
