import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
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

  @Get('employees/:employeeId/payslips/:payslipId/download')
  @RequirePermission('payroll', 'view')
  @ApiOperation({
    summary: 'Download payslip PDF (authenticated — not a public storage URL)',
  })
  async downloadPayslip(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('payslipId', ParseUUIDPipe) payslipId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, meta, filename } =
      await this.payslipService.downloadPayslipFile(employeeId, payslipId, user);
    res.setHeader('Content-Type', meta.contentType ?? 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename.replace(/"/g, '')}"`,
    );
    res.send(buffer);
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
