import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EmployeeKudos } from '@prisma/client';
import type { EmployeeKudosRecord, EmployeeKudosType } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { buildKudosReceivedVariables } from '../notifications/notification.helpers';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type { CreateKudosDto, ListKudosQueryDto } from './dto/engagement.dto';
import { resolveKudosType } from './engagement.utils';

type KudosWithEmployees = EmployeeKudos & {
  fromEmployee: { firstName: string; lastName: string };
  toEmployee: { firstName: string; lastName: string; managerId: string | null };
};

@Injectable()
export class KudosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly notificationEngine: NotificationEngineService,
  ) {}

  async listFeed(
    companyId: string,
    query: ListKudosQueryDto,
  ): Promise<EmployeeKudosRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.employeeKudos.findMany({
      where: {
        companyId,
        ...(query.toEmployeeId ? { toEmployeeId: query.toEmployeeId } : {}),
      },
      include: {
        fromEmployee: { select: { firstName: true, lastName: true } },
        toEmployee: { select: { firstName: true, lastName: true, managerId: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit ?? 20,
    });

    return rows.map((row) => this.toRecord(row));
  }

  async countThisMonth(companyId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    return this.prisma.unscoped.employeeKudos.count({
      where: { companyId, createdAt: { gte: startOfMonth } },
    });
  }

  async createForEmployee(
    fromEmployeeId: string,
    dto: { toEmployeeId: string; message: string },
    user: AuthenticatedUser,
  ): Promise<EmployeeKudosRecord> {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: fromEmployeeId, deletedAt: null },
      select: { companyId: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return this.create(
      employee.companyId,
      {
        fromEmployeeId,
        toEmployeeId: dto.toEmployeeId,
        message: dto.message,
      },
      user,
    );
  }

  async create(
    companyId: string,
    dto: CreateKudosDto,
    user: AuthenticatedUser,
    options?: { allowDelegate?: boolean },
  ): Promise<EmployeeKudosRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    if (dto.fromEmployeeId === dto.toEmployeeId) {
      throw new BadRequestException('You cannot recognize yourself');
    }

    if (
      user.employeeId &&
      user.employeeId !== dto.fromEmployeeId &&
      !options?.allowDelegate
    ) {
      throw new ForbiddenException('Cannot send kudos on behalf of another employee');
    }

    if (user.employeeId && user.employeeId !== dto.fromEmployeeId) {
      throw new ForbiddenException('Cannot send kudos on behalf of another employee');
    }

    const [fromEmployee, toEmployee] = await Promise.all([
      this.assertActiveEmployee(dto.fromEmployeeId, companyId),
      this.assertActiveEmployee(dto.toEmployeeId, companyId),
    ]);

    const kudosType = resolveKudosType(dto.fromEmployeeId, toEmployee.managerId);

    const row = await this.prisma.unscoped.employeeKudos.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        fromEmployeeId: dto.fromEmployeeId,
        toEmployeeId: dto.toEmployeeId,
        kudosType,
        message: dto.message.trim(),
        createdByUserId: user.id,
      },
      include: {
        fromEmployee: { select: { firstName: true, lastName: true } },
        toEmployee: { select: { firstName: true, lastName: true, managerId: true } },
      },
    });

    const fromName = this.employeeName(row.fromEmployee);
    const toName = this.employeeName(row.toEmployee);

    await this.notificationEngine.emit({
      tenantId: company.tenantId,
      companyId,
      eventType: 'kudos.received',
      subjectEmployeeId: dto.toEmployeeId,
      variables: buildKudosReceivedVariables({
        fromEmployeeName: fromName,
        toEmployeeName: toName,
        kudosMessage: row.message,
        kudosType: row.kudosType,
      }),
      payload: {
        kudosId: row.id,
        fromEmployeeId: row.fromEmployeeId,
        kudosType: row.kudosType,
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'engagement',
      recordId: row.id,
      newValue: {
        fromEmployeeId: row.fromEmployeeId,
        toEmployeeId: row.toEmployeeId,
        kudosType: row.kudosType,
      },
    });

    return this.toRecord(row);
  }

  private async assertActiveEmployee(employeeId: string, companyId: string) {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: {
        id: employeeId,
        companyId,
        deletedAt: null,
        employmentStatus: 'active',
      },
      select: { id: true, managerId: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found or not active');
    }
    return employee;
  }

  private employeeName(employee: { firstName: string; lastName: string }): string {
    return `${employee.firstName} ${employee.lastName}`.trim();
  }

  private toRecord(row: KudosWithEmployees): EmployeeKudosRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      fromEmployeeId: row.fromEmployeeId,
      fromEmployeeName: this.employeeName(row.fromEmployee),
      toEmployeeId: row.toEmployeeId,
      toEmployeeName: this.employeeName(row.toEmployee),
      kudosType: row.kudosType as EmployeeKudosType,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
