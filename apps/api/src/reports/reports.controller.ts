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
import { RequirePermission } from '../rbac/require-permission.decorator';
import { ReportExportQueryDto, ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth('access-token')
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('companies/:companyId/reports/catalog')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Report catalog (MODULES.md §38)' })
  async getCatalog(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.reportsService.getCatalog(companyId) };
  }

  @Get('companies/:companyId/reports/:reportId')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Run a report and return tabular JSON' })
  async runReport(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('reportId') reportId: string,
    @Query() query: ReportQueryDto,
  ) {
    return {
      data: await this.reportsService.runReport(
        companyId,
        reportId,
        query.from,
        query.to,
      ),
    };
  }

  @Get('companies/:companyId/reports/:reportId/export')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Export report as CSV or Excel (UI_GUIDELINES.md §2)' })
  async exportReport(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('reportId') reportId: string,
    @Query() query: ReportExportQueryDto,
    @Res() res: Response,
  ) {
    const payload = await this.reportsService.exportReport(
      companyId,
      reportId,
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
