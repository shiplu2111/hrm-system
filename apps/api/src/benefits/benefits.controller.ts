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
  CancelBenefitEnrollmentDto,
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
  @ApiOperation({ summary: 'List benefit plans with enrollment counts and dependent rules' })
  async listPlans(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.benefitsService.listPlans(companyId) };
  }

  @Post('companies/:companyId/benefit-plans')
  @RequirePermission('payroll', 'create')
  @ApiOperation({ summary: 'Create a benefit plan (health, life, dental & vision, wellness or other)' })
  async createPlan(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateBenefitPlanDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.benefitsService.createPlan(companyId, dto, user) };
  }

  @Patch('benefit-plans/:planId')
  @RequirePermission('payroll', 'edit')
  @ApiOperation({ summary: 'Update a benefit plan, its costs, dependent rules or status' })
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
  @ApiOperation({ summary: 'Enroll an employee in a plan, optionally with dependents' })
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
  @ApiOperation({ summary: 'End an active enrollment and its dependent coverage' })
  async cancelEnrollment(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: CancelBenefitEnrollmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.benefitsService.cancelEnrollment(enrollmentId, dto, user) };
  }

  @Post('benefit-enrollments/:enrollmentId/dependents')
  @RequirePermission('payroll', 'create')
  @ApiOperation({ summary: "Add a dependent (or a life insurance beneficiary) to an enrollment" })
  async addDependent(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: AddBenefitEnrollmentDependentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.benefitsService.addDependent(enrollmentId, dto, user) };
  }

  @Post('benefit-enrollments/:enrollmentId/dependents/:dependentId/remove')
  @RequirePermission('payroll', 'edit')
  @ApiOperation({ summary: 'Stop covering a dependent on an active enrollment' })
  async removeDependent(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Param('dependentId', ParseUUIDPipe) dependentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.benefitsService.removeDependent(enrollmentId, dependentId, user),
    };
  }
}
