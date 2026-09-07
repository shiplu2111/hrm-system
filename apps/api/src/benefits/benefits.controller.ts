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
import { BenefitsService } from './benefits.service';
import {
  AddBenefitEnrollmentDependentDto,
  CreateBenefitEnrollmentDto,
  CreateBenefitOpenEnrollmentDto,
  CreateBenefitPlanDto,
  ListBenefitEnrollmentsQueryDto,
  UpdateBenefitPlanDto,
} from './dto/benefits.dto';

@ApiTags('benefits')
@ApiBearerAuth('access-token')
@Controller()
export class BenefitsController {
  constructor(private readonly benefitsService: BenefitsService) {}

  @Get('companies/:companyId/benefits/summary')
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'Benefits administration dashboard summary' })
  async summary(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.benefitsService.getSummary(companyId) };
  }

  @Get('companies/:companyId/benefit-plans')
  @RequirePermission('payroll', 'view')
  async listPlans(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.benefitsService.listPlans(companyId) };
  }

  @Post('companies/:companyId/benefit-plans')
  @RequirePermission('payroll', 'create')
  async createPlan(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateBenefitPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.benefitsService.createPlan(companyId, dto, user) };
  }

  @Patch('benefit-plans/:planId')
  @RequirePermission('payroll', 'edit')
  async updatePlan(
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdateBenefitPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.benefitsService.updatePlan(planId, dto, user) };
  }

  @Get('companies/:companyId/benefit-open-enrollments')
  @RequirePermission('payroll', 'view')
  async listOpenEnrollments(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return { data: await this.benefitsService.listOpenEnrollments(companyId) };
  }

  @Post('companies/:companyId/benefit-open-enrollments')
  @RequirePermission('payroll', 'create')
  async createOpenEnrollment(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateBenefitOpenEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.benefitsService.createOpenEnrollment(companyId, dto, user),
    };
  }

  @Post('benefit-open-enrollments/:periodId/open')
  @RequirePermission('payroll', 'edit')
  async openEnrollmentPeriod(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.benefitsService.openEnrollmentPeriod(periodId, user) };
  }

  @Post('benefit-open-enrollments/:periodId/close')
  @RequirePermission('payroll', 'edit')
  async closeEnrollmentPeriod(
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.benefitsService.closeEnrollmentPeriod(periodId, user) };
  }

  @Get('companies/:companyId/benefit-enrollments')
  @RequirePermission('payroll', 'view')
  async listEnrollments(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListBenefitEnrollmentsQueryDto,
  ) {
    return { data: await this.benefitsService.listEnrollments(companyId, query) };
  }

  @Post('companies/:companyId/benefit-enrollments')
  @RequirePermission('payroll', 'create')
  async createEnrollment(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateBenefitEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.benefitsService.createEnrollment(companyId, dto, user),
    };
  }

  @Post('benefit-enrollments/:enrollmentId/cancel')
  @RequirePermission('payroll', 'edit')
  async cancelEnrollment(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.benefitsService.cancelEnrollment(enrollmentId, user) };
  }

  @Post('benefit-enrollments/:enrollmentId/dependents')
  @RequirePermission('payroll', 'create')
  async addDependent(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: AddBenefitEnrollmentDependentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.benefitsService.addDependent(enrollmentId, dto, user) };
  }
}
