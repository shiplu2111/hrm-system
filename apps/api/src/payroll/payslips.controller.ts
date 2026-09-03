import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { PayslipService } from './payslip.service';

@ApiTags('payslips')
@ApiBearerAuth('access-token')
@Controller()
export class PayslipsController {
  constructor(private readonly payslipService: PayslipService) {}

  @Get('employees/:employeeId/payslips')
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'List payslips for an employee (MODULES.md §19)' })
  async listForEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
  ) {
    return { data: await this.payslipService.listForEmployee(employeeId) };
  }

  @Get('companies/:companyId/payroll-runs/:runId/payslip')
  @RequirePermission('payroll', 'view')
  async getForRun(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ) {
    return { data: await this.payslipService.getForRun(companyId, runId) };
  }
}
