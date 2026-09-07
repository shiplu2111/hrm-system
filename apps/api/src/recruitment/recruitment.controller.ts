import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { DOCUMENT_FILE_POLICY } from '../storage/document-file.policy';
import { CandidatesService } from './candidates.service';
import {
  CreateCandidateDto,
  CreateJobApplicationDto,
  CreateJobPostingDto,
  CreateJobRequisitionDto,
  ListCandidatesQueryDto,
  ListJobApplicationsQueryDto,
  ListJobPostingsQueryDto,
  ListJobRequisitionsQueryDto,
  UpdateApplicationStageDto,
  UpdateJobPostingDto,
  UpdateJobRequisitionDto,
  RequisitionActionDto,
  HireApplicationDto,
  ScheduleInterviewRoundDto,
  CompleteInterviewRoundDto,
  SkipInterviewRoundDto,
  UpsertOfferLetterDto,
  OfferLetterActionDto,
} from './dto/recruitment.dto';
import { ApplicationInterviewRoundsService } from './application-interview-rounds.service';
import { OfferLettersService } from './offer-letters.service';
import { JobApplicationsService } from './job-applications.service';
import { JobPostingsService } from './job-postings.service';
import { JobRequisitionsService } from './job-requisitions.service';

@ApiTags('recruitment')
@ApiBearerAuth('access-token')
@Controller()
export class RecruitmentController {
  constructor(
    private readonly requisitionsService: JobRequisitionsService,
    private readonly postingsService: JobPostingsService,
    private readonly candidatesService: CandidatesService,
    private readonly applicationsService: JobApplicationsService,
    private readonly interviewRoundsService: ApplicationInterviewRoundsService,
    private readonly offerLettersService: OfferLettersService,
  ) {}

  @Get('companies/:companyId/job-requisitions')
  @RequirePermission('recruitment', 'view')
  async listRequisitions(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListJobRequisitionsQueryDto,
  ) {
    return { data: await this.requisitionsService.list(companyId, query) };
  }

  @Get('job-requisitions/:requisitionId')
  @RequirePermission('recruitment', 'view')
  async getRequisition(
    @Param('requisitionId', ParseUUIDPipe) requisitionId: string,
  ) {
    return { data: await this.requisitionsService.get(requisitionId) };
  }

  @Post('companies/:companyId/job-requisitions')
  @RequirePermission('recruitment', 'create')
  async createRequisition(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateJobRequisitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.requisitionsService.create(companyId, dto, user) };
  }

  @Patch('job-requisitions/:requisitionId')
  @RequirePermission('recruitment', 'edit')
  async updateRequisition(
    @Param('requisitionId', ParseUUIDPipe) requisitionId: string,
    @Body() dto: UpdateJobRequisitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.requisitionsService.update(requisitionId, dto, user) };
  }

  @Post('job-requisitions/:requisitionId/submit')
  @RequirePermission('recruitment', 'edit')
  async submitRequisition(
    @Param('requisitionId', ParseUUIDPipe) requisitionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.requisitionsService.submit(requisitionId, user) };
  }

  @Post('job-requisitions/:requisitionId/approve')
  @RequirePermission('recruitment', 'approve')
  async approveRequisition(
    @Param('requisitionId', ParseUUIDPipe) requisitionId: string,
    @Body() dto: RequisitionActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.requisitionsService.approve(requisitionId, user, dto),
    };
  }

  @Post('job-requisitions/:requisitionId/reject')
  @RequirePermission('recruitment', 'approve')
  async rejectRequisition(
    @Param('requisitionId', ParseUUIDPipe) requisitionId: string,
    @Body() dto: RequisitionActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.requisitionsService.reject(requisitionId, user, dto),
    };
  }

  @Post('job-requisitions/:requisitionId/open')
  @RequirePermission('recruitment', 'edit')
  async openRequisition(
    @Param('requisitionId', ParseUUIDPipe) requisitionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.requisitionsService.open(requisitionId, user) };
  }

  @Post('job-requisitions/:requisitionId/close')
  @RequirePermission('recruitment', 'edit')
  async closeRequisition(
    @Param('requisitionId', ParseUUIDPipe) requisitionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.requisitionsService.close(requisitionId, user) };
  }

  @Get('companies/:companyId/job-postings')
  @RequirePermission('recruitment', 'view')
  async listPostings(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListJobPostingsQueryDto,
  ) {
    return { data: await this.postingsService.list(companyId, query) };
  }

  @Get('job-postings/:postingId')
  @RequirePermission('recruitment', 'view')
  async getPosting(@Param('postingId', ParseUUIDPipe) postingId: string) {
    return { data: await this.postingsService.get(postingId) };
  }

  @Post('companies/:companyId/job-postings')
  @RequirePermission('recruitment', 'create')
  async createPosting(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateJobPostingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.postingsService.create(companyId, dto, user) };
  }

  @Patch('job-postings/:postingId')
  @RequirePermission('recruitment', 'edit')
  async updatePosting(
    @Param('postingId', ParseUUIDPipe) postingId: string,
    @Body() dto: UpdateJobPostingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.postingsService.update(postingId, dto, user) };
  }

  @Post('job-postings/:postingId/publish')
  @RequirePermission('recruitment', 'edit')
  async publishPosting(
    @Param('postingId', ParseUUIDPipe) postingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.postingsService.publish(postingId, user) };
  }

  @Post('job-postings/:postingId/close')
  @RequirePermission('recruitment', 'edit')
  async closePosting(
    @Param('postingId', ParseUUIDPipe) postingId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.postingsService.close(postingId, user) };
  }

  @Get('companies/:companyId/candidates')
  @RequirePermission('recruitment', 'view')
  async listCandidates(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListCandidatesQueryDto,
  ) {
    return { data: await this.candidatesService.list(companyId, query) };
  }

  @Get('candidates/:candidateId')
  @RequirePermission('recruitment', 'view')
  async getCandidate(@Param('candidateId', ParseUUIDPipe) candidateId: string) {
    return { data: await this.candidatesService.get(candidateId) };
  }

  @Post('companies/:companyId/candidates')
  @RequirePermission('recruitment', 'create')
  async createCandidate(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCandidateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.candidatesService.create(companyId, dto, user) };
  }

  @Get('companies/:companyId/job-applications')
  @RequirePermission('recruitment', 'view')
  async listApplications(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListJobApplicationsQueryDto,
  ) {
    return { data: await this.applicationsService.list(companyId, query) };
  }

  @Get('job-applications/:applicationId')
  @RequirePermission('recruitment', 'view')
  async getApplication(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return { data: await this.applicationsService.get(applicationId) };
  }

  @Post('companies/:companyId/job-applications')
  @RequirePermission('recruitment', 'create')
  async createApplication(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateJobApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.applicationsService.create(companyId, dto, user) };
  }

  @Patch('job-applications/:applicationId/stage')
  @RequirePermission('recruitment', 'edit')
  async updateApplicationStage(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: UpdateApplicationStageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.applicationsService.updateStage(applicationId, dto, user),
    };
  }

  @Post('job-applications/:applicationId/resume')
  @RequirePermission('recruitment', 'create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: DOCUMENT_FILE_POLICY.maxBytes },
    }),
  )
  async uploadResume(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Resume file is required',
      });
    }
    return {
      data: await this.applicationsService.uploadResume(applicationId, file, user),
    };
  }

  @Get('job-applications/:applicationId/resume/file-url')
  @RequirePermission('recruitment', 'view')
  async getResumeFileUrl(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return { data: await this.applicationsService.getResumeFileUrl(applicationId) };
  }

  @Post('job-applications/:applicationId/hire')
  @RequirePermission('recruitment', 'approve')
  async hireApplication(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: HireApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.applicationsService.hire(applicationId, dto, user) };
  }

  @Get('job-applications/:applicationId/interview-rounds')
  @RequirePermission('recruitment', 'view')
  async listInterviewRounds(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return {
      data: await this.interviewRoundsService.listByApplication(applicationId),
    };
  }

  @Post('job-applications/:applicationId/interview-rounds/init')
  @RequirePermission('recruitment', 'edit')
  async initInterviewRounds(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
  ) {
    return {
      data: await this.interviewRoundsService.ensureRounds(applicationId),
    };
  }

  @Patch('interview-rounds/:roundId/schedule')
  @RequirePermission('recruitment', 'edit')
  async scheduleInterviewRound(
    @Param('roundId', ParseUUIDPipe) roundId: string,
    @Body() dto: ScheduleInterviewRoundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.interviewRoundsService.schedule(roundId, dto, user),
    };
  }

  @Post('interview-rounds/:roundId/complete')
  @RequirePermission('recruitment', 'edit')
  async completeInterviewRound(
    @Param('roundId', ParseUUIDPipe) roundId: string,
    @Body() dto: CompleteInterviewRoundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.interviewRoundsService.complete(roundId, dto, user),
    };
  }

  @Post('interview-rounds/:roundId/skip')
  @RequirePermission('recruitment', 'approve')
  async skipInterviewRound(
    @Param('roundId', ParseUUIDPipe) roundId: string,
    @Body() dto: SkipInterviewRoundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.interviewRoundsService.skip(roundId, dto, user),
    };
  }

  @Get('job-applications/:applicationId/offer-letter')
  @RequirePermission('recruitment', 'view')
  async getOfferLetter(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offerLettersService.getOrCreateForApplication(
        applicationId,
        user,
      ),
    };
  }

  @Put('job-applications/:applicationId/offer-letter')
  @RequirePermission('recruitment', 'edit')
  async updateOfferLetter(
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: UpsertOfferLetterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const offer = await this.offerLettersService.getOrCreateForApplication(
      applicationId,
      user,
    );
    return {
      data: await this.offerLettersService.update(offer.id, dto, user),
    };
  }

  @Post('offer-letters/:offerLetterId/generate')
  @RequirePermission('recruitment', 'edit')
  async generateOfferLetterPdf(
    @Param('offerLetterId', ParseUUIDPipe) offerLetterId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offerLettersService.generatePdf(offerLetterId, user),
    };
  }

  @Post('offer-letters/:offerLetterId/submit')
  @RequirePermission('recruitment', 'edit')
  async submitOfferLetter(
    @Param('offerLetterId', ParseUUIDPipe) offerLetterId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offerLettersService.submit(offerLetterId, user),
    };
  }

  @Post('offer-letters/:offerLetterId/approve')
  @RequirePermission('recruitment', 'approve')
  async approveOfferLetter(
    @Param('offerLetterId', ParseUUIDPipe) offerLetterId: string,
    @Body() dto: OfferLetterActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offerLettersService.approve(offerLetterId, user, dto),
    };
  }

  @Post('offer-letters/:offerLetterId/reject')
  @RequirePermission('recruitment', 'approve')
  async rejectOfferLetter(
    @Param('offerLetterId', ParseUUIDPipe) offerLetterId: string,
    @Body() dto: OfferLetterActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offerLettersService.reject(offerLetterId, user, dto),
    };
  }

  @Post('offer-letters/:offerLetterId/send')
  @RequirePermission('recruitment', 'edit')
  async sendOfferLetter(
    @Param('offerLetterId', ParseUUIDPipe) offerLetterId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offerLettersService.send(offerLetterId, user),
    };
  }

  @Post('offer-letters/:offerLetterId/accept')
  @RequirePermission('recruitment', 'approve')
  async acceptOfferLetter(
    @Param('offerLetterId', ParseUUIDPipe) offerLetterId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.offerLettersService.accept(offerLetterId, user),
    };
  }

  @Get('offer-letters/:offerLetterId/download')
  @RequirePermission('recruitment', 'view')
  async downloadOfferLetter(
    @Param('offerLetterId', ParseUUIDPipe) offerLetterId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename, contentType } =
      await this.offerLettersService.downloadFile(offerLetterId, user);
    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename.replace(/"/g, '')}"`,
    );
    res.send(buffer);
  }
}
