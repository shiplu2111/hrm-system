import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  ReportCatalogView,
  ReportDefinition,
  ReportExportFormat,
  ReportResult,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
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
import { canRunReportCategory } from './report-access';
import { findReportDefinition, REPORT_CATALOG } from './reports.constants';

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
    private readonly dataScope: DataScopeService,
  ) {}

  async getCatalog(companyId: string, user: AuthenticatedUser): Promise<ReportCatalogView> {
    await this.companyScope.assertCompanyInTenant(companyId);
    return {
      reports: REPORT_CATALOG.filter((report) => canRunReportCategory(user, report.category)),
    };
  }

  async runReport(
    companyId: string,
    reportId: string,
    user: AuthenticatedUser,
    from?: string,
    to?: string,
  ): Promise<ReportResult> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const definition = this.findKnownReport(reportId);
    this.assertCanRun(user, definition);
    const range = resolveReportDateRange(from, to);
    return this.generate(
      companyId,
      reportId,
      range,
      await this.dataScope.employeeIdFilter(user),
    );
  }

  async exportReport(
    companyId: string,
    reportId: string,
    user: AuthenticatedUser,
    format: ReportExportFormat,
    from?: string,
    to?: string,
  ): Promise<ReportExportPayload> {
    const result = await this.runReport(companyId, reportId, user, from, to);
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

  private findKnownReport(reportId: string): ReportDefinition {
    const definition = findReportDefinition(reportId);
    if (!definition) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Report "${reportId}" was not found`,
      });
    }
    return definition;
  }

  private assertCanRun(user: AuthenticatedUser, definition: ReportDefinition): void {
    if (!canRunReportCategory(user, definition.category)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `You don't have access to ${definition.category === 'hr' ? 'HR' : definition.category} reports`,
      });
    }
  }

  private generate(
    companyId: string,
    reportId: string,
    range: ReportDateRange,
    employeeIds: { in: string[] } | undefined,
  ): Promise<ReportResult> {
    if (reportId.startsWith('payroll.')) {
      return this.payrollReports.generate(companyId, reportId, range, employeeIds);
    }
    if (reportId.startsWith('attendance.')) {
      return this.attendanceReports.generate(companyId, reportId, range, employeeIds);
    }
    if (reportId.startsWith('hr.')) {
      return this.hrReports.generate(companyId, reportId, range, employeeIds);
    }
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: `Unsupported report category for "${reportId}"`,
    });
  }
}
