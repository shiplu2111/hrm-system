import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DataScopeService } from '../rbac/data-scope.service';
import { RequirePermission, SelfService } from '../rbac/require-permission.decorator';
import { ListPayslipsQueryDto } from './dto/payslips.dto';
import { PayslipService } from './payslip.service';

@ApiTags('payslips')
@ApiBearerAuth('access-token')
@Controller()
export class PayslipsController {
  constructor(
    private readonly payslipService: PayslipService,
    private readonly dataScope: DataScopeService,
  ) {}

  @SelfService()
  @Get('employees/:employeeId/payslips')
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'List payslips for an employee (MODULES.md §19)' })
  async listForEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    return { data: await this.payslipService.listForEmployee(employeeId, user) };
  }

  @SelfService()
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
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    const { buffer, meta, filename } =
      await this.payslipService.downloadPayslipFile(employeeId, payslipId, user);
    res.setHeader('Content-Type', meta.contentType ?? 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename.replace(/"/g, '')}"`,
    );
    res.send(buffer);
  }

  @Get('companies/:companyId/payslips')
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'Finalized and paid runs of a company with their payslips' })
  async listForCompany(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListPayslipsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.payslipService.listForCompany(companyId, query, user) };
  }

  @Get('companies/:companyId/payroll-runs/:runId/payslip')
  @RequirePermission('payroll', 'view')
  async getForRun(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
  ) {
    return { data: await this.payslipService.getForRun(companyId, runId) };
  }

  @Post('companies/:companyId/payroll-runs/:runId/payslip')
  @RequirePermission('payroll', 'finalize')
  @ApiOperation({ summary: 'Generate a missing payslip for a finalized run (idempotent)' })
  async generateForRun(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('runId', ParseUUIDPipe) runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.payslipService.generateForCompanyRun(companyId, runId, user) };
  }
}
