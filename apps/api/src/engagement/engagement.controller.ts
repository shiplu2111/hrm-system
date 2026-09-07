import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AnnouncementsService } from './announcements.service';
import { EngagementSurveysService } from './engagement-surveys.service';
import { KudosService } from './kudos.service';
import type {
  CreateAnnouncementDto,
  CreateKudosDto,
  CreateEmployeeKudosDto,
  CreateSurveyDto,
  ListAnnouncementsQueryDto,
  ListKudosQueryDto,
  ListSurveysQueryDto,
  SubmitSurveyResponseDto,
  UpdateAnnouncementDto,
  UpdateSurveyDto,
} from './dto/engagement.dto';

@ApiTags('engagement')
@ApiBearerAuth('access-token')
@Controller()
export class EngagementController {
  constructor(
    private readonly announcementsService: AnnouncementsService,
    private readonly surveysService: EngagementSurveysService,
    private readonly kudosService: KudosService,
  ) {}

  @Get('companies/:companyId/engagement/summary')
  @RequirePermission('engagement', 'view')
  @ApiOperation({ summary: 'Employee engagement dashboard summary' })
  async summary(@Param('companyId', ParseUUIDPipe) companyId: string) {
    const [base, kudosThisMonthCount] = await Promise.all([
      this.surveysService.getSummary(companyId),
      this.kudosService.countThisMonth(companyId),
    ]);
    return { data: { ...base, kudosThisMonthCount } };
  }

  // --- Announcements (admin) ---

  @Get('companies/:companyId/engagement/announcements')
  @RequirePermission('engagement', 'view')
  async listAnnouncements(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListAnnouncementsQueryDto,
  ) {
    return { data: await this.announcementsService.listForAdmin(companyId, query) };
  }

  @Post('companies/:companyId/engagement/announcements')
  @RequirePermission('engagement', 'create')
  async createAnnouncement(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.announcementsService.create(companyId, dto, user),
    };
  }

  @Patch('engagement/announcements/:announcementId')
  @RequirePermission('engagement', 'edit')
  async updateAnnouncement(
    @Param('announcementId', ParseUUIDPipe) announcementId: string,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.announcementsService.update(announcementId, dto, user),
    };
  }

  @Post('engagement/announcements/:announcementId/publish')
  @RequirePermission('engagement', 'edit')
  async publishAnnouncement(
    @Param('announcementId', ParseUUIDPipe) announcementId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.announcementsService.publish(announcementId, user),
    };
  }

  // --- Surveys (admin) ---

  @Get('companies/:companyId/engagement/surveys')
  @RequirePermission('engagement', 'view')
  async listSurveys(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListSurveysQueryDto,
  ) {
    return { data: await this.surveysService.listSurveys(companyId, query) };
  }

  @Post('companies/:companyId/engagement/surveys')
  @RequirePermission('engagement', 'create')
  async createSurvey(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateSurveyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.surveysService.createSurvey(companyId, dto, user) };
  }

  @Get('engagement/surveys/:surveyId')
  @RequirePermission('engagement', 'view')
  async getSurvey(@Param('surveyId', ParseUUIDPipe) surveyId: string) {
    return { data: await this.surveysService.getSurvey(surveyId) };
  }

  @Patch('engagement/surveys/:surveyId')
  @RequirePermission('engagement', 'edit')
  async updateSurvey(
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
    @Body() dto: UpdateSurveyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.surveysService.updateSurvey(surveyId, dto, user) };
  }

  @Post('engagement/surveys/:surveyId/publish')
  @RequirePermission('engagement', 'edit')
  async publishSurvey(
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.surveysService.publishSurvey(surveyId, user) };
  }

  @Post('engagement/surveys/:surveyId/close')
  @RequirePermission('engagement', 'edit')
  async closeSurvey(
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.surveysService.closeSurvey(surveyId, user) };
  }

  @Get('engagement/surveys/:surveyId/results')
  @RequirePermission('engagement', 'view')
  async getSurveyResults(@Param('surveyId', ParseUUIDPipe) surveyId: string) {
    return { data: await this.surveysService.getResults(surveyId) };
  }

  @Get('companies/:companyId/engagement/enps-trends')
  @RequirePermission('engagement', 'view')
  async getEnpsTrends(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.surveysService.getEnpsTrends(companyId) };
  }

  // --- Kudos / recognition ---

  @Get('companies/:companyId/engagement/kudos')
  @RequirePermission('engagement', 'view')
  @ApiOperation({ summary: 'Company recognition feed' })
  async listKudos(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListKudosQueryDto,
  ) {
    return { data: await this.kudosService.listFeed(companyId, query) };
  }

  @Post('companies/:companyId/engagement/kudos')
  @RequirePermission('engagement', 'create')
  async createKudos(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateKudosDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.kudosService.create(companyId, dto, user, {
        allowDelegate: true,
      }),
    };
  }

  // --- Employee-facing ---

  @Get('employees/:employeeId/engagement/surveys/:surveyId')
  @RequirePermission('engagement', 'view')
  async getSurveyForEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
  ) {
    return {
      data: await this.surveysService.getSurveyForEmployee(surveyId, employeeId),
    };
  }

  @Post('employees/:employeeId/engagement/surveys/:surveyId/responses')
  @RequirePermission('engagement', 'create')
  async submitSurveyResponse(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('surveyId', ParseUUIDPipe) surveyId: string,
    @Body() dto: SubmitSurveyResponseDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.surveysService.submitResponse(
        surveyId,
        employeeId,
        dto,
        user,
      ),
    };
  }

  @Post('employees/:employeeId/engagement/kudos')
  @RequirePermission('engagement', 'create')
  @ApiOperation({ summary: 'Send peer or manager recognition' })
  async createKudosAsEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateEmployeeKudosDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.kudosService.createForEmployee(employeeId, dto, user),
    };
  }
}
