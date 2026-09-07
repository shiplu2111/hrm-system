import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
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
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateTrainingCourseDto,
  ListTrainingCoursesQueryDto,
  UpdateTrainingCourseDto,
} from './dto/training.dto';
import { decimalToNumber, sumCosts, startOfUtcDay, CERTIFICATION_EXPIRY_WARNING_DAYS } from './training.utils';

type CourseWithCounts = TrainingCourse & {
  _count: { sessions: number };
  sessions: Array<{ _count: { attendances: number } }>;
};

@Injectable()
export class TrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async getSummary(companyId: string): Promise<TrainingSummary> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const today = startOfUtcDay(new Date());
    const windowEnd = new Date(today);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + CERTIFICATION_EXPIRY_WARNING_DAYS);

    const [activeCourseCount, upcomingSessionCount, attendances, costs, company, expiringCertificationCount, skillAssignmentCount] =
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
          where: { companyId },
          select: { status: true },
        }),
        this.prisma.unscoped.trainingSessionCost.findMany({
          where: { companyId },
          select: { amount: true, currency: true },
        }),
        this.prisma.unscoped.company.findUnique({
          where: { id: companyId },
          select: { country: { select: { currency: true } } },
        }),
        this.prisma.unscoped.employeeCertification.count({
          where: {
            companyId,
            status: 'active',
            expiryDate: { gte: today, lte: windowEnd },
          },
        }),
        this.prisma.unscoped.employeeSkill.count({ where: { companyId } }),
      ]);

    const totalAttendees = attendances.length;
    const completed = attendances.filter(
      (row) => row.status === TrainingAttendanceStatus.completed,
    ).length;
    const completionRatePercent =
      totalAttendees > 0 ? Math.round((completed / totalAttendees) * 100) : null;

    const defaultCurrency = company?.country.currency ?? 'AUD';
    const { total, currency } = sumCosts(costs, defaultCurrency);

    return {
      activeCourseCount,
      upcomingSessionCount,
      totalAttendees,
      completionRatePercent,
      totalTrainingCost: total,
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
      include: {
        _count: { select: { sessions: true } },
        sessions: {
          select: { _count: { select: { attendances: true } } },
        },
      },
      orderBy: [{ status: 'asc' }, { title: 'asc' }],
    });

    return rows.map((row) => this.toCourseRecord(row as CourseWithCounts));
  }

  async createCourse(
    companyId: string,
    dto: CreateTrainingCourseDto,
    user: AuthenticatedUser,
  ): Promise<TrainingCourseRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    try {
      const row = await this.prisma.unscoped.trainingCourse.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          title: dto.title.trim(),
          description: dto.description?.trim(),
          category: dto.category?.trim(),
          deliveryMode: dto.deliveryMode ?? 'instructor_led',
          durationMinutes: dto.durationMinutes,
          isMandatory: dto.isMandatory ?? false,
          status: dto.status ?? TrainingCourseStatus.active,
          createdByUserId: user.id,
        },
        include: {
          _count: { select: { sessions: true } },
          sessions: { select: { _count: { select: { attendances: true } } } },
        },
      });

      await this.auditService.log({
        tenantId: company.tenantId,
        userId: user.id,
        action: 'create',
        module: 'training',
        recordId: row.id,
        newValue: { title: row.title },
      });

      return this.toCourseRecord(row as CourseWithCounts);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unique constraint')) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'A course with this title already exists',
        });
      }
      throw error;
    }
  }

  async updateCourse(
    courseId: string,
    dto: UpdateTrainingCourseDto,
    user: AuthenticatedUser,
  ): Promise<TrainingCourseRecord> {
    const existing = await this.getCourseOrThrow(courseId);

    const row = await this.prisma.unscoped.trainingCourse.update({
      where: { id: courseId },
      data: {
        title: dto.title?.trim(),
        description: dto.description?.trim(),
        category: dto.category?.trim(),
        deliveryMode: dto.deliveryMode,
        durationMinutes: dto.durationMinutes,
        isMandatory: dto.isMandatory,
        status: dto.status,
      },
      include: {
        _count: { select: { sessions: true } },
        sessions: { select: { _count: { select: { attendances: true } } } },
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: courseId,
      newValue: { ...dto },
    });

    return this.toCourseRecord(row as CourseWithCounts);
  }

  async getCourseOrThrow(courseId: string): Promise<TrainingCourse> {
    const row = await this.prisma.unscoped.trainingCourse.findUnique({
      where: { id: courseId },
    });
    if (!row) {
      throw new NotFoundException('Training course not found');
    }
    return row;
  }

  private toCourseRecord(row: CourseWithCounts): TrainingCourseRecord {
    const enrolledCount = row.sessions.reduce(
      (sum, session) => sum + session._count.attendances,
      0,
    );
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
      enrolledCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
