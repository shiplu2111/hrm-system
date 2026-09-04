import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ReportCatalogView,
  ReportExportFormat,
  ReportResult,
} from '@hrm/shared-types';
import { CompanyScopeService } from '../organization/company-scope.service';
import { AttendanceReportsService } from './attendance-reports.service';
import { HrReportsService } from './hr-reports.service';
import { PayrollReportsService } from './payroll-reports.service';
import {
  contentTypeForFormat,
  fileExtensionForFormat,
  serializeReportCsv,
  serializeReportXlsx,
} from './report-export.util';
import { resolveReportDateRange, type ReportDateRange } from './report-date.util';
import { findReportDefinition, REPORT_CATALOG, REPORT_IDS } from './reports.constants';

export interface ReportExportPayload {
  buffer: Buffer | string;
  contentType: string;
  filename: string;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly companyScope: CompanyScopeService,
    private readonly payrollReports: PayrollReportsService,
    private readonly attendanceReports: AttendanceReportsService,
    private readonly hrReports: HrReportsService,
  ) {}

  async getCatalog(companyId: string): Promise<ReportCatalogView> {
    await this.companyScope.assertCompanyInTenant(companyId);
    return { reports: REPORT_CATALOG };
  }

  async runReport(
    companyId: string,
    reportId: string,
    from?: string,
    to?: string,
  ): Promise<ReportResult> {
    await this.companyScope.assertCompanyInTenant(companyId);
    this.assertKnownReport(reportId);
    const range = resolveReportDateRange(from, to);
    return this.generate(companyId, reportId, range);
  }

  async exportReport(
    companyId: string,
    reportId: string,
    format: ReportExportFormat,
    from?: string,
    to?: string,
  ): Promise<ReportExportPayload> {
    const result = await this.runReport(companyId, reportId, from, to);
    const safeTitle = result.title.replace(/[^\w\-]+/g, '_').slice(0, 60);
    const filename = `${safeTitle}_${result.period.from}_${result.period.to}.${fileExtensionForFormat(format)}`;

    if (format === 'xlsx') {
      return {
        buffer: serializeReportXlsx(result.columns, result.rows, result.title),
        contentType: contentTypeForFormat(format),
        filename,
      };
    }

    return {
      buffer: serializeReportCsv(result.columns, result.rows),
      contentType: contentTypeForFormat(format),
      filename,
    };
  }

  private assertKnownReport(reportId: string): void {
    if (!REPORT_IDS.has(reportId)) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Report "${reportId}" was not found`,
      });
    }
    const definition = findReportDefinition(reportId);
    if (!definition) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Report "${reportId}" was not found`,
      });
    }
  }

  private generate(
    companyId: string,
    reportId: string,
    range: ReportDateRange,
  ): Promise<ReportResult> {
    if (reportId.startsWith('payroll.')) {
      return this.payrollReports.generate(companyId, reportId, range);
    }
    if (reportId.startsWith('attendance.')) {
      return this.attendanceReports.generate(companyId, reportId, range);
    }
    if (reportId.startsWith('hr.')) {
      return this.hrReports.generate(companyId, reportId, range);
    }
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Unsupported report category for "${reportId}"`,
    });
  }
}
