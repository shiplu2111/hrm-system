import { ForbiddenException, Injectable } from '@nestjs/common';
import { RoleDataScope } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

export type EmployeeScope =
  | { kind: 'all' }
  | { kind: 'team'; selfId: string | null; reportIds: string[] };

export interface ScopeOptions {
  /** Include the user's own employee record (reads); exclude it for approvals of own requests. */
  includeSelf?: boolean;
}

/**
 * ROLES_PERMISSIONS.md §5 — roles with `data_scope = team` only reach employees in their
 * reporting tree (direct + indirect reports via employees.manager_id).
 */
@Injectable()
export class DataScopeService {
  private readonly cache = new WeakMap<AuthenticatedUser, Promise<EmployeeScope>>();

  constructor(private readonly prisma: PrismaService) {}

  resolve(user: AuthenticatedUser): Promise<EmployeeScope> {
    let scope = this.cache.get(user);
    if (!scope) {
      scope = this.load(user);
      this.cache.set(user, scope);
    }
    return scope;
  }

  async isOrgWide(user: AuthenticatedUser): Promise<boolean> {
    return (await this.resolve(user)).kind === 'all';
  }

  /** Employee ids the user may reach, or `null` when unrestricted. */
  async employeeIds(
    user: AuthenticatedUser,
    options: ScopeOptions = {},
  ): Promise<string[] | null> {
    const scope = await this.resolve(user);
    if (scope.kind === 'all') return null;
    const includeSelf = options.includeSelf ?? true;
    return includeSelf && scope.selfId
      ? [scope.selfId, ...scope.reportIds]
      : [...scope.reportIds];
  }

  /** Prisma filter for an employee id column; `undefined` when unrestricted. */
  async employeeIdFilter(
    user: AuthenticatedUser,
    options: ScopeOptions = {},
  ): Promise<{ in: string[] } | undefined> {
    const ids = await this.employeeIds(user, options);
    return ids ? { in: ids } : undefined;
  }

  async canAccessEmployee(
    user: AuthenticatedUser,
    employeeId: string | null | undefined,
    options: ScopeOptions = {},
  ): Promise<boolean> {
    const ids = await this.employeeIds(user, options);
    if (!ids) return true;
    return !!employeeId && ids.includes(employeeId);
  }

  async assertEmployeeInScope(
    user: AuthenticatedUser,
    employeeId: string | null | undefined,
    options: ScopeOptions = {},
  ): Promise<void> {
    if (await this.canAccessEmployee(user, employeeId, options)) return;
    throw new ForbiddenException({
      code: 'OUT_OF_SCOPE',
      message: 'This employee is outside your reporting line',
    });
  }

  private async load(user: AuthenticatedUser): Promise<EmployeeScope> {
    const role = await this.prisma.unscoped.role.findUnique({
      where: { id: user.roleId },
      select: { dataScope: true },
    });
    if (role?.dataScope !== RoleDataScope.team) return { kind: 'all' };
    if (!user.employeeId) return { kind: 'team', selfId: null, reportIds: [] };

    const rows = await this.prisma.unscoped.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE tree AS (
        SELECT e.id FROM employees e
        WHERE e.manager_id = ${user.employeeId}::uuid AND e.deleted_at IS NULL
        UNION
        SELECT e.id FROM employees e
        JOIN tree t ON e.manager_id = t.id
        WHERE e.deleted_at IS NULL
      )
      SELECT id FROM tree
    `;
    return {
      kind: 'team',
      selfId: user.employeeId,
      reportIds: rows.map((row) => row.id).filter((id) => id !== user.employeeId),
    };
  }
}
