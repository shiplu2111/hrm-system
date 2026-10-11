import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EmploymentStatus,
  Prisma,
  TrainingAttendanceStatus,
  TrainingSessionStatus,
  type TrainingSession,
  type TrainingSessionCost,
} from '@prisma/client';
import type {
  TrainingAttendanceMarkStatus,
  TrainingAttendanceRecord,
  TrainingEnrollmentResult,
  TrainingSessionCostRecord,
  TrainingSessionRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
import type {
  CreateTrainingSessionCostDto,
  CreateTrainingSessionDto,
  ListTrainingAttendanceQueryDto,
  ListTrainingSessionsQueryDto,
  MarkTrainingAttendanceDto,
  RegisterTrainingAttendanceDto,
  UpdateTrainingAttendanceDto,
  UpdateTrainingSessionCostDto,
  UpdateTrainingSessionDto,
} from './dto/training.dto';
import { TrainingService } from './training.service';
import { decimalToNumber, toDecimal } from './training.utils';
import {
  assertCanEnrol,
  assertCanMark,
  assertCanWithdraw,
  assertCourseSchedulable,
  assertSessionDetailsEditable,
  assertSessionTransition,
  assertSessionWindow,
  attendanceCounts,
  attendanceFields,
  summarizeSessionCosts,
} from './training.rules';

type SessionWithRelations = TrainingSession & {
  course: {
    title: string;
    category: string | null;
    deliveryMode: TrainingSessionRecord['courseDeliveryMode'];
    status: TrainingSessionRecord['courseStatus'];
  };
  costs: TrainingSessionCost[];
  attendances: Array<{ status: TrainingAttendanceStatus }>;
};

type SessionForRules = TrainingSession & { course: { status: TrainingSessionRecord['courseStatus'] } };

const ATTENDANCE_INCLUDE = {
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
} satisfies Prisma.TrainingAttendanceInclude;

type AttendanceWithRelations = Prisma.TrainingAttendanceGetPayload<{ include: typeof ATTENDANCE_INCLUDE }>;

function trimOrNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}

function personName(row: { firstName: string; lastName: string }): string {
  return `${row.firstName} ${row.lastName}`.trim();
}

@Injectable()
export class TrainingSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly trainingService: TrainingService,
    private readonly dataScope: DataScopeService,
  ) {}

  async listSessions(
    companyId: string,
    query: ListTrainingSessionsQueryDto,
  ): Promise<TrainingSessionRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const [rows, currency] = await Promise.all([
      this.prisma.unscoped.trainingSession.findMany({
        where: {
          companyId,
          courseId: query.courseId,
          status: query.status,
        },
        include: this.sessionInclude(),
        orderBy: [{ scheduledStart: 'desc' }],
      }),
      this.trainingService.companyCurrency(companyId),
    ]);

    return rows.map((row) => this.toSessionRecord(row as SessionWithRelations, currency));
  }

  async getSession(sessionId: string, user: AuthenticatedUser): Promise<TrainingSessionRecord> {
    const session = await this.getSessionOrThrow(sessionId, user.tenantId);
    return this.sessionRecord(session.id, session.companyId);
  }

  async createSession(
    companyId: string,
    dto: CreateTrainingSessionDto,
    user: AuthenticatedUser,
  ): Promise<TrainingSessionRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const course = await this.trainingService.getCourseOrThrow(dto.courseId, company.tenantId);
    if (course.companyId !== companyId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Training course not found' });
    }
    assertCourseSchedulable(course.status);

    const scheduledStart = new Date(dto.scheduledStart);
    const scheduledEnd = dto.scheduledEnd ? new Date(dto.scheduledEnd) : null;
    assertSessionWindow(scheduledStart, scheduledEnd);

    const row = await this.prisma.unscoped.trainingSession.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        courseId: dto.courseId,
        title: dto.title?.trim() || null,
        scheduledStart,
        scheduledEnd,
        location: dto.location?.trim() || null,
        instructor: dto.instructor?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdByUserId: user.id,
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'training',
      recordId: row.id,
      newValue: { courseId: dto.courseId, scheduledStart: dto.scheduledStart, scheduledEnd: dto.scheduledEnd },
    });

    return this.sessionRecord(row.id, companyId);
  }

  async updateSession(
    sessionId: string,
    dto: UpdateTrainingSessionDto,
    user: AuthenticatedUser,
  ): Promise<TrainingSessionRecord> {
    const existing = await this.getSessionOrThrow(sessionId, user.tenantId);
    const statusChange = dto.status !== undefined && dto.status !== existing.status;
    const detailChange = (['title', 'scheduledStart', 'scheduledEnd', 'location', 'instructor', 'notes'] as const).some(
      (key) => dto[key] !== undefined,
    );
    const scheduleChange = dto.scheduledStart !== undefined || dto.scheduledEnd !== undefined;

    if (detailChange) {
      assertSessionDetailsEditable(existing.status, scheduleChange);
    }
    const scheduledStart = dto.scheduledStart ? new Date(dto.scheduledStart) : existing.scheduledStart;
    const scheduledEnd =
      dto.scheduledEnd === undefined ? existing.scheduledEnd : dto.scheduledEnd ? new Date(dto.scheduledEnd) : null;
    if (scheduleChange) {
      assertSessionWindow(scheduledStart, scheduledEnd);
    }

    let withdrawn = 0;
    if (statusChange) {
      const counts = attendanceCounts(
        (await this.prisma.unscoped.trainingAttendance.findMany({ where: { sessionId }, select: { status: true } })).map(
          (row) => row.status,
        ),
      );
      assertSessionTransition(existing.status, dto.status!, {
        now: new Date(),
        scheduledStart,
        unmarkedCount: counts.unmarkedCount,
        attendedCount: counts.attendedCount,
      });
      withdrawn = dto.status === TrainingSessionStatus.cancelled ? counts.unmarkedCount : 0;
    }

    await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.trainingSession.update({
        where: { id: sessionId },
        data: {
          title: trimOrNull(dto.title),
          scheduledStart: dto.scheduledStart ? scheduledStart : undefined,
          scheduledEnd: dto.scheduledEnd !== undefined ? scheduledEnd : undefined,
          location: trimOrNull(dto.location),
          instructor: trimOrNull(dto.instructor),
          notes: trimOrNull(dto.notes),
          status: dto.status,
        },
      });
      if (withdrawn > 0) {
        await tx.trainingAttendance.updateMany({
          where: { sessionId, status: TrainingAttendanceStatus.registered },
          data: { status: TrainingAttendanceStatus.cancelled },
        });
      }
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: sessionId,
      oldValue: Object.fromEntries(
        Object.keys(dto).map((key) => [key, existing[key as keyof TrainingSession] ?? null]),
      ),
      newValue: { ...dto, ...(withdrawn > 0 ? { enrolmentsWithdrawn: withdrawn } : {}) },
    });

    return this.sessionRecord(sessionId, existing.companyId);
  }

  async addSessionCost(
    sessionId: string,
    dto: CreateTrainingSessionCostDto,
    user: AuthenticatedUser,
  ): Promise<TrainingSessionRecord> {
    const session = await this.getSessionOrThrow(sessionId, user.tenantId);
    const currency = await this.trainingService.companyCurrency(session.companyId);
    if (dto.currency && dto.currency.toUpperCase() !== currency) {
      throw new BadRequestException({
        code: 'CURRENCY_MISMATCH',
        message: `Training costs are recorded in ${currency}, the company currency`,
      });
    }

    const row = await this.prisma.unscoped.trainingSessionCost.create({
      data: {
        tenantId: session.tenantId,
        companyId: session.companyId,
        sessionId,
        category: dto.category,
        description: dto.description?.trim() || null,
        amount: toDecimal(dto.amount)!,
        currency,
      },
    });

    await this.auditService.log({
      tenantId: session.tenantId,
      userId: user.id,
      action: 'create',
      module: 'training',
      recordId: row.id,
      newValue: { sessionId, category: dto.category, amount: dto.amount, currency },
    });

    return this.sessionRecord(sessionId, session.companyId);
  }

  async updateSessionCost(
    costId: string,
    dto: UpdateTrainingSessionCostDto,
    user: AuthenticatedUser,
  ): Promise<TrainingSessionRecord> {
    const existing = await this.getCostOrThrow(costId, user.tenantId);

    await this.prisma.unscoped.trainingSessionCost.update({
      where: { id: costId },
      data: {
        category: dto.category,
        description: trimOrNull(dto.description),
        amount: dto.amount != null ? toDecimal(dto.amount) : undefined,
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: costId,
      oldValue: {
        category: existing.category,
        description: existing.description,
        amount: existing.amount.toNumber(),
      },
      newValue: { ...dto },
    });

    return this.sessionRecord(existing.sessionId, existing.companyId);
  }

  async deleteSessionCost(costId: string, user: AuthenticatedUser): Promise<TrainingSessionRecord> {
    const existing = await this.getCostOrThrow(costId, user.tenantId);

    await this.prisma.unscoped.trainingSessionCost.delete({ where: { id: costId } });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'training',
      recordId: costId,
      oldValue: {
        sessionId: existing.sessionId,
        category: existing.category,
        amount: existing.amount.toNumber(),
        currency: existing.currency,
      },
    });

    return this.sessionRecord(existing.sessionId, existing.companyId);
  }

  async listAttendance(
    companyId: string,
    query: ListTrainingAttendanceQueryDto,
    user: AuthenticatedUser,
  ): Promise<TrainingAttendanceRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (query.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, query.employeeId);
    }

    const rows = await this.prisma.unscoped.trainingAttendance.findMany({
      where: {
        companyId,
        sessionId: query.sessionId,
        employeeId: query.employeeId ?? (await this.dataScope.employeeIdFilter(user)),
        status: query.status,
        session: query.courseId ? { courseId: query.courseId } : undefined,
      },
      include: this.attendanceInclude(),
      orderBy: query.sessionId
        ? [{ employee: { firstName: 'asc' } }, { employee: { lastName: 'asc' } }]
        : [{ registeredAt: 'desc' }],
    });

    return rows.map((row) => this.toAttendanceRecord(row));
  }

  /** Enrols active employees of the session's company; people already enrolled are skipped. */
  async registerAttendance(
    sessionId: string,
    dto: RegisterTrainingAttendanceDto,
    user: AuthenticatedUser,
  ): Promise<TrainingEnrollmentResult> {
    const session = await this.getSessionOrThrow(sessionId, user.tenantId);
    assertCanEnrol(session.status, session.course.status);

    const ids = [...new Set(dto.employeeIds)];
    const scope = await this.dataScope.employeeIdFilter(user);
    const [employees, existing] = await Promise.all([
      this.prisma.unscoped.employee.findMany({
        where: { id: { in: ids }, tenantId: session.tenantId, companyId: session.companyId, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, employmentStatus: true },
      }),
      this.prisma.unscoped.trainingAttendance.findMany({
        where: { sessionId, employeeId: { in: ids } },
        select: { id: true, employeeId: true, status: true },
      }),
    ]);
    const byId = new Map(employees.map((row) => [row.id, row]));
    const existingById = new Map(existing.map((row) => [row.employeeId, row]));

    const skipped: TrainingEnrollmentResult['skipped'] = [];
    const toCreate: string[] = [];
    const toRestore: string[] = [];
    for (const employeeId of ids) {
      const employee = byId.get(employeeId);
      if (!employee) {
        skipped.push({ employeeId, employeeName: 'Unknown employee', reason: 'Not an employee of this company' });
        continue;
      }
      const name = personName(employee);
      if (scope && !scope.in.includes(employeeId)) {
        skipped.push({ employeeId, employeeName: name, reason: 'Outside your reporting line' });
      } else if (
        employee.employmentStatus === EmploymentStatus.terminated ||
        employee.employmentStatus === EmploymentStatus.inactive
      ) {
        skipped.push({ employeeId, employeeName: name, reason: 'Not an active employee' });
      } else if (existingById.get(employeeId)?.status === TrainingAttendanceStatus.cancelled) {
        toRestore.push(existingById.get(employeeId)!.id);
      } else if (existingById.has(employeeId)) {
        skipped.push({ employeeId, employeeName: name, reason: 'Already enrolled' });
      } else {
        toCreate.push(employeeId);
      }
    }

    if (toCreate.length > 0 || toRestore.length > 0) {
      const now = new Date();
      await this.prisma.unscoped.$transaction([
        this.prisma.unscoped.trainingAttendance.createMany({
          data: toCreate.map((employeeId) => ({
            tenantId: session.tenantId,
            companyId: session.companyId,
            sessionId,
            employeeId,
          })),
          skipDuplicates: true,
        }),
        this.prisma.unscoped.trainingAttendance.updateMany({
          where: { id: { in: toRestore } },
          data: {
            status: TrainingAttendanceStatus.registered,
            registeredAt: now,
            attendedAt: null,
            completedAt: null,
            score: null,
          },
        }),
      ]);

      await this.auditService.log({
        tenantId: session.tenantId,
        userId: user.id,
        action: 'create',
        module: 'training',
        recordId: sessionId,
        newValue: {
          enrolledEmployeeIds: toCreate,
          restoredEnrolmentIds: toRestore,
          skipped: skipped.length,
        },
      });
    }

    return {
      attendance: await this.listAttendance(session.companyId, { sessionId }, user),
      enrolledCount: toCreate.length,
      restoredCount: toRestore.length,
      skipped,
    };
  }

  async withdrawAttendance(attendanceId: string, user: AuthenticatedUser): Promise<TrainingAttendanceRecord> {
    const existing = await this.getAttendanceOrThrow(attendanceId, user.tenantId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId);
    assertCanWithdraw(existing.session.status, existing.status);

    const row = await this.prisma.unscoped.trainingAttendance.update({
      where: { id: attendanceId },
      data: { status: TrainingAttendanceStatus.cancelled },
      include: this.attendanceInclude(),
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: attendanceId,
      oldValue: { status: existing.status },
      newValue: { status: 'cancelled', withdrawn: true },
    });

    return this.toAttendanceRecord(row);
  }

  async updateAttendance(
    attendanceId: string,
    dto: UpdateTrainingAttendanceDto,
    user: AuthenticatedUser,
  ): Promise<TrainingAttendanceRecord> {
    const existing = await this.getAttendanceOrThrow(attendanceId, user.tenantId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId);

    const now = new Date();
    const to = (dto.status ?? existing.status) as TrainingAttendanceMarkStatus | 'cancelled';
    if (to === TrainingAttendanceStatus.cancelled) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Re-enrol the employee before changing their attendance',
      });
    }
    if (dto.status !== undefined && dto.status !== existing.status) {
      assertCanMark({
        sessionStatus: existing.session.status,
        scheduledStart: existing.session.scheduledStart,
        now,
        from: existing.status,
        to,
      });
    }
    const fields = attendanceFields(to, existing, now, dto.score);

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      const updated = await tx.trainingAttendance.update({
        where: { id: attendanceId },
        data: { status: to, ...fields, notes: trimOrNull(dto.notes) },
        include: this.attendanceInclude(),
      });
      if (to !== TrainingAttendanceStatus.registered) {
        await this.startIfScheduled(tx, existing.session);
      }
      return updated;
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: attendanceId,
      oldValue: { status: existing.status, score: existing.score, notes: existing.notes },
      newValue: { ...dto },
    });

    return this.toAttendanceRecord(row);
  }

  /** Marks several people at once, e.g. everyone present; all-or-nothing. */
  async markAttendance(
    sessionId: string,
    dto: MarkTrainingAttendanceDto,
    user: AuthenticatedUser,
  ): Promise<TrainingAttendanceRecord[]> {
    const session = await this.getSessionOrThrow(sessionId, user.tenantId);
    const ids = [...new Set(dto.attendanceIds)];
    const rows = await this.prisma.unscoped.trainingAttendance.findMany({
      where: { id: { in: ids }, sessionId },
    });
    if (rows.length !== ids.length) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Some enrolments aren’t on this session' });
    }
    const scope = await this.dataScope.employeeIdFilter(user);
    if (scope && rows.some((row) => !scope.in.includes(row.employeeId))) {
      await this.dataScope.assertEmployeeInScope(
        user,
        rows.find((row) => !scope.in.includes(row.employeeId))!.employeeId,
      );
    }

    const now = new Date();
    const to = dto.status;
    const changes = rows.filter((row) => row.status !== to);
    for (const row of changes) {
      assertCanMark({
        sessionStatus: session.status,
        scheduledStart: session.scheduledStart,
        now,
        from: row.status,
        to,
      });
    }

    if (changes.length > 0) {
      await this.prisma.unscoped.$transaction(async (tx) => {
        for (const row of changes) {
          await tx.trainingAttendance.update({
            where: { id: row.id },
            data: { status: to, ...attendanceFields(to, row, now, undefined) },
          });
        }
        if (to !== TrainingAttendanceStatus.registered) {
          await this.startIfScheduled(tx, session);
        }
      });

      await this.auditService.log({
        tenantId: session.tenantId,
        userId: user.id,
        action: 'update',
        module: 'training',
        recordId: sessionId,
        newValue: { attendanceStatus: to, attendanceIds: changes.map((row) => row.id) },
      });
    }

    return this.listAttendance(session.companyId, { sessionId }, user);
  }

  private async startIfScheduled(tx: Prisma.TransactionClient, session: TrainingSession) {
    if (session.status === TrainingSessionStatus.scheduled) {
      await tx.trainingSession.updateMany({
        where: { id: session.id, status: TrainingSessionStatus.scheduled },
        data: { status: TrainingSessionStatus.in_progress },
      });
    }
  }

  private sessionInclude() {
    return {
      course: { select: { title: true, category: true, deliveryMode: true, status: true } },
      costs: { orderBy: { createdAt: 'asc' } },
      attendances: { select: { status: true } },
    } satisfies Prisma.TrainingSessionInclude;
  }

  private attendanceInclude() {
    return ATTENDANCE_INCLUDE;
  }

  private async sessionRecord(sessionId: string, companyId: string): Promise<TrainingSessionRecord> {
    const [row, currency] = await Promise.all([
      this.prisma.unscoped.trainingSession.findUniqueOrThrow({
        where: { id: sessionId },
        include: this.sessionInclude(),
      }),
      this.trainingService.companyCurrency(companyId),
    ]);
    return this.toSessionRecord(row as SessionWithRelations, currency);
  }

  private async getSessionOrThrow(sessionId: string, tenantId: string | null): Promise<SessionForRules> {
    const row = tenantId
      ? await this.prisma.unscoped.trainingSession.findFirst({
          where: { id: sessionId, tenantId },
          include: { course: { select: { status: true } } },
        })
      : null;
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Training session not found' });
    }
    return row;
  }

  private async getCostOrThrow(costId: string, tenantId: string | null): Promise<TrainingSessionCost> {
    const row = tenantId
      ? await this.prisma.unscoped.trainingSessionCost.findFirst({ where: { id: costId, tenantId } })
      : null;
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Training session cost not found' });
    }
    return row;
  }

  private async getAttendanceOrThrow(attendanceId: string, tenantId: string | null) {
    const row = tenantId
      ? await this.prisma.unscoped.trainingAttendance.findFirst({
          where: { id: attendanceId, tenantId },
          include: { session: true },
        })
      : null;
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Training enrolment not found' });
    }
    return row;
  }

  private toSessionRecord(row: SessionWithRelations, currency: string): TrainingSessionRecord {
    const counts = attendanceCounts(row.attendances.map((item) => item.status));
    const costSummary = summarizeSessionCosts(
      row.costs.map((cost) => ({ amount: cost.amount.toNumber(), currency: cost.currency })),
      currency,
      counts,
    );

    return {
      id: row.id,
      companyId: row.companyId,
      courseId: row.courseId,
      courseTitle: row.course.title,
      courseCategory: row.course.category,
      courseDeliveryMode: row.course.deliveryMode,
      courseStatus: row.course.status,
      title: row.title,
      displayTitle: row.title?.trim() || row.course.title,
      scheduledStart: row.scheduledStart.toISOString(),
      scheduledEnd: row.scheduledEnd?.toISOString() ?? null,
      location: row.location,
      instructor: row.instructor,
      status: row.status,
      notes: row.notes,
      attendeeCount: counts.enrolledCount,
      ...counts,
      currency,
      ...costSummary,
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
      employeeName: personName(row.employee),
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
