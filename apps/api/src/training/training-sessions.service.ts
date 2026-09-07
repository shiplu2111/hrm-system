import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  TrainingAttendanceStatus,
  TrainingSessionStatus,
  type TrainingSession,
  type TrainingSessionCost,
} from '@prisma/client';
import type {
  TrainingAttendanceRecord,
  TrainingSessionCostRecord,
  TrainingSessionRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateTrainingSessionCostDto,
  CreateTrainingSessionDto,
  ListTrainingAttendanceQueryDto,
  ListTrainingSessionsQueryDto,
  RegisterTrainingAttendanceDto,
  UpdateTrainingAttendanceDto,
  UpdateTrainingSessionCostDto,
  UpdateTrainingSessionDto,
} from './dto/training.dto';
import { TrainingService } from './training.service';
import { decimalToNumber, sumCosts, toDecimal } from './training.utils';

type SessionWithRelations = TrainingSession & {
  course: { title: string; category: string | null };
  costs: TrainingSessionCost[];
  _count: { attendances: number };
  attendances: Array<{ status: string }>;
};

type AttendanceWithRelations = {
  id: string;
  companyId: string;
  sessionId: string;
  employeeId: string;
  status: TrainingAttendanceStatus;
  registeredAt: Date;
  attendedAt: Date | null;
  completedAt: Date | null;
  score: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  session: {
    title: string | null;
    scheduledStart: Date;
    course: { title: string };
  };
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department: { name: string } | null;
  };
};

@Injectable()
export class TrainingSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly trainingService: TrainingService,
  ) {}

  async listSessions(
    companyId: string,
    query: ListTrainingSessionsQueryDto,
  ): Promise<TrainingSessionRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.trainingSession.findMany({
      where: {
        companyId,
        courseId: query.courseId,
        status: query.status,
      },
      include: this.sessionInclude(),
      orderBy: [{ scheduledStart: 'desc' }],
    });

    return rows.map((row) => this.toSessionRecord(row as SessionWithRelations));
  }

  async createSession(
    companyId: string,
    dto: CreateTrainingSessionDto,
    user: AuthenticatedUser,
  ): Promise<TrainingSessionRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const course = await this.trainingService.getCourseOrThrow(dto.courseId);
    if (course.companyId !== companyId) {
      throw new NotFoundException('Training course not found');
    }

    const row = await this.prisma.unscoped.trainingSession.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        courseId: dto.courseId,
        title: dto.title?.trim(),
        scheduledStart: new Date(dto.scheduledStart),
        scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : null,
        location: dto.location?.trim(),
        instructor: dto.instructor?.trim(),
        notes: dto.notes?.trim(),
        createdByUserId: user.id,
      },
      include: this.sessionInclude(),
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'training',
      recordId: row.id,
      newValue: { courseId: dto.courseId, scheduledStart: dto.scheduledStart },
    });

    return this.toSessionRecord(row as SessionWithRelations);
  }

  async updateSession(
    sessionId: string,
    dto: UpdateTrainingSessionDto,
    user: AuthenticatedUser,
  ): Promise<TrainingSessionRecord> {
    const existing = await this.getSessionOrThrow(sessionId);

    const row = await this.prisma.unscoped.trainingSession.update({
      where: { id: sessionId },
      data: {
        title: dto.title?.trim(),
        scheduledStart: dto.scheduledStart ? new Date(dto.scheduledStart) : undefined,
        scheduledEnd: dto.scheduledEnd ? new Date(dto.scheduledEnd) : undefined,
        location: dto.location?.trim(),
        instructor: dto.instructor?.trim(),
        status: dto.status,
        notes: dto.notes?.trim(),
      },
      include: this.sessionInclude(),
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: sessionId,
      newValue: { ...dto },
    });

    return this.toSessionRecord(row as SessionWithRelations);
  }

  async addSessionCost(
    sessionId: string,
    dto: CreateTrainingSessionCostDto,
    user: AuthenticatedUser,
  ): Promise<TrainingSessionCostRecord> {
    const session = await this.getSessionOrThrow(sessionId);

    const row = await this.prisma.unscoped.trainingSessionCost.create({
      data: {
        tenantId: session.tenantId,
        companyId: session.companyId,
        sessionId,
        category: dto.category,
        description: dto.description?.trim(),
        amount: toDecimal(dto.amount)!,
        currency: dto.currency?.toUpperCase() ?? 'AUD',
      },
    });

    await this.auditService.log({
      tenantId: session.tenantId,
      userId: user.id,
      action: 'create',
      module: 'training',
      recordId: row.id,
      newValue: { sessionId, category: dto.category, amount: dto.amount },
    });

    return this.toCostRecord(row);
  }

  async updateSessionCost(
    costId: string,
    dto: UpdateTrainingSessionCostDto,
    user: AuthenticatedUser,
  ): Promise<TrainingSessionCostRecord> {
    const existing = await this.prisma.unscoped.trainingSessionCost.findUnique({
      where: { id: costId },
    });
    if (!existing) {
      throw new NotFoundException('Training session cost not found');
    }

    const row = await this.prisma.unscoped.trainingSessionCost.update({
      where: { id: costId },
      data: {
        category: dto.category,
        description: dto.description?.trim(),
        amount: dto.amount != null ? toDecimal(dto.amount) : undefined,
        currency: dto.currency?.toUpperCase(),
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: costId,
      newValue: { ...dto },
    });

    return this.toCostRecord(row);
  }

  async deleteSessionCost(costId: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.unscoped.trainingSessionCost.findUnique({
      where: { id: costId },
    });
    if (!existing) {
      throw new NotFoundException('Training session cost not found');
    }

    await this.prisma.unscoped.trainingSessionCost.delete({ where: { id: costId } });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'training',
      recordId: costId,
    });
  }

  async listAttendance(
    companyId: string,
    query: ListTrainingAttendanceQueryDto,
  ): Promise<TrainingAttendanceRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.trainingAttendance.findMany({
      where: {
        companyId,
        sessionId: query.sessionId,
        employeeId: query.employeeId,
        status: query.status,
        session: query.courseId ? { courseId: query.courseId } : undefined,
      },
      include: {
        session: {
          select: {
            title: true,
            scheduledStart: true,
            course: { select: { title: true } },
          },
        },
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [{ registeredAt: 'desc' }],
    });

    return rows.map((row) => this.toAttendanceRecord(row as AttendanceWithRelations));
  }

  async registerAttendance(
    sessionId: string,
    dto: RegisterTrainingAttendanceDto,
    user: AuthenticatedUser,
  ): Promise<TrainingAttendanceRecord[]> {
    const session = await this.getSessionOrThrow(sessionId);
    if (session.status === TrainingSessionStatus.cancelled) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Cannot register attendance for a cancelled session',
      });
    }

    for (const employeeId of dto.employeeIds) {
      await this.prisma.unscoped.trainingAttendance.upsert({
        where: {
          sessionId_employeeId: { sessionId, employeeId },
        },
        create: {
          tenantId: session.tenantId,
          companyId: session.companyId,
          sessionId,
          employeeId,
        },
        update: {},
      });
    }

    await this.auditService.log({
      tenantId: session.tenantId,
      userId: user.id,
      action: 'create',
      module: 'training',
      recordId: sessionId,
      newValue: { registeredEmployees: dto.employeeIds.length },
    });

    return this.listAttendance(session.companyId, { sessionId });
  }

  async updateAttendance(
    attendanceId: string,
    dto: UpdateTrainingAttendanceDto,
    user: AuthenticatedUser,
  ): Promise<TrainingAttendanceRecord> {
    const existing = await this.prisma.unscoped.trainingAttendance.findUnique({
      where: { id: attendanceId },
      include: { session: true },
    });
    if (!existing) {
      throw new NotFoundException('Training attendance record not found');
    }

    const now = new Date();
    const status = dto.status ?? existing.status;
    const row = await this.prisma.unscoped.trainingAttendance.update({
      where: { id: attendanceId },
      data: {
        status,
        score: dto.score,
        notes: dto.notes?.trim(),
        attendedAt:
          status === TrainingAttendanceStatus.attended ||
          status === TrainingAttendanceStatus.completed
            ? existing.attendedAt ?? now
            : existing.attendedAt,
        completedAt:
          status === TrainingAttendanceStatus.completed
            ? existing.completedAt ?? now
            : existing.completedAt,
      },
      include: {
        session: {
          select: {
            title: true,
            scheduledStart: true,
            course: { select: { title: true } },
          },
        },
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            department: { select: { name: true } },
          },
        },
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: attendanceId,
      newValue: { ...dto },
    });

    return this.toAttendanceRecord(row as AttendanceWithRelations);
  }

  private sessionInclude() {
    return {
      course: { select: { title: true, category: true } },
      costs: true,
      _count: { select: { attendances: true } },
      attendances: { select: { status: true } },
    };
  }

  private async getSessionOrThrow(sessionId: string): Promise<TrainingSession> {
    const row = await this.prisma.unscoped.trainingSession.findUnique({
      where: { id: sessionId },
    });
    if (!row) {
      throw new NotFoundException('Training session not found');
    }
    return row;
  }

  private toSessionRecord(row: SessionWithRelations): TrainingSessionRecord {
    const { total, currency } = sumCosts(row.costs);
    const completedCount = row.attendances.filter(
      (item) => item.status === TrainingAttendanceStatus.completed,
    ).length;

    return {
      id: row.id,
      companyId: row.companyId,
      courseId: row.courseId,
      courseTitle: row.course.title,
      courseCategory: row.course.category,
      title: row.title,
      displayTitle: row.title?.trim() || row.course.title,
      scheduledStart: row.scheduledStart.toISOString(),
      scheduledEnd: row.scheduledEnd?.toISOString() ?? null,
      location: row.location,
      instructor: row.instructor,
      status: row.status,
      notes: row.notes,
      attendeeCount: row._count.attendances,
      completedCount,
      totalCost: total,
      currency,
      costs: row.costs.map((cost) => this.toCostRecord(cost)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toCostRecord(row: TrainingSessionCost): TrainingSessionCostRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      category: row.category as TrainingSessionCostRecord['category'],
      description: row.description,
      amount: decimalToNumber(row.amount) ?? 0,
      currency: row.currency,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toAttendanceRecord(row: AttendanceWithRelations): TrainingAttendanceRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      sessionId: row.sessionId,
      sessionTitle: row.session.title ?? row.session.course.title,
      courseTitle: row.session.course.title,
      scheduledStart: row.session.scheduledStart.toISOString(),
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      departmentName: row.employee.department?.name ?? null,
      status: row.status,
      registeredAt: row.registeredAt.toISOString(),
      attendedAt: row.attendedAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      score: row.score,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
