import { Controller, Get, Param, ParseUUIDPipe, Post, Body, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { PayrollPreviewQueryDto } from './dto/payroll-calculation.dto';
import { PayrollSimulateDto } from './dto/payroll-simulation.dto';
import { PayrollCalculationService } from './payroll-calculation.service';

@ApiTags('payroll-calculation')
@ApiBearerAuth('access-token')
@Controller('employees/:employeeId/payroll')
export class PayrollCalculationController {
  constructor(
    private readonly payrollCalculationService: PayrollCalculationService,
  ) {}

  @Get('preview')
  @RequirePermission('payroll', 'view')
  @ApiOperation({
    summary: 'Preview Gross → Deductions → Net from salary structure',
  })
  async preview(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: PayrollPreviewQueryDto,
  ) {
    return {
      data: await this.payrollCalculationService.preview(
        employeeId,
        query.asOf,
      ),
    };
  }

  @Post('simulate')
  @RequirePermission('payroll', 'view')
  @ApiOperation({
    summary:
      'What-if net pay simulation — no payroll_run writes (PAYROLL_LOGIC.md §8)',
  })
  async simulate(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: PayrollSimulateDto,
  ) {
    return {
      data: await this.payrollCalculationService.simulate({
        employeeId,
        asOf: dto.asOf,
        structureOverrides: dto.structureOverrides,
      }),
    };
  }
}
