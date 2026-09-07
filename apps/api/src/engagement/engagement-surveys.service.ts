import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  EngagementSurvey,
  EngagementSurveyQuestion,
  Prisma,
} from '@prisma/client';
import type {
  EngagementQuestionResult,
  EngagementQuestionType,
  EngagementSummary,
  EngagementSurveyListItem,
  EngagementSurveyQuestionRecord,
  EngagementSurveyRecord,
  EngagementSurveyResults,
  EngagementSurveyStatus,
  EngagementSurveyType,
  EnpsTrendPoint,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateSurveyDto,
  ListSurveysQueryDto,
  SubmitSurveyResponseDto,
  SurveyQuestionDto,
  UpdateSurveyDto,
} from './dto/engagement.dto';
import { computeEnps, responseFingerprint } from './engagement.utils';

type SurveyWithRelations = EngagementSurvey & {
  questions: EngagementSurveyQuestion[];
  _count: { responses: number };
};

@Injectable()
export class EngagementSurveysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async getSummary(companyId: string): Promise<EngagementSummary> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const [publishedAnnouncementCount, activeSurveyCount, totalSurveyResponses, latestEnps] =
      await Promise.all([
        this.prisma.unscoped.companyAnnouncement.count({
          where: { companyId, status: 'published' },
        }),
        this.prisma.unscoped.engagementSurvey.count({
          where: { companyId, status: 'published' },
        }),
        this.prisma.unscoped.engagementSurveyResponse.count({
          where: { survey: { companyId } },
        }),
        this.prisma.unscoped.engagementSurvey.findFirst({
          where: { companyId, surveyType: 'enps', status: { in: ['published', 'closed'] } },
          orderBy: { publishedAt: 'desc' },
          include: {
            questions: { where: { questionType: 'enps' } },
            responses: {
              include: {
                answers: {
                  where: { question: { questionType: 'enps' } },
                },
              },
            },
          },
        }),
      ]);

    let latestEnpsScore: number | null = null;
    if (latestEnps?.questions[0]) {
      const questionId = latestEnps.questions[0].id;
      const scores = latestEnps.responses
        .map((r) => r.answers.find((a) => a.questionId === questionId)?.numericValue)
        .filter((v): v is number => v != null);
      latestEnpsScore = computeEnps(scores).score;
    }

    return {
      publishedAnnouncementCount,
      activeSurveyCount,
      totalSurveyResponses,
      latestEnpsScore,
      kudosThisMonthCount: 0,
    };
  }

  async listSurveys(
    companyId: string,
    query: ListSurveysQueryDto,
  ): Promise<EngagementSurveyRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.engagementSurvey.findMany({
      where: {
        companyId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.surveyType ? { surveyType: query.surveyType } : {}),
      },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { responses: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => this.toRecord(row as SurveyWithRelations));
  }

  async getSurvey(surveyId: string): Promise<EngagementSurveyRecord> {
    const row = await this.getSurveyWithRelationsOrThrow(surveyId);
    return this.toRecord(row);
  }

  async createSurvey(
    companyId: string,
    dto: CreateSurveyDto,
    user: AuthenticatedUser,
  ): Promise<EngagementSurveyRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    this.validateQuestions(dto.questions, dto.surveyType ?? 'pulse');

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      const survey = await tx.engagementSurvey.create({
        data: {
          tenantId: company.tenantId,
          companyId,
          title: dto.title.trim(),
          description: dto.description?.trim() || null,
          surveyType: dto.surveyType ?? 'pulse',
          isAnonymous: dto.isAnonymous ?? true,
          createdByUserId: user.id,
        },
      });

      await this.createQuestions(tx, survey.id, dto.questions);

      return tx.engagementSurvey.findUniqueOrThrow({
        where: { id: survey.id },
        include: {
          questions: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { responses: true } },
        },
      });
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'engagement',
      recordId: row.id,
      newValue: { title: row.title, surveyType: row.surveyType, questionCount: dto.questions.length },
    });

    return this.toRecord(row as SurveyWithRelations);
  }

  async updateSurvey(
    surveyId: string,
    dto: UpdateSurveyDto,
    user: AuthenticatedUser,
  ): Promise<EngagementSurveyRecord> {
    const existing = await this.getSurveyWithRelationsOrThrow(surveyId);
    if (existing.status !== 'draft') {
      throw new BadRequestException('Only draft surveys can be edited');
    }

    if (dto.questions) {
      this.validateQuestions(dto.questions, existing.surveyType);
    }

    const row = await this.prisma.unscoped.$transaction(async (tx) => {
      await tx.engagementSurvey.update({
        where: { id: surveyId },
        data: {
          ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description?.trim() || null }
            : {}),
          ...(dto.isAnonymous !== undefined ? { isAnonymous: dto.isAnonymous } : {}),
        },
      });

      if (dto.questions) {
        await tx.engagementSurveyQuestion.deleteMany({ where: { surveyId } });
        await this.createQuestions(tx, surveyId, dto.questions);
      }

      return tx.engagementSurvey.findUniqueOrThrow({
        where: { id: surveyId },
        include: {
          questions: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { responses: true } },
        },
      });
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'engagement',
      recordId: surveyId,
      oldValue: { title: existing.title },
      newValue: { ...dto, questions: dto.questions?.length },
    });

    return this.toRecord(row as SurveyWithRelations);
  }

  async publishSurvey(
    surveyId: string,
    user: AuthenticatedUser,
  ): Promise<EngagementSurveyRecord> {
    const existing = await this.getSurveyWithRelationsOrThrow(surveyId);
    if (existing.status !== 'draft') {
      throw new BadRequestException('Survey is already published or closed');
    }
    if (existing.questions.length === 0) {
      throw new BadRequestException('Survey must have at least one question');
    }
    if (
      existing.surveyType === 'enps' &&
      !existing.questions.some((q) => q.questionType === 'enps')
    ) {
      throw new BadRequestException('eNPS surveys require an eNPS question');
    }

    const row = await this.prisma.unscoped.engagementSurvey.update({
      where: { id: surveyId },
      data: { status: 'published', publishedAt: new Date() },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { responses: true } },
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'engagement',
      recordId: surveyId,
      oldValue: { status: existing.status },
      newValue: { status: 'published' },
    });

    return this.toRecord(row as SurveyWithRelations);
  }

  async closeSurvey(
    surveyId: string,
    user: AuthenticatedUser,
  ): Promise<EngagementSurveyRecord> {
    const existing = await this.getSurveyWithRelationsOrThrow(surveyId);
    if (existing.status !== 'published') {
      throw new BadRequestException('Only published surveys can be closed');
    }

    const row = await this.prisma.unscoped.engagementSurvey.update({
      where: { id: surveyId },
      data: { status: 'closed', closedAt: new Date() },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { responses: true } },
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'engagement',
      recordId: surveyId,
      oldValue: { status: existing.status },
      newValue: { status: 'closed' },
    });

    return this.toRecord(row as SurveyWithRelations);
  }

  async listActiveForEmployee(
    companyId: string,
    employeeId: string,
  ): Promise<EngagementSurveyListItem[]> {
    const surveys = await this.prisma.unscoped.engagementSurvey.findMany({
      where: { companyId, status: 'published' },
      include: {
        questions: { select: { id: true } },
      },
      orderBy: { publishedAt: 'desc' },
    });

    if (surveys.length === 0) return [];

    const fingerprints = surveys.map((survey) =>
      responseFingerprint(employeeId, survey.id),
    );

    const existingResponses = await this.prisma.unscoped.engagementSurveyResponse.findMany({
      where: {
        surveyId: { in: surveys.map((s) => s.id) },
        OR: [
          { employeeId },
          { responseFingerprint: { in: fingerprints } },
        ],
      },
      select: { surveyId: true },
    });

    const submittedIds = new Set(existingResponses.map((r) => r.surveyId));

    return surveys.map((survey) => ({
      id: survey.id,
      title: survey.title,
      description: survey.description,
      surveyType: survey.surveyType as EngagementSurveyType,
      isAnonymous: survey.isAnonymous,
      questionCount: survey.questions.length,
      alreadySubmitted: submittedIds.has(survey.id),
      publishedAt: survey.publishedAt?.toISOString() ?? null,
    }));
  }

  async getSurveyForEmployee(
    surveyId: string,
    employeeId: string,
  ): Promise<EngagementSurveyRecord> {
    const survey = await this.getSurveyWithRelationsOrThrow(surveyId);
    if (survey.status !== 'published') {
      throw new NotFoundException('Survey is not available');
    }

    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: employeeId, companyId: survey.companyId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    return this.toRecord(survey);
  }

  async submitResponse(
    surveyId: string,
    employeeId: string,
    dto: SubmitSurveyResponseDto,
    user: AuthenticatedUser,
  ): Promise<{ submitted: true }> {
    if (user.employeeId && user.employeeId !== employeeId) {
      throw new ForbiddenException('Cannot submit a survey for another employee');
    }

    const survey = await this.getSurveyWithRelationsOrThrow(surveyId);
    if (survey.status !== 'published') {
      throw new BadRequestException('Survey is not accepting responses');
    }

    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: employeeId, companyId: survey.companyId, deletedAt: null },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    const fingerprint = survey.isAnonymous
      ? responseFingerprint(employeeId, surveyId)
      : null;

    const existing = await this.prisma.unscoped.engagementSurveyResponse.findFirst({
      where: {
        surveyId,
        OR: [
          ...(fingerprint ? [{ responseFingerprint: fingerprint }] : []),
          ...(!survey.isAnonymous ? [{ employeeId }] : []),
        ],
      },
    });
    if (existing) {
      throw new ConflictException('You have already submitted this survey');
    }

    this.validateAnswers(survey.questions, dto.answers);

    await this.prisma.unscoped.$transaction(async (tx) => {
      const response = await tx.engagementSurveyResponse.create({
        data: {
          tenantId: survey.tenantId,
          surveyId,
          responseFingerprint: fingerprint,
          employeeId: survey.isAnonymous ? null : employeeId,
        },
      });

      await tx.engagementSurveyAnswer.createMany({
        data: dto.answers.map((answer) => ({
          responseId: response.id,
          questionId: answer.questionId,
          textValue: answer.textValue?.trim() || null,
          numericValue: answer.numericValue ?? null,
          selectedOption: answer.selectedOption?.trim() || null,
        })),
      });
    });

    await this.auditService.log({
      tenantId: survey.tenantId,
      userId: user.id,
      action: 'create',
      module: 'engagement',
      recordId: surveyId,
      newValue: {
        surveyResponseSubmitted: true,
        anonymous: survey.isAnonymous,
        answerCount: dto.answers.length,
      },
    });

    return { submitted: true };
  }

  async getResults(surveyId: string): Promise<EngagementSurveyResults> {
    const survey = await this.getSurveyWithRelationsOrThrow(surveyId);
    const answers = await this.prisma.unscoped.engagementSurveyAnswer.findMany({
      where: { response: { surveyId } },
      include: { question: true },
    });

    const responseCount = await this.prisma.unscoped.engagementSurveyResponse.count({
      where: { surveyId },
    });

    const questions: EngagementQuestionResult[] = survey.questions.map((question) => {
      const questionAnswers = answers.filter((a) => a.questionId === question.id);
      const result: EngagementQuestionResult = {
        questionId: question.id,
        prompt: question.prompt,
        questionType: question.questionType as EngagementQuestionType,
        responseCount: questionAnswers.length,
      };

      if (question.questionType === 'multiple_choice') {
        const options = this.parseOptions(question.options);
        result.optionCounts = options.map((option) => ({
          option,
          count: questionAnswers.filter((a) => a.selectedOption === option).length,
        }));
      } else if (question.questionType === 'rating') {
        const values = questionAnswers
          .map((a) => a.numericValue)
          .filter((v): v is number => v != null);
        result.averageRating =
          values.length > 0
            ? Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10
            : undefined;
      } else if (question.questionType === 'enps') {
        const scores = questionAnswers
          .map((a) => a.numericValue)
          .filter((v): v is number => v != null);
        result.enps = computeEnps(scores);
      } else if (question.questionType === 'text') {
        result.textResponses = questionAnswers
          .map((a) => a.textValue)
          .filter((v): v is string => Boolean(v));
      }

      return result;
    });

    const enpsQuestion = questions.find((q) => q.questionType === 'enps');
    return {
      surveyId: survey.id,
      title: survey.title,
      surveyType: survey.surveyType as EngagementSurveyType,
      isAnonymous: survey.isAnonymous,
      responseCount,
      questions,
      enps: enpsQuestion?.enps,
    };
  }

  async getEnpsTrends(companyId: string): Promise<EnpsTrendPoint[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const surveys = await this.prisma.unscoped.engagementSurvey.findMany({
      where: {
        companyId,
        surveyType: 'enps',
        status: { in: ['published', 'closed'] },
      },
      include: {
        questions: { where: { questionType: 'enps' }, take: 1 },
        responses: {
          include: {
            answers: true,
          },
        },
      },
      orderBy: { publishedAt: 'asc' },
    });

    return surveys
      .map((survey) => {
        const enpsQuestion = survey.questions[0];
        if (!enpsQuestion) return null;

        const scores = survey.responses
          .flatMap((r) => r.answers)
          .filter((a) => a.questionId === enpsQuestion.id && a.numericValue != null)
          .map((a) => a.numericValue as number);

        return {
          surveyId: survey.id,
          title: survey.title,
          publishedAt: survey.publishedAt?.toISOString() ?? null,
          enps: computeEnps(scores),
        };
      })
      .filter((row): row is EnpsTrendPoint => row != null);
  }

  private validateQuestions(questions: SurveyQuestionDto[], surveyType: string): void {
    if (questions.length === 0) {
      throw new BadRequestException('At least one question is required');
    }
    if (surveyType === 'enps' && !questions.some((q) => q.questionType === 'enps')) {
      throw new BadRequestException('eNPS surveys require an eNPS question');
    }
    for (const question of questions) {
      if (question.questionType === 'multiple_choice') {
        if (!question.options?.length) {
          throw new BadRequestException('Multiple choice questions need options');
        }
      }
    }
  }

  private validateAnswers(
    questions: EngagementSurveyQuestion[],
    answers: SubmitSurveyResponseDto['answers'],
  ): void {
    const answerMap = new Map(answers.map((a) => [a.questionId, a]));

    for (const question of questions) {
      const answer = answerMap.get(question.id);
      if (question.isRequired && !answer) {
        throw new BadRequestException(`Question "${question.prompt}" is required`);
      }
      if (!answer) continue;

      switch (question.questionType) {
        case 'text':
          if (!answer.textValue?.trim()) {
            throw new BadRequestException(`Text answer required for "${question.prompt}"`);
          }
          break;
        case 'multiple_choice': {
          const options = this.parseOptions(question.options);
          if (!answer.selectedOption || !options.includes(answer.selectedOption)) {
            throw new BadRequestException(`Invalid option for "${question.prompt}"`);
          }
          break;
        }
        case 'rating':
          if (answer.numericValue == null || answer.numericValue < 1 || answer.numericValue > 5) {
            throw new BadRequestException(`Rating must be 1–5 for "${question.prompt}"`);
          }
          break;
        case 'enps':
          if (answer.numericValue == null || answer.numericValue < 0 || answer.numericValue > 10) {
            throw new BadRequestException(`eNPS score must be 0–10 for "${question.prompt}"`);
          }
          break;
      }
    }
  }

  private async createQuestions(
    tx: Prisma.TransactionClient,
    surveyId: string,
    questions: SurveyQuestionDto[],
  ): Promise<void> {
    for (const [index, question] of questions.entries()) {
      await tx.engagementSurveyQuestion.create({
        data: {
          surveyId,
          sortOrder: index,
          questionType: question.questionType,
          prompt: question.prompt.trim(),
          isRequired: question.isRequired ?? false,
          options:
            question.questionType === 'multiple_choice' && question.options
              ? question.options
              : undefined,
        },
      });
    }
  }

  private async getSurveyWithRelationsOrThrow(surveyId: string): Promise<SurveyWithRelations> {
    const row = await this.prisma.unscoped.engagementSurvey.findUnique({
      where: { id: surveyId },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { responses: true } },
      },
    });
    if (!row) throw new NotFoundException('Survey not found');
    return row as SurveyWithRelations;
  }

  private parseOptions(value: Prisma.JsonValue | null): string[] {
    if (!value || !Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private toRecord(row: SurveyWithRelations): EngagementSurveyRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      title: row.title,
      description: row.description,
      surveyType: row.surveyType as EngagementSurveyType,
      isAnonymous: row.isAnonymous,
      status: row.status as EngagementSurveyStatus,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      responseCount: row._count.responses,
      questions: row.questions.map((q) => this.toQuestionRecord(q)),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toQuestionRecord(row: EngagementSurveyQuestion): EngagementSurveyQuestionRecord {
    return {
      id: row.id,
      sortOrder: row.sortOrder,
      questionType: row.questionType as EngagementQuestionType,
      prompt: row.prompt,
      isRequired: row.isRequired,
      options:
        row.questionType === 'multiple_choice' ? this.parseOptions(row.options) : null,
    };
  }
}
