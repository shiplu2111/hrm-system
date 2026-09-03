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
  CreatePayrollAdjustmentDto,
  ListPayrollAdjustmentsQueryDto,
} from './dto/payroll-adjustments.dto';
import { PayrollAdjustmentsService } from './payroll-adjustments.service';

@ApiTags('payroll-adjustments')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/payroll-adjustments')
export class PayrollAdjustmentsController {
  constructor(
    private readonly payrollAdjustmentsService: PayrollAdjustmentsService,
  ) {}

  @Get()
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'List retroactive payroll adjustments' })
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListPayrollAdjustmentsQueryDto,
  ) {
    return {
      data: await this.payrollAdjustmentsService.list(companyId, query),
    };
  }

  @Get(':adjustmentId')
  @RequirePermission('payroll', 'view')
  async get(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('adjustmentId', ParseUUIDPipe) adjustmentId: string,
  ) {
    return {
      data: await this.payrollAdjustmentsService.get(companyId, adjustmentId),
    };
  }

  @Post()
  @RequirePermission('payroll', 'create')
  @ApiOperation({
    summary:
      'Create retroactive adjustment vs a finalized run — never mutates original run (§11)',
  })
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreatePayrollAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.payrollAdjustmentsService.create(companyId, dto, user),
    };
  }

  @Post(':adjustmentId/submit')
  @RequirePermission('payroll', 'edit')
  async submit(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('adjustmentId', ParseUUIDPipe) adjustmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.payrollAdjustmentsService.submit(
        companyId,
        adjustmentId,
        user,
      ),
    };
  }

  @Post(':adjustmentId/apply')
  @RequirePermission('payroll', 'finalize')
  @ApiOperation({
    summary: 'Mark adjustment applied in the target payroll cycle (§11)',
  })
  async apply(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('adjustmentId', ParseUUIDPipe) adjustmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.payrollAdjustmentsService.apply(
        companyId,
        adjustmentId,
        user,
      ),
    };
  }

  @Post(':adjustmentId/cancel')
  @RequirePermission('payroll', 'edit')
  async cancel(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('adjustmentId', ParseUUIDPipe) adjustmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.payrollAdjustmentsService.cancel(
        companyId,
        adjustmentId,
        user,
      ),
    };
  }
}
