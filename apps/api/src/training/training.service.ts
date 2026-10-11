import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TrainingAttendanceStatus,
  TrainingCourseStatus,
  TrainingSessionStatus,
  type TrainingCourse,
} from '@prisma/client';
import type {
  TrainingCourseRecord,
  TrainingSummary,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { CurrencyPayrollService } from '../currency/currency-payroll.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
import type {
  CreateTrainingCourseDto,
  ListTrainingCoursesQueryDto,
  UpdateTrainingCourseDto,
} from './dto/training.dto';
import { startOfUtcDay, CERTIFICATION_EXPIRY_WARNING_DAYS } from './training.utils';
import { assertCourseTransition, summarizeSessionCosts } from './training.rules';

const OPEN_SESSION_STATUSES = [TrainingSessionStatus.scheduled, TrainingSessionStatus.in_progress];

type CourseWithStats = TrainingCourse & {
  _count: { sessions: number };
  sessions: Array<{
    status: TrainingSessionStatus;
    scheduledStart: Date;
    attendances: Array<{ status: TrainingAttendanceStatus }>;
  }>;
};

function trimOrNull(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly dataScope: DataScopeService,
    private readonly currency: CurrencyPayrollService,
  ) {}

  /** Training costs are recorded in the company's base currency. */
  companyCurrency(companyId: string): Promise<string> {
    return this.currency.resolveCompanyBaseCurrency(companyId);
  }

  async getSummary(companyId: string, user: AuthenticatedUser): Promise<TrainingSummary> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const employeeId = await this.dataScope.employeeIdFilter(user);

    const today = startOfUtcDay(new Date());
    const windowEnd = new Date(today);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + CERTIFICATION_EXPIRY_WARNING_DAYS);

    const [activeCourseCount, upcomingSessionCount, attendances, costs, currency, expiringCertificationCount, skillAssignmentCount] =
      await Promise.all([
        this.prisma.unscoped.trainingCourse.count({
          where: { companyId, status: TrainingCourseStatus.active },
        }),
        this.prisma.unscoped.trainingSession.count({
          where: {
            companyId,
            status: TrainingSessionStatus.scheduled,
            scheduledStart: { gte: new Date() },
          },
        }),
        this.prisma.unscoped.trainingAttendance.findMany({
          where: { companyId, employeeId, status: { not: TrainingAttendanceStatus.cancelled } },
          select: { status: true },
        }),
        this.prisma.unscoped.trainingSessionCost.findMany({
          where: { companyId },
          select: { amount: true, currency: true },
        }),
        this.companyCurrency(companyId),
        this.prisma.unscoped.employeeCertification.count({
          where: {
            companyId,
            employeeId,
            status: 'active',
            expiryDate: { gte: today, lte: windowEnd },
          },
        }),
        this.prisma.unscoped.employeeSkill.count({ where: { companyId, employeeId } }),
      ]);

    const totalAttendees = attendances.length;
    const completed = attendances.filter(
      (row) => row.status === TrainingAttendanceStatus.completed,
    ).length;
    const completionRatePercent =
      totalAttendees > 0 ? Math.round((completed / totalAttendees) * 100) : null;

    const { totalCost } = summarizeSessionCosts(
      costs.map((row) => ({ amount: row.amount.toNumber(), currency: row.currency })),
      currency,
      { attendedCount: 0, enrolledCount: 0 },
    );

    return {
      activeCourseCount,
      upcomingSessionCount,
      totalAttendees,
      completionRatePercent,
      totalTrainingCost: totalCost,
      currency,
      expiringCertificationCount,
      skillAssignmentCount,
    };
  }

  async listCourses(
    companyId: string,
    query: ListTrainingCoursesQueryDto,
  ): Promise<TrainingCourseRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.trainingCourse.findMany({
      where: {
        companyId,
        category: query.category,
        status: query.activeOnly
          ? TrainingCourseStatus.active
          : query.status,
      },
      include: this.courseInclude(),
      orderBy: [{ status: 'asc' }, { title: 'asc' }],
    });

    return rows.map((row) => this.toCourseRecord(row as CourseWithStats));
  }

  async createCourse(
    companyId: string,
    dto: CreateTrainingCourseDto,
    user: AuthenticatedUser,
  ): Promise<TrainingCourseRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const title = dto.title.trim();
    await this.assertTitleAvailable(companyId, title);

    try {
      const row = await this.prisma.unscoped.trainingCourse.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          title,
          description: dto.description?.trim() || null,
          category: dto.category?.trim() || null,
          deliveryMode: dto.deliveryMode ?? 'instructor_led',
          durationMinutes: dto.durationMinutes,
          isMandatory: dto.isMandatory ?? false,
          status: dto.status ?? TrainingCourseStatus.active,
          createdByUserId: user.id,
        },
        include: this.courseInclude(),
      });

      await this.auditService.log({
        tenantId: company.tenantId,
        userId: user.id,
        action: 'create',
        module: 'training',
        recordId: row.id,
        newValue: { title: row.title, status: row.status, isMandatory: row.isMandatory },
      });

      return this.toCourseRecord(row as CourseWithStats);
    } catch (error) {
      throw this.duplicateTitleError(error) ?? error;
    }
  }

  async updateCourse(
    courseId: string,
    dto: UpdateTrainingCourseDto,
    user: AuthenticatedUser,
  ): Promise<TrainingCourseRecord> {
    const existing = await this.getCourseOrThrow(courseId, user.tenantId);
    const title = dto.title?.trim();
    if (title && title.toLowerCase() !== existing.title.toLowerCase()) {
      await this.assertTitleAvailable(existing.companyId, title, courseId);
    }

    if (dto.status && dto.status !== existing.status) {
      const [sessionCount, openSessionCount] = await Promise.all([
        this.prisma.unscoped.trainingSession.count({ where: { courseId } }),
        this.prisma.unscoped.trainingSession.count({
          where: { courseId, status: { in: OPEN_SESSION_STATUSES } },
        }),
      ]);
      assertCourseTransition(existing.status, dto.status, { sessionCount, openSessionCount });
    }

    try {
      const row = await this.prisma.unscoped.trainingCourse.update({
        where: { id: courseId },
        data: {
          title,
          description: trimOrNull(dto.description),
          category: trimOrNull(dto.category),
          deliveryMode: dto.deliveryMode,
          durationMinutes: dto.durationMinutes,
          isMandatory: dto.isMandatory,
          status: dto.status,
        },
        include: this.courseInclude(),
      });

      await this.auditService.log({
        tenantId: existing.tenantId,
        userId: user.id,
        action: 'update',
        module: 'training',
        recordId: courseId,
        oldValue: Object.fromEntries(
          Object.keys(dto).map((key) => [key, existing[key as keyof TrainingCourse] ?? null]),
        ),
        newValue: { ...dto },
      });

      return this.toCourseRecord(row as CourseWithStats);
    } catch (error) {
      throw this.duplicateTitleError(error) ?? error;
    }
  }

  async getCourseOrThrow(courseId: string, tenantId: string | null): Promise<TrainingCourse> {
    const row = tenantId
      ? await this.prisma.unscoped.trainingCourse.findFirst({ where: { id: courseId, tenantId } })
      : null;
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Training course not found' });
    }
    return row;
  }

  private async assertTitleAvailable(companyId: string, title: string, exceptId?: string) {
    const clash = await this.prisma.unscoped.trainingCourse.findFirst({
      where: {
        companyId,
        title: { equals: title, mode: 'insensitive' },
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
      select: { id: true },
    });
    if (clash) {
      throw new ConflictException({
        code: 'DUPLICATE_COURSE',
        message: `A course called "${title}" is already in the catalog`,
      });
    }
  }

  private duplicateTitleError(error: unknown): ConflictException | null {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new ConflictException({
        code: 'DUPLICATE_COURSE',
        message: 'A course with this title is already in the catalog',
      });
    }
    return null;
  }

  private courseInclude() {
    return {
      _count: { select: { sessions: true } },
      sessions: {
        select: {
          status: true,
          scheduledStart: true,
          attendances: { select: { status: true } },
        },
      },
    } satisfies Prisma.TrainingCourseInclude;
  }

  private toCourseRecord(row: CourseWithStats): TrainingCourseRecord {
    const attendances = row.sessions.flatMap((session) => session.attendances);
    const open = row.sessions
      .filter((session) => OPEN_SESSION_STATUSES.includes(session.status as (typeof OPEN_SESSION_STATUSES)[number]))
      .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime());
    const now = Date.now();
    const next = open.find((session) => session.scheduledStart.getTime() >= now) ?? open[0];
    return {
      id: row.id,
      companyId: row.companyId,
      title: row.title,
      description: row.description,
      category: row.category,
      deliveryMode: row.deliveryMode,
      durationMinutes: row.durationMinutes,
      isMandatory: row.isMandatory,
      status: row.status,
      sessionCount: row._count.sessions,
      upcomingSessionCount: open.length,
      nextSessionStart: next?.scheduledStart.toISOString() ?? null,
      enrolledCount: attendances.filter((item) => item.status !== TrainingAttendanceStatus.cancelled).length,
      completedCount: attendances.filter((item) => item.status === TrainingAttendanceStatus.completed).length,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
