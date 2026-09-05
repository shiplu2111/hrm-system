import { Injectable } from '@nestjs/common';
import type { NotificationRecipientRole } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';

export interface ResolvedNotificationRecipient {
  employeeId: string;
  userId: string | null;
  email: string | null;
  displayName: string;
  role: NotificationRecipientRole;
}

@Injectable()
export class NotificationRecipientsService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveRecipients(
    subjectEmployeeId: string,
    roles: NotificationRecipientRole[],
  ): Promise<ResolvedNotificationRecipient[]> {
    const subject = await this.loadEmployee(subjectEmployeeId);
    if (!subject) return [];

    const resolved: ResolvedNotificationRecipient[] = [];
    const seenEmployeeIds = new Set<string>();

    for (const role of roles) {
      if (role === 'subject_employee') {
        const recipient = this.toRecipient(subject, 'subject_employee');
        if (!seenEmployeeIds.has(recipient.employeeId)) {
          seenEmployeeIds.add(recipient.employeeId);
          resolved.push(recipient);
        }
        continue;
      }

      if (role === 'manager' && subject.managerId) {
        const manager = await this.loadEmployee(subject.managerId);
        if (!manager || seenEmployeeIds.has(manager.id)) continue;
        seenEmployeeIds.add(manager.id);
        resolved.push(this.toRecipient(manager, 'manager'));
      }

      if (role === 'hr_admin') {
        if (!subject.tenantId) continue;
        const hrAdmins = await this.resolveHrAdminUsers(subject.tenantId);
        for (const hr of hrAdmins) {
          if (seenEmployeeIds.has(hr.employeeId)) continue;
          seenEmployeeIds.add(hr.employeeId);
          resolved.push(hr);
        }
      }
    }

    return resolved;
  }

  async resolveDirectUsers(
    userIds: string[],
  ): Promise<ResolvedNotificationRecipient[]> {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueIds.length === 0) return [];

    const users = await this.prisma.unscoped.user.findMany({
      where: { id: { in: uniqueIds }, isActive: true },
      select: {
        id: true,
        email: true,
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            personalInfo: true,
          },
        },
      },
    });

    return users.map((user) => ({
      employeeId: user.employee?.id ?? user.id,
      userId: user.id,
      email: user.email,
      displayName: user.employee
        ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
        : user.email,
      role: 'subject_employee' as const,
    }));
  }

  async resolveHrAdminUsers(tenantId: string): Promise<ResolvedNotificationRecipient[]> {
    const users = await this.prisma.unscoped.user.findMany({
      where: {
        tenantId,
        isActive: true,
        role: { name: 'HR Admin' },
      },
      select: {
        id: true,
        email: true,
        employee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return users.map((user) => ({
      employeeId: user.employee?.id ?? user.id,
      userId: user.id,
      email: user.email,
      displayName: user.employee
        ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
        : user.email,
      role: 'hr_admin' as const,
    }));
  }

  private async loadEmployee(employeeId: string) {
    return this.prisma.unscoped.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        managerId: true,
        personalInfo: true,
        user: {
          select: {
            id: true,
            email: true,
            isActive: true,
          },
        },
      },
    });
  }

  private toRecipient(
    employee: NonNullable<Awaited<ReturnType<typeof this.loadEmployee>>>,
    role: NotificationRecipientRole,
  ): ResolvedNotificationRecipient {
    return {
      employeeId: employee.id,
      userId:
        employee.user?.isActive === false ? null : (employee.user?.id ?? null),
      email: this.resolveEmail(employee),
      displayName: `${employee.firstName} ${employee.lastName}`.trim(),
      role,
    };
  }

  private resolveEmail(
    employee: NonNullable<Awaited<ReturnType<typeof this.loadEmployee>>>,
  ): string | null {
    if (employee.user?.isActive !== false && employee.user?.email) {
      return employee.user.email;
    }

    const personalInfo = employee.personalInfo as Record<string, unknown>;
    const contact = personalInfo.contact as Record<string, unknown> | undefined;
    const personalEmail = contact?.email;
    if (typeof personalEmail === 'string' && personalEmail.includes('@')) {
      return personalEmail;
    }

    return null;
  }
}
