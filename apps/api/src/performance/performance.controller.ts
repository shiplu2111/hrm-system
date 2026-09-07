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
import {
  BulkAssignKpiDto,
  CreateEmployeeKpiAssignmentDto,
  CreateKpiDefinitionDto,
  CreatePerformanceReviewCycleDto,
  ExecutePromotionFromReviewDto,
  Invite360ReviewersDto,
  ListEmployeeKpiAssignmentsQueryDto,
  ListEmployeePerformanceReviewsQueryDto,
  ListKpiDefinitionsQueryDto,
  SaveManagerAssessmentDto,
  SaveReviewOutcomeDto,
  SaveSelfAssessmentDto,
  SetReviewCycleParticipantsDto,
  Submit360FeedbackDto,
  UpdateEmployeeKpiAssignmentDto,
  UpdateKpiDefinitionDto,
  UpdatePerformanceReviewCycleDto,
  WorkflowReviewActionDto,
} from './dto/performance.dto';
import { PerformanceService } from './performance.service';
import { PerformanceReviewsService } from './performance-reviews.service';
import { Performance360Service } from './performance-360.service';

@ApiTags('performance')
@ApiBearerAuth('access-token')
@Controller()
export class PerformanceController {
  constructor(
    private readonly performanceService: PerformanceService,
    private readonly performanceReviewsService: PerformanceReviewsService,
    private readonly performance360Service: Performance360Service,
  ) {}

  @Get('companies/:companyId/performance/summary')
  @RequirePermission('performance', 'view')
  @ApiOperation({ summary: 'KPI & goals dashboard summary' })
  async summary(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.performanceService.getGoalsSummary(companyId) };
  }

  @Get('companies/:companyId/performance/review-cycles')
  @RequirePermission('performance', 'view')
  async listReviewCycles(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return {
      data: await this.performanceService.listReviewCycles(companyId),
    };
  }

  @Post('companies/:companyId/performance/review-cycles')
  @RequirePermission('performance', 'create')
  async createReviewCycle(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreatePerformanceReviewCycleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceService.createReviewCycle(companyId, dto, user),
    };
  }

  @Patch('performance/review-cycles/:cycleId')
  @RequirePermission('performance', 'edit')
  async updateReviewCycle(
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: UpdatePerformanceReviewCycleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceService.updateReviewCycle(cycleId, dto, user),
    };
  }

  @Get('companies/:companyId/performance/kpi-definitions')
  @RequirePermission('performance', 'view')
  async listKpiDefinitions(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListKpiDefinitionsQueryDto,
  ) {
    return {
      data: await this.performanceService.listKpiDefinitions(companyId, query),
    };
  }

  @Post('companies/:companyId/performance/kpi-definitions')
  @RequirePermission('performance', 'create')
  async createKpiDefinition(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateKpiDefinitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceService.createKpiDefinition(companyId, dto, user),
    };
  }

  @Patch('performance/kpi-definitions/:definitionId')
  @RequirePermission('performance', 'edit')
  async updateKpiDefinition(
    @Param('definitionId', ParseUUIDPipe) definitionId: string,
    @Body() dto: UpdateKpiDefinitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceService.updateKpiDefinition(
        definitionId,
        dto,
        user,
      ),
    };
  }

  @Get('companies/:companyId/performance/kpi-assignments')
  @RequirePermission('performance', 'view')
  async listKpiAssignments(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListEmployeeKpiAssignmentsQueryDto,
  ) {
    return {
      data: await this.performanceService.listKpiAssignments(companyId, query),
    };
  }

  @Post('companies/:companyId/performance/kpi-assignments')
  @RequirePermission('performance', 'create')
  async createKpiAssignment(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateEmployeeKpiAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceService.createKpiAssignment(companyId, dto, user),
    };
  }

  @Post('companies/:companyId/performance/kpi-assignments/bulk')
  @RequirePermission('performance', 'create')
  async bulkAssignKpi(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: BulkAssignKpiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceService.bulkAssignKpi(companyId, dto, user),
    };
  }

  @Patch('performance/kpi-assignments/:assignmentId')
  @RequirePermission('performance', 'edit')
  async updateKpiAssignment(
    @Param('assignmentId', ParseUUIDPipe) assignmentId: string,
    @Body() dto: UpdateEmployeeKpiAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceService.updateKpiAssignment(
        assignmentId,
        dto,
        user,
      ),
    };
  }

  @Get('companies/:companyId/performance/review-cycles/:cycleId/participants')
  @RequirePermission('performance', 'view')
  async listParticipants(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    return {
      data: await this.performanceReviewsService.listParticipants(companyId, cycleId),
    };
  }

  @Post('companies/:companyId/performance/review-cycles/:cycleId/participants')
  @RequirePermission('performance', 'edit')
  async setParticipants(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @Body() dto: SetReviewCycleParticipantsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceReviewsService.setParticipants(
        companyId,
        cycleId,
        dto,
        user,
      ),
    };
  }

  @Post('companies/:companyId/performance/review-cycles/:cycleId/launch')
  @RequirePermission('performance', 'edit')
  async launchReviewCycle(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceReviewsService.launchReviewCycle(
        companyId,
        cycleId,
        user,
      ),
    };
  }

  @Get('companies/:companyId/performance/reviews')
  @RequirePermission('performance', 'view')
  async listReviews(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListEmployeePerformanceReviewsQueryDto,
  ) {
    return {
      data: await this.performanceReviewsService.listReviews(companyId, query),
    };
  }

  @Get('performance/reviews/:reviewId')
  @RequirePermission('performance', 'view')
  async getReview(@Param('reviewId', ParseUUIDPipe) reviewId: string) {
    return { data: await this.performanceReviewsService.getReview(reviewId) };
  }

  @Patch('performance/reviews/:reviewId/self-assessment')
  @RequirePermission('performance', 'edit')
  async saveSelfAssessment(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: SaveSelfAssessmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceReviewsService.saveSelfAssessment(
        reviewId,
        dto,
        user,
      ),
    };
  }

  @Post('performance/reviews/:reviewId/submit-self')
  @RequirePermission('performance', 'edit')
  async submitSelfAssessment(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceReviewsService.submitSelfAssessment(
        reviewId,
        user,
      ),
    };
  }

  @Patch('performance/reviews/:reviewId/manager-assessment')
  @RequirePermission('performance', 'edit')
  async saveManagerAssessment(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: SaveManagerAssessmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceReviewsService.saveManagerAssessment(
        reviewId,
        dto,
        user,
      ),
    };
  }

  @Post('performance/reviews/:reviewId/submit-manager')
  @RequirePermission('performance', 'edit')
  async submitManagerAssessment(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceReviewsService.submitManagerAssessment(
        reviewId,
        user,
      ),
    };
  }

  @Post('performance/reviews/:reviewId/approve')
  @RequirePermission('performance', 'approve')
  async approveReview(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: WorkflowReviewActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceReviewsService.approveReviewWorkflow(
        reviewId,
        dto,
        user,
      ),
    };
  }

  @Post('performance/reviews/:reviewId/reject')
  @RequirePermission('performance', 'approve')
  async rejectReview(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: WorkflowReviewActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceReviewsService.rejectReviewWorkflow(
        reviewId,
        dto,
        user,
      ),
    };
  }

  @Get('performance/reviews/:reviewId/360-feedback')
  @RequirePermission('performance', 'view')
  async list360Feedback(@Param('reviewId', ParseUUIDPipe) reviewId: string) {
    return { data: await this.performance360Service.listFeedback(reviewId) };
  }

  @Get('performance/reviews/:reviewId/360-summary')
  @RequirePermission('performance', 'view')
  async get360Summary(@Param('reviewId', ParseUUIDPipe) reviewId: string) {
    return { data: await this.performance360Service.getSummary(reviewId) };
  }

  @Post('performance/reviews/:reviewId/360-feedback/invite')
  @RequirePermission('performance', 'edit')
  async invite360Reviewers(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: Invite360ReviewersDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performance360Service.inviteReviewers(reviewId, dto, user),
    };
  }

  @Patch('performance/360-feedback/:feedbackId')
  @RequirePermission('performance', 'edit')
  async submit360Feedback(
    @Param('feedbackId', ParseUUIDPipe) feedbackId: string,
    @Body() dto: Submit360FeedbackDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performance360Service.submitFeedback(feedbackId, dto, user),
    };
  }

  @Patch('performance/reviews/:reviewId/outcome')
  @RequirePermission('performance', 'edit')
  async saveReviewOutcome(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: SaveReviewOutcomeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceReviewsService.saveReviewOutcome(reviewId, dto, user),
    };
  }

  @Post('performance/reviews/:reviewId/submit-promotion')
  @RequirePermission('performance', 'edit')
  async submitPromotionRecommendation(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceReviewsService.submitPromotionRecommendation(
        reviewId,
        user,
      ),
    };
  }

  @Post('performance/reviews/:reviewId/approve-promotion')
  @RequirePermission('performance', 'approve')
  async approvePromotionRecommendation(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceReviewsService.approvePromotionRecommendation(
        reviewId,
        user,
      ),
    };
  }

  @Post('performance/reviews/:reviewId/reject-promotion')
  @RequirePermission('performance', 'approve')
  async rejectPromotionRecommendation(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: WorkflowReviewActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceReviewsService.rejectPromotionRecommendation(
        reviewId,
        dto,
        user,
      ),
    };
  }

  @Post('performance/reviews/:reviewId/execute-promotion')
  @RequirePermission('performance', 'approve')
  async executePromotionFromReview(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: ExecutePromotionFromReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.performanceReviewsService.executePromotionFromReview(
        reviewId,
        dto,
        user,
      ),
    };
  }

  @Get('companies/:companyId/performance/employees/:employeeId/history')
  @RequirePermission('performance', 'view')
  async performanceHistory(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return {
      data: await this.performanceReviewsService.listPerformanceHistory(
        companyId,
        employeeId,
      ),
    };
  }
}
