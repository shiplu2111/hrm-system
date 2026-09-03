import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreatePayrollRunDto,
  ListPayrollRunsQueryDto,
  PayrollRunTransitionDto,
} from './dto/payroll-runs.dto';
import { PayrollRunsService } from './payroll-runs.service';

@ApiTags('payroll-runs')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId')
export class PayrollRunsController {
  constructor(private readonly payrollRunsService: PayrollRunsService) {}

  @Get('payroll-periods/:periodId/runs')
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'List payroll runs for a period' })
  async listForPeriod(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Query() query: ListPayrollRunsQueryDto,
  ) {
    return {
      data: await this.payrollRunsService.listForPeriod(
        companyId,
        periodId,
        query,
      ),
    };
  }

  @Post('payroll-periods/:periodId/runs')
  @RequirePermission('payroll', 'create')
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('periodId', ParseUUIDPipe) periodId: string,
    @Body() dto: CreatePayrollRunDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.payrollRunsService.create(companyId, periodId, dto, user),
    };
  }

  @Get('payroll-runs/:runId')
  @RequirePermission('payroll', 'view')
  async get(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ) {
    return {
      data: await this.payrollRunsService.get(companyId, runId),
    };
  }

  @Post('payroll-runs/:runId/calculate')
  @RequirePermission('payroll', 'edit')
  @ApiOperation({
    summary:
      'Calculate or recalculate pay (allowed in draft/calculated/under_review only)',
  })
  async calculate(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.payrollRunsService.calculate(companyId, runId, user),
    };
  }

  @Post('payroll-runs/:runId/transition')
  @RequirePermission('payroll', 'view')
  @ApiOperation({
    summary:
      'Advance payroll run status (Draft→Calculated→Under Review→Approved→Finalized→Paid, or Cancelled)',
  })
  async transition(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
    @Body() dto: PayrollRunTransitionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.payrollRunsService.transition(
        companyId,
        runId,
        dto,
        user,
      ),
    };
  }
}
