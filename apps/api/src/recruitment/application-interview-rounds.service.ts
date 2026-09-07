import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ApplicationStage,
  InterviewRoundStatus,
  InterviewRoundType,
  Prisma,
  type JobApplicationInterviewRound,
} from '@prisma/client';
import type { InterviewRoundRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CompleteInterviewRoundDto,
  ScheduleInterviewRoundDto,
  SkipInterviewRoundDto,
} from './dto/recruitment.dto';
import {
  INTERVIEW_ROUND_SEQUENCE,
  averageInterviewScore,
  isPositiveRecommendation,
  resolveInterviewRecommendation,
  resolveInterviewRoundLabel,
  resolveInterviewRoundStatus,
} from './recruitment.utils';

type RoundWithRelations = JobApplicationInterviewRound & {
  interviewer: { firstName: string; lastName: string } | null;
};

@Injectable()
export class ApplicationInterviewRoundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async listByApplication(applicationId: string): Promise<InterviewRoundRecord[]> {
    const application = await this.findApplicationOrThrow(applicationId);
    await this.companyScope.assertCompanyInTenant(application.companyId);

    await this.ensureRounds(applicationId);

    const rows = await this.prisma.unscoped.jobApplicationInterviewRound.findMany({
      where: { applicationId },
      include: this.defaultInclude(),
      orderBy: [{ roundOrder: 'asc' }],
    });

    return rows.map((row) => this.toRecord(row));
  }

  async ensureRounds(applicationId: string): Promise<InterviewRoundRecord[]> {
    const application = await this.findApplicationOrThrow(applicationId);
    await this.companyScope.assertCompanyInTenant(application.companyId);

    const existing = await this.prisma.unscoped.jobApplicationInterviewRound.count({
      where: { applicationId },
    });
    if (existing >= INTERVIEW_ROUND_SEQUENCE.length) {
      const rows = await this.prisma.unscoped.jobApplicationInterviewRound.findMany({
        where: { applicationId },
        include: this.defaultInclude(),
        orderBy: [{ roundOrder: 'asc' }],
      });
      return rows.map((row) => this.toRecord(row));
    }

    for (const round of INTERVIEW_ROUND_SEQUENCE) {
      await this.prisma.unscoped.jobApplicationInterviewRound.upsert({
        where: {
          applicationId_roundType: {
            applicationId,
            roundType: round.roundType as InterviewRoundType,
          },
        },
        create: {
          tenantId: application.tenantId,
          companyId: application.companyId,
          applicationId,
          roundType: round.roundType as InterviewRoundType,
          roundOrder: round.roundOrder,
          status: InterviewRoundStatus.pending,
        },
        update: {},
      });
    }

    return this.listByApplication(applicationId);
  }

  async schedule(
    roundId: string,
    dto: ScheduleInterviewRoundDto,
    user: AuthenticatedUser,
  ): Promise<InterviewRoundRecord> {
    const round = await this.findOrThrow(roundId);
    await this.companyScope.assertCompanyInTenant(round.companyId);
    await this.assertRoundActionable(round);

    if (
      round.status !== InterviewRoundStatus.pending &&
      round.status !== InterviewRoundStatus.scheduled
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only pending or scheduled rounds can be rescheduled',
      });
    }

    if (dto.interviewerEmployeeId) {
      await this.prisma.unscoped.employee.findFirstOrThrow({
        where: {
          id: dto.interviewerEmployeeId,
          companyId: round.companyId,
          deletedAt: null,
        },
      });
    }

    const scheduledStartAt = new Date(dto.scheduledStartAt);
    const scheduledEndAt = dto.scheduledEndAt
      ? new Date(dto.scheduledEndAt)
      : null;
    if (scheduledEndAt && scheduledEndAt <= scheduledStartAt) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'End time must be after start time',
      });
    }

    const updated = await this.prisma.unscoped.jobApplicationInterviewRound.update({
      where: { id: roundId },
      data: {
        status: InterviewRoundStatus.scheduled,
        scheduledStartAt,
        scheduledEndAt,
        location: dto.location?.trim() ?? null,
        meetingUrl: dto.meetingUrl?.trim() ?? null,
        interviewerEmployeeId: dto.interviewerEmployeeId ?? null,
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: updated.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: updated.applicationId,
      newValue: { interviewRoundScheduled: updated.roundType },
    });

    return this.toRecord(updated);
  }

  async complete(
    roundId: string,
    dto: CompleteInterviewRoundDto,
    user: AuthenticatedUser,
  ): Promise<InterviewRoundRecord> {
    const round = await this.findOrThrow(roundId);
    await this.companyScope.assertCompanyInTenant(round.companyId);
    await this.assertRoundActionable(round);

    if (
      round.status !== InterviewRoundStatus.scheduled &&
      round.status !== InterviewRoundStatus.pending
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Round is not open for completion',
      });
    }

    const updated = await this.prisma.unscoped.jobApplicationInterviewRound.update({
      where: { id: roundId },
      data: {
        status: InterviewRoundStatus.completed,
        score: dto.score,
        recommendation: dto.recommendation,
        feedback: dto.feedback?.trim() ?? null,
        completedAt: new Date(),
        completedByUserId: user.id,
      },
      include: this.defaultInclude(),
    });

    await this.syncApplicationAfterRound(updated.applicationId, user);

    await this.auditService.log({
      tenantId: updated.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: updated.applicationId,
      newValue: {
        interviewRoundCompleted: updated.roundType,
        score: dto.score,
        recommendation: dto.recommendation,
      },
    });

    return this.toRecord(updated);
  }

  async skip(
    roundId: string,
    dto: SkipInterviewRoundDto,
    user: AuthenticatedUser,
  ): Promise<InterviewRoundRecord> {
    const round = await this.findOrThrow(roundId);
    await this.companyScope.assertCompanyInTenant(round.companyId);
    await this.assertRoundActionable(round);

    if (round.status === InterviewRoundStatus.completed) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Completed rounds cannot be skipped',
      });
    }

    const updated = await this.prisma.unscoped.jobApplicationInterviewRound.update({
      where: { id: roundId },
      data: {
        status: InterviewRoundStatus.skipped,
        feedback: dto.feedback?.trim() ?? null,
        completedAt: new Date(),
        completedByUserId: user.id,
      },
      include: this.defaultInclude(),
    });

    await this.auditService.log({
      tenantId: updated.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: updated.applicationId,
      newValue: { interviewRoundSkipped: updated.roundType },
    });

    return this.toRecord(updated);
  }

  private async syncApplicationAfterRound(
    applicationId: string,
    user: AuthenticatedUser,
  ) {
    const rounds = await this.prisma.unscoped.jobApplicationInterviewRound.findMany({
      where: { applicationId },
      orderBy: [{ roundOrder: 'asc' }],
    });

    const completedScores = rounds
      .filter((r) => r.status === InterviewRoundStatus.completed && r.score != null)
      .map((r) => Number(r.score));

    const avgRating = averageInterviewScore(completedScores);

    const finalRound = rounds.find(
      (r) => r.roundType === InterviewRoundType.final_decision,
    );

    const application = await this.findApplicationOrThrow(applicationId);
    let nextStage = application.stage;

    if (
      finalRound?.status === InterviewRoundStatus.completed &&
      finalRound.recommendation &&
      isPositiveRecommendation(finalRound.recommendation)
    ) {
      nextStage = ApplicationStage.offer;
    } else if (
      finalRound?.status === InterviewRoundStatus.completed &&
      finalRound.recommendation &&
      !isPositiveRecommendation(finalRound.recommendation) &&
      finalRound.recommendation !== 'neutral'
    ) {
      nextStage = ApplicationStage.rejected;
    }

    await this.prisma.unscoped.jobApplication.update({
      where: { id: applicationId },
      data: {
        ...(avgRating != null ? { rating: avgRating } : {}),
        ...(nextStage !== application.stage
          ? { stage: nextStage, stageUpdatedAt: new Date() }
          : {}),
      },
    });

    if (nextStage !== application.stage) {
      await this.auditService.log({
        tenantId: application.tenantId,
        userId: user.id,
        action: 'update',
        module: 'recruitment',
        recordId: applicationId,
        newValue: { stage: nextStage, reason: 'final_interview_decision' },
      });
    }
  }

  private async assertRoundActionable(round: JobApplicationInterviewRound) {
    if (round.roundOrder === 1) return;

    const previous = await this.prisma.unscoped.jobApplicationInterviewRound.findFirst({
      where: {
        applicationId: round.applicationId,
        roundOrder: round.roundOrder - 1,
      },
    });

    if (
      !previous ||
      (previous.status !== InterviewRoundStatus.completed &&
        previous.status !== InterviewRoundStatus.skipped)
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Previous interview round must be completed or skipped first',
      });
    }
  }

  async findOrThrow(roundId: string): Promise<RoundWithRelations> {
    const row = await this.prisma.unscoped.jobApplicationInterviewRound.findUnique({
      where: { id: roundId },
      include: this.defaultInclude(),
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Interview round not found',
      });
    }
    return row;
  }

  private async findApplicationOrThrow(applicationId: string) {
    const row = await this.prisma.unscoped.jobApplication.findUnique({
      where: { id: applicationId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Job application not found',
      });
    }
    return row;
  }

  private defaultInclude(): Prisma.JobApplicationInterviewRoundInclude {
    return {
      interviewer: { select: { firstName: true, lastName: true } },
    };
  }

  private toRecord(row: RoundWithRelations): InterviewRoundRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      applicationId: row.applicationId,
      roundType: row.roundType,
      roundOrder: row.roundOrder,
      displayRound: resolveInterviewRoundLabel(row.roundType),
      status: row.status,
      displayStatus: resolveInterviewRoundStatus(row.status),
      scheduledStartAt: row.scheduledStartAt?.toISOString() ?? null,
      scheduledEndAt: row.scheduledEndAt?.toISOString() ?? null,
      location: row.location,
      meetingUrl: row.meetingUrl,
      interviewerEmployeeId: row.interviewerEmployeeId,
      interviewerName: row.interviewer
        ? `${row.interviewer.firstName} ${row.interviewer.lastName}`.trim()
        : undefined,
      score: row.score != null ? Number(row.score) : null,
      recommendation: row.recommendation,
      displayRecommendation: row.recommendation
        ? resolveInterviewRecommendation(row.recommendation)
        : null,
      feedback: row.feedback,
      completedAt: row.completedAt?.toISOString() ?? null,
      completedByUserId: row.completedByUserId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
