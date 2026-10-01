import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ReportExportQueryDto, ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

/** Per-category access is enforced in ReportsService (see report-access.ts). */
const ANY_REPORT_MODULE = {
  orAnyOf: [
    { module: 'payroll', action: 'view' as const },
    { module: 'attendance', action: 'view' as const },
  ],
};

@ApiTags('reports')
@ApiBearerAuth('access-token')
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('companies/:companyId/reports/catalog')
  @RequirePermission('employee', 'view', ANY_REPORT_MODULE)
  @ApiOperation({ summary: 'Report catalog (MODULES.md §38), filtered to what the caller may run' })
  async getCatalog(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.reportsService.getCatalog(companyId, user) };
  }

  @Get('companies/:companyId/reports/:reportId')
  @RequirePermission('employee', 'view', ANY_REPORT_MODULE)
  @ApiOperation({ summary: 'Run a report and return tabular JSON' })
  async runReport(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('reportId') reportId: string,
    @Query() query: ReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.reportsService.runReport(
        companyId,
        reportId,
        user,
        query.from,
        query.to,
      ),
    };
  }

  @Get('companies/:companyId/reports/:reportId/export')
  @RequirePermission('employee', 'view', ANY_REPORT_MODULE)
  @ApiOperation({ summary: 'Export report as CSV or Excel (UI_GUIDELINES.md §2)' })
  async exportReport(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('reportId') reportId: string,
    @Query() query: ReportExportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const payload = await this.reportsService.exportReport(
      companyId,
      reportId,
      user,
      query.format ?? 'csv',
      query.from,
      query.to,
    );

    res.setHeader('Content-Type', payload.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${payload.filename}"`,
    );
    res.send(payload.buffer);
  }
}
