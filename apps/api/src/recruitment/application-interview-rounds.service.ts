import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import type {
  InterviewRoundRecord,
  InterviewScheduleItem,
  InterviewScorecard,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { NotificationEngineService } from '../notifications/notification-engine.service';
import {
  buildInterviewScheduledVariables,
  formatInterviewSlot,
} from '../notifications/notification.helpers';
import { CompanyScopeService } from '../organization/company-scope.service';
import { StorageService } from '../storage/storage.service';
import type {
  CancelInterviewRoundDto,
  CompleteInterviewRoundDto,
  ListInterviewScheduleQueryDto,
  ListMyInterviewsQueryDto,
  ScheduleInterviewRoundDto,
  SkipInterviewRoundDto,
} from './dto/recruitment.dto';
import {
  INTERVIEW_ROUND_SEQUENCE,
  averageInterviewScore,
  formatCandidateName,
  isPositiveRecommendation,
  resolveInterviewRecommendation,
  resolveInterviewRoundLabel,
  resolveInterviewRoundStatus,
} from './recruitment.utils';
import {
  buildInterviewScorecard,
  findInterviewerConflict,
  isRoundNextInLine,
  parseInterviewScorecard,
} from './interview-scorecard.utils';

const ROUND_INCLUDE = {
  interviewer: { select: { firstName: true, lastName: true } },
  completedBy: {
    select: {
      email: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.JobApplicationInterviewRoundInclude;

const SCHEDULE_INCLUDE = {
  ...ROUND_INCLUDE,
  application: {
    select: {
      id: true,
      stage: true,
      candidateId: true,
      requisitionId: true,
      candidate: { select: { firstName: true, lastName: true, email: true } },
      requisition: { select: { title: true, referenceNumber: true } },
      resume: { select: { id: true } },
      interviewRounds: { select: { roundOrder: true, status: true } },
    },
  },
} satisfies Prisma.JobApplicationInterviewRoundInclude;

type RoundWithRelations = Prisma.JobApplicationInterviewRoundGetPayload<{
  include: typeof ROUND_INCLUDE;
}>;

type ScheduleRow = Prisma.JobApplicationInterviewRoundGetPayload<{
  include: typeof SCHEDULE_INCLUDE;
}>;

const SCHEDULE_LIST_LIMIT = 500;

@Injectable()
export class ApplicationInterviewRoundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly notificationEngine: NotificationEngineService,
    private readonly storageService: StorageService,
  ) {}

  async listByApplication(applicationId: string): Promise<InterviewRoundRecord[]> {
    const application = await this.findApplicationOrThrow(applicationId);
    await this.companyScope.assertCompanyInTenant(application.companyId);

    await this.ensureRounds(applicationId);

    const rows = await this.prisma.unscoped.jobApplicationInterviewRound.findMany({
      where: { applicationId },
      include: ROUND_INCLUDE,
      orderBy: [{ roundOrder: 'asc' }],
    });

    return rows.map((row) => this.toRecord(row));
  }

  /** Company-wide interview schedule (calendar + list). */
  async listForCompany(
    companyId: string,
    query: ListInterviewScheduleQueryDto,
  ): Promise<InterviewScheduleItem[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    if (query.needsScheduling === 'true') {
      const rows = await this.prisma.unscoped.jobApplicationInterviewRound.findMany({
        where: {
          companyId,
          status: InterviewRoundStatus.pending,
          application: {
            stage: ApplicationStage.interview,
            ...(query.requisitionId ? { requisitionId: query.requisitionId } : {}),
          },
        },
        include: SCHEDULE_INCLUDE,
        orderBy: [{ updatedAt: 'asc' }],
        take: SCHEDULE_LIST_LIMIT,
      });
      return rows
        .filter((row) => isRoundNextInLine(row, row.application.interviewRounds))
        .map((row) => this.toScheduleItem(row));
    }

    const rows = await this.prisma.unscoped.jobApplicationInterviewRound.findMany({
      where: {
        companyId,
        scheduledStartAt: {
          not: null,
          ...(query.from ? { gte: new Date(query.from) } : {}),
          ...(query.to ? { lt: new Date(query.to) } : {}),
        },
        ...(query.status ? { status: query.status } : {}),
        ...(query.interviewerEmployeeId
          ? { interviewerEmployeeId: query.interviewerEmployeeId }
          : {}),
        ...(query.requisitionId
          ? { application: { requisitionId: query.requisitionId } }
          : {}),
      },
      include: SCHEDULE_INCLUDE,
      orderBy: [{ scheduledStartAt: 'asc' }],
      take: SCHEDULE_LIST_LIMIT,
    });

    return rows.map((row) => this.toScheduleItem(row));
  }

  /** Rounds where the signed-in user's employee record is the interviewer. */
  async listMine(
    user: AuthenticatedUser,
    query: ListMyInterviewsQueryDto,
  ): Promise<InterviewScheduleItem[]> {
    if (!user.employeeId || !user.tenantId) return [];

    const rows = await this.prisma.unscoped.jobApplicationInterviewRound.findMany({
      where: {
        tenantId: user.tenantId,
        interviewerEmployeeId: user.employeeId,
        status: query.status ?? {
          in: [InterviewRoundStatus.scheduled, InterviewRoundStatus.completed],
        },
        ...(query.from || query.to
          ? {
              scheduledStartAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lt: new Date(query.to) } : {}),
              },
            }
          : {}),
      },
      include: SCHEDULE_INCLUDE,
      orderBy: [{ scheduledStartAt: 'asc' }],
      take: SCHEDULE_LIST_LIMIT,
    });

    return rows.map((row) => this.toScheduleItem(row));
  }

  /** Short-lived CV link for the assigned interviewer (no recruitment permission needed). */
  async getResumeUrlForInterviewer(roundId: string, user: AuthenticatedUser) {
    const round = await this.findOrThrow(roundId);
    this.assertAssignedInterviewer(round, user);

    const resume = await this.prisma.unscoped.jobApplicationResume.findUnique({
      where: { applicationId: round.applicationId },
    });
    if (!resume) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Resume not found for this application',
      });
    }

    const url = await this.storageService.getUrl(resume.fileKey, 900);
    return { url, expiresInSeconds: 900, fileKey: resume.fileKey };
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
        include: ROUND_INCLUDE,
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
    const application = await this.assertApplicationInInterview(round.applicationId);
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
      const interviewer = await this.prisma.unscoped.employee.findFirst({
        where: {
          id: dto.interviewerEmployeeId,
          companyId: round.companyId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!interviewer) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Interviewer must be an active employee of this company',
        });
      }
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

    if (dto.interviewerEmployeeId && !dto.allowConflict) {
      await this.assertNoInterviewerConflict(
        round.id,
        round.companyId,
        dto.interviewerEmployeeId,
        scheduledStartAt,
        scheduledEndAt,
      );
    }

    const updated = await this.prisma.unscoped.jobApplicationInterviewRound.update({
      where: { id: roundId },
      data: {
        status: InterviewRoundStatus.scheduled,
        scheduledStartAt,
        scheduledEndAt,
        location: dto.location?.trim() || null,
        meetingUrl: dto.meetingUrl?.trim() || null,
        interviewerEmployeeId: dto.interviewerEmployeeId ?? null,
      },
      include: ROUND_INCLUDE,
    });

    await this.auditService.log({
      tenantId: updated.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: updated.applicationId,
      oldValue:
        round.status === InterviewRoundStatus.scheduled
          ? {
              scheduledStartAt: round.scheduledStartAt?.toISOString() ?? null,
              interviewerEmployeeId: round.interviewerEmployeeId,
            }
          : undefined,
      newValue: {
        interviewRoundScheduled: updated.roundType,
        scheduledStartAt: scheduledStartAt.toISOString(),
        interviewerEmployeeId: updated.interviewerEmployeeId,
        ...(dto.allowConflict ? { conflictOverridden: true } : {}),
      },
    });

    const bookingChanged =
      round.status !== InterviewRoundStatus.scheduled ||
      round.interviewerEmployeeId !== updated.interviewerEmployeeId ||
      round.scheduledStartAt?.getTime() !== scheduledStartAt.getTime() ||
      round.location !== updated.location ||
      round.meetingUrl !== updated.meetingUrl;

    if (updated.interviewerEmployeeId && bookingChanged) {
      await this.notifyInterviewer(updated, application);
    }

    return this.toRecord(updated);
  }

  async cancel(
    roundId: string,
    dto: CancelInterviewRoundDto,
    user: AuthenticatedUser,
  ): Promise<InterviewRoundRecord> {
    const round = await this.findOrThrow(roundId);
    await this.companyScope.assertCompanyInTenant(round.companyId);

    if (round.status !== InterviewRoundStatus.scheduled) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only scheduled interviews can be cancelled',
      });
    }

    const updated = await this.prisma.unscoped.jobApplicationInterviewRound.update({
      where: { id: roundId },
      data: this.releaseBookingData(),
      include: ROUND_INCLUDE,
    });

    await this.auditService.log({
      tenantId: updated.tenantId,
      userId: user.id,
      action: 'update',
      module: 'recruitment',
      recordId: updated.applicationId,
      oldValue: {
        scheduledStartAt: round.scheduledStartAt?.toISOString() ?? null,
        interviewerEmployeeId: round.interviewerEmployeeId,
      },
      newValue: {
        interviewRoundCancelled: updated.roundType,
        reason: dto.reason?.trim() || null,
      },
    });

    return this.toRecord(updated);
  }

  /** Frees interview bookings when an application leaves the pipeline (rejected / withdrawn). */
  async releaseScheduledRounds(applicationId: string): Promise<number> {
    const result = await this.prisma.unscoped.jobApplicationInterviewRound.updateMany({
      where: { applicationId, status: InterviewRoundStatus.scheduled },
      data: this.releaseBookingData(),
    });
    return result.count;
  }

  async complete(
    roundId: string,
    dto: CompleteInterviewRoundDto,
    user: AuthenticatedUser,
    options: { asInterviewer?: boolean } = {},
  ): Promise<InterviewRoundRecord> {
    const round = await this.findOrThrow(roundId);
    if (options.asInterviewer) {
      this.assertAssignedInterviewer(round, user);
    }
    await this.companyScope.assertCompanyInTenant(round.companyId);
    await this.assertApplicationInInterview(round.applicationId);
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
    if (options.asInterviewer && round.status !== InterviewRoundStatus.scheduled) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Only scheduled interviews can be scored by the interviewer',
      });
    }

    let scorecard: InterviewScorecard | null = null;
    let score: number;
    if (dto.ratings && dto.ratings.length > 0) {
      const built = buildInterviewScorecard(round.roundType, dto);
      scorecard = built.scorecard;
      score = built.score;
    } else if (dto.score != null) {
      score = dto.score;
    } else {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Provide scorecard ratings or an overall score',
      });
    }

    const updated = await this.prisma.unscoped.jobApplicationInterviewRound.update({
      where: { id: roundId },
      data: {
        status: InterviewRoundStatus.completed,
        score,
        recommendation: dto.recommendation,
        feedback: dto.feedback?.trim() || null,
        scorecard: scorecard
          ? (scorecard as unknown as Prisma.InputJsonValue)
          : Prisma.DbNull,
        completedAt: new Date(),
        completedByUserId: user.id,
      },
      include: ROUND_INCLUDE,
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
        score,
        recommendation: dto.recommendation,
        scorecardCriteria: scorecard?.ratings.length ?? 0,
        ...(options.asInterviewer ? { submittedBy: 'interviewer' } : {}),
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
    await this.assertApplicationInInterview(round.applicationId);
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
        feedback: dto.feedback?.trim() || null,
        completedAt: new Date(),
        completedByUserId: user.id,
      },
      include: ROUND_INCLUDE,
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

  private releaseBookingData() {
    return {
      status: InterviewRoundStatus.pending,
      scheduledStartAt: null,
      scheduledEndAt: null,
      location: null,
      meetingUrl: null,
      interviewerEmployeeId: null,
    } satisfies Prisma.JobApplicationInterviewRoundUncheckedUpdateManyInput;
  }

  private async assertNoInterviewerConflict(
    roundId: string,
    companyId: string,
    interviewerEmployeeId: string,
    start: Date,
    end: Date | null,
  ) {
    const dayMs = 24 * 60 * 60 * 1000;
    const windowEnd = end ?? start;
    const candidates = await this.prisma.unscoped.jobApplicationInterviewRound.findMany({
      where: {
        id: { not: roundId },
        interviewerEmployeeId,
        status: InterviewRoundStatus.scheduled,
        scheduledStartAt: {
          gte: new Date(start.getTime() - dayMs),
          lt: new Date(windowEnd.getTime() + dayMs),
        },
      },
      select: {
        id: true,
        scheduledStartAt: true,
        scheduledEndAt: true,
        roundType: true,
        application: {
          select: { candidate: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    const clash = findInterviewerConflict({ start, end }, candidates);
    if (!clash?.scheduledStartAt) return;

    const company = await this.prisma.unscoped.company.findUnique({
      where: { id: companyId },
      select: { timezone: true },
    });
    const candidate = clash.application.candidate;
    throw new ConflictException({
      code: 'INTERVIEWER_CONFLICT',
      message: `Interviewer already has the ${resolveInterviewRoundLabel(
        clash.roundType,
      )} interview with ${formatCandidateName(
        candidate.firstName,
        candidate.lastName,
      )} on ${formatInterviewSlot(clash.scheduledStartAt, company?.timezone)}`,
      conflictingRoundId: clash.id,
    });
  }

  private async notifyInterviewer(
    round: RoundWithRelations,
    application: { companyId: string; tenantId: string },
  ) {
    if (!round.interviewerEmployeeId || !round.scheduledStartAt) return;

    const context = await this.prisma.unscoped.jobApplication.findUnique({
      where: { id: round.applicationId },
      select: {
        candidate: { select: { firstName: true, lastName: true } },
        requisition: { select: { title: true } },
        company: { select: { timezone: true } },
      },
    });
    if (!context) return;

    await this.notificationEngine.emit({
      tenantId: application.tenantId,
      companyId: application.companyId,
      eventType: 'interview.scheduled',
      subjectEmployeeId: round.interviewerEmployeeId,
      variables: buildInterviewScheduledVariables({
        candidateName: formatCandidateName(
          context.candidate.firstName,
          context.candidate.lastName,
        ),
        requisitionTitle: context.requisition.title,
        roundName: resolveInterviewRoundLabel(round.roundType),
        scheduledAt: formatInterviewSlot(round.scheduledStartAt, context.company.timezone),
        location: round.location,
        meetingUrl: round.meetingUrl,
      }),
      payload: {
        interviewRoundId: round.id,
        applicationId: round.applicationId,
        roundType: round.roundType,
        scheduledStartAt: round.scheduledStartAt.toISOString(),
      },
    });
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

  private async assertApplicationInInterview(applicationId: string) {
    const application = await this.findApplicationOrThrow(applicationId);
    if (application.stage !== ApplicationStage.interview) {
      throw new BadRequestException({
        code: 'INVALID_STAGE_TRANSITION',
        message: 'Interview rounds can only be changed while the application is at the Interview stage',
      });
    }
    return application;
  }

  private assertAssignedInterviewer(
    round: JobApplicationInterviewRound,
    user: AuthenticatedUser,
  ) {
    if (
      !user.employeeId ||
      round.tenantId !== user.tenantId ||
      round.interviewerEmployeeId !== user.employeeId
    ) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You are not the assigned interviewer for this round',
      });
    }
  }

  async findOrThrow(roundId: string): Promise<RoundWithRelations> {
    const row = await this.prisma.unscoped.jobApplicationInterviewRound.findUnique({
      where: { id: roundId },
      include: ROUND_INCLUDE,
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

  private toScheduleItem(row: ScheduleRow): InterviewScheduleItem {
    const { application } = row;
    return {
      ...this.toRecord(row),
      candidateId: application.candidateId,
      candidateName: formatCandidateName(
        application.candidate.firstName,
        application.candidate.lastName,
      ),
      candidateEmail: application.candidate.email,
      requisitionId: application.requisitionId,
      requisitionTitle: application.requisition.title,
      requisitionReference: application.requisition.referenceNumber,
      applicationStage: application.stage,
      hasResume: application.resume != null,
    };
  }

  private toRecord(row: RoundWithRelations): InterviewRoundRecord {
    const completedByEmployee = row.completedBy?.employee;
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
      scorecard: parseInterviewScorecard(row.scorecard),
      completedAt: row.completedAt?.toISOString() ?? null,
      completedByUserId: row.completedByUserId,
      completedByName: completedByEmployee
        ? `${completedByEmployee.firstName} ${completedByEmployee.lastName}`.trim()
        : row.completedBy?.email,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
