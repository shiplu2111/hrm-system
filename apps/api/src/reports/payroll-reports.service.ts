import { Injectable } from '@nestjs/common';
import { PayrollRunStatus, Prisma } from '@prisma/client';
import type { ReportResult } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { SensitiveFieldService } from '../crypto/sensitive-field.service';
import { formatDateValue } from '../leave/leave.utils';
import type { ReportDateRange } from './report-date.util';
import { periodLabel } from './report-date.util';
import { findReportDefinition } from './reports.constants';

function money(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

@Injectable()
export class PayrollReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sensitiveFields: SensitiveFieldService,
  ) {}

  async generate(
    companyId: string,
    reportId: string,
    range: ReportDateRange,
  ): Promise<ReportResult> {
    switch (reportId) {
      case 'payroll.employee-summary':
        return this.employeeSummary(companyId, range);
      case 'payroll.activity-summary':
        return this.activitySummary(companyId, range);
      case 'payroll.superannuation-summary':
        return this.superannuationSummary(companyId, range);
      case 'payroll.register':
        return this.register(companyId, range);
      case 'payroll.salary-summary':
        return this.salarySummary(companyId, range);
      case 'payroll.earnings':
        return this.earnings(companyId, range);
      case 'payroll.deductions':
        return this.deductions(companyId, range);
      case 'payroll.tax':
        return this.tax(companyId, range);
      case 'payroll.overtime':
        return this.overtime(companyId, range);
      case 'payroll.variance':
        return this.variance(companyId, range);
      case 'payroll.payment':
        return this.payment(companyId, range);
      default:
        throw new Error(`Unknown payroll report: ${reportId}`);
    }
  }

  private async loadRuns(companyId: string, range: ReportDateRange) {
    return this.prisma.unscoped.payrollRun.findMany({
      where: {
        deletedAt: null,
        employee: { companyId, deletedAt: null },
        payrollPeriod: {
          startDate: { lte: range.to },
          endDate: { gte: range.from },
        },
      },
      include: {
        employee: {
          select: {
            employeeNumber: true,
            firstName: true,
            lastName: true,
            department: { select: { name: true } },
          },
        },
        payrollPeriod: {
          select: { startDate: true, endDate: true, paymentDate: true },
        },
        superannuationContributions: true,
        paymentBatchItem: {
          include: { paymentBatch: { select: { status: true, referenceNumber: true } } },
        },
      },
      orderBy: [{ payrollPeriod: { startDate: 'asc' } }, { employee: { lastName: 'asc' } }],
    });
  }

  private baseMeta(reportId: string, range: ReportDateRange, rowCount: number): ReportResult {
    const def = findReportDefinition(reportId)!;
    return {
      reportId,
      title: def.title,
      category: 'payroll',
      generatedAt: new Date().toISOString(),
      period: periodLabel(range),
      columns: [],
      rows: [],
      rowCount,
    };
  }

  private async employeeSummary(
    companyId: string,
    range: ReportDateRange,
  ): Promise<ReportResult> {
    const runs = await this.loadRuns(companyId, range);
    const byEmployee = new Map<
      string,
      { employeeNumber: string; name: string; department: string; gross: number; deductions: number; net: number; runs: number }
    >();

    for (const run of runs) {
      const key = run.employeeId;
      const existing = byEmployee.get(key) ?? {
        employeeNumber: run.employee.employeeNumber,
        name: `${run.employee.firstName} ${run.employee.lastName}`.trim(),
        department: run.employee.department?.name ?? 'Unassigned',
        gross: 0,
        deductions: 0,
        net: 0,
        runs: 0,
      };
      existing.gross += money(run.grossPay);
      existing.deductions += money(run.totalDeductions);
      existing.net += money(run.netPay);
      existing.runs += 1;
      byEmployee.set(key, existing);
    }

    const columns = [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'runCount', label: 'Runs' },
      { key: 'grossPay', label: 'Gross Pay' },
      { key: 'deductions', label: 'Deductions' },
      { key: 'netPay', label: 'Net Pay' },
    ];

    const rows = [...byEmployee.values()].map((row) => ({
      employeeNumber: row.employeeNumber,
      employeeName: row.name,
      department: row.department,
      runCount: row.runs,
      grossPay: row.gross.toFixed(2),
      deductions: row.deductions.toFixed(2),
      netPay: row.net.toFixed(2),
    }));

    return {
      ...this.baseMeta('payroll.employee-summary', range, rows.length),
      columns,
      rows,
      summary: {
        totalNetPay: rows.reduce((sum, r) => sum + Number(r.netPay), 0).toFixed(2),
      },
    };
  }

  private async activitySummary(
    companyId: string,
    range: ReportDateRange,
  ): Promise<ReportResult> {
    const runs = await this.loadRuns(companyId, range);
    const byStatus = new Map<string, { count: number; net: number }>();

    for (const run of runs) {
      const bucket = byStatus.get(run.status) ?? { count: 0, net: 0 };
      bucket.count += 1;
      bucket.net += money(run.netPay);
      byStatus.set(run.status, bucket);
    }

    const columns = [
      { key: 'status', label: 'Status' },
      { key: 'runCount', label: 'Run Count' },
      { key: 'totalNetPay', label: 'Total Net Pay' },
    ];
    const rows = [...byStatus.entries()].map(([status, data]) => ({
      status,
      runCount: data.count,
      totalNetPay: data.net.toFixed(2),
    }));

    return {
      ...this.baseMeta('payroll.activity-summary', range, rows.length),
      columns,
      rows,
    };
  }

  private async superannuationSummary(
    companyId: string,
    range: ReportDateRange,
  ): Promise<ReportResult> {
    const runs = await this.loadRuns(companyId, range);
    const columns = [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'period', label: 'Period' },
      { key: 'employeeContribution', label: 'Employee Super' },
      { key: 'employerContribution', label: 'Employer Super' },
      { key: 'totalContribution', label: 'Total Super' },
    ];

    const rows = runs.flatMap((run) =>
      run.superannuationContributions.map((superRow) => {
        const employee = money(superRow.employeeContribution);
        const employer = money(superRow.employerContribution);
        return {
          employeeNumber: run.employee.employeeNumber,
          employeeName: `${run.employee.firstName} ${run.employee.lastName}`.trim(),
          period: `${formatDateValue(run.payrollPeriod.startDate)} – ${formatDateValue(run.payrollPeriod.endDate)}`,
          employeeContribution: employee.toFixed(2),
          employerContribution: employer.toFixed(2),
          totalContribution: (employee + employer).toFixed(2),
        };
      }),
    );

    return {
      ...this.baseMeta('payroll.superannuation-summary', range, rows.length),
      columns,
      rows,
    };
  }

  private async register(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const runs = await this.loadRuns(companyId, range);
    const columns = [
      { key: 'runId', label: 'Run ID' },
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'periodStart', label: 'Period Start' },
      { key: 'periodEnd', label: 'Period End' },
      { key: 'status', label: 'Status' },
      { key: 'grossPay', label: 'Gross' },
      { key: 'deductions', label: 'Deductions' },
      { key: 'netPay', label: 'Net' },
    ];
    const rows = runs.map((run) => ({
      runId: run.id,
      employeeNumber: run.employee.employeeNumber,
      employeeName: `${run.employee.firstName} ${run.employee.lastName}`.trim(),
      periodStart: formatDateValue(run.payrollPeriod.startDate),
      periodEnd: formatDateValue(run.payrollPeriod.endDate),
      status: run.status,
      grossPay: money(run.grossPay).toFixed(2),
      deductions: money(run.totalDeductions).toFixed(2),
      netPay: money(run.netPay).toFixed(2),
    }));

    return {
      ...this.baseMeta('payroll.register', range, rows.length),
      columns,
      rows,
    };
  }

  private async salarySummary(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const runs = await this.loadRuns(companyId, range).then((items) =>
      items.filter(
        (run) =>
          run.status === PayrollRunStatus.finalized ||
          run.status === PayrollRunStatus.paid,
      ),
    );

    const byDept = new Map<string, { gross: number; net: number; employees: Set<string> }>();
    for (const run of runs) {
      const dept = run.employee.department?.name ?? 'Unassigned';
      const bucket = byDept.get(dept) ?? { gross: 0, net: 0, employees: new Set() };
      bucket.gross += money(run.grossPay);
      bucket.net += money(run.netPay);
      bucket.employees.add(run.employeeId);
      byDept.set(dept, bucket);
    }

    const columns = [
      { key: 'department', label: 'Department' },
      { key: 'employeeCount', label: 'Employees' },
      { key: 'grossPay', label: 'Gross Pay' },
      { key: 'netPay', label: 'Net Pay' },
    ];
    const rows = [...byDept.entries()].map(([department, data]) => ({
      department,
      employeeCount: data.employees.size,
      grossPay: data.gross.toFixed(2),
      netPay: data.net.toFixed(2),
    }));

    return {
      ...this.baseMeta('payroll.salary-summary', range, rows.length),
      columns,
      rows,
    };
  }

  private async earnings(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const runs = await this.loadRuns(companyId, range);
    const columns = [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'period', label: 'Period' },
      { key: 'grossPay', label: 'Earnings (Gross)' },
    ];
    const rows = runs.map((run) => ({
      employeeNumber: run.employee.employeeNumber,
      employeeName: `${run.employee.firstName} ${run.employee.lastName}`.trim(),
      period: formatDateValue(run.payrollPeriod.endDate),
      grossPay: money(run.grossPay).toFixed(2),
    }));
    return { ...this.baseMeta('payroll.earnings', range, rows.length), columns, rows };
  }

  private async deductions(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const runs = await this.loadRuns(companyId, range);
    const columns = [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'period', label: 'Period' },
      { key: 'deductions', label: 'Total Deductions' },
    ];
    const rows = runs.map((run) => ({
      employeeNumber: run.employee.employeeNumber,
      employeeName: `${run.employee.firstName} ${run.employee.lastName}`.trim(),
      period: formatDateValue(run.payrollPeriod.endDate),
      deductions: money(run.totalDeductions).toFixed(2),
    }));
    return { ...this.baseMeta('payroll.deductions', range, rows.length), columns, rows };
  }

  private async tax(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const runs = await this.loadRuns(companyId, range);
    const taxProfiles = await this.prisma.unscoped.employeeTaxProfile.findMany({
      where: { employee: { companyId, deletedAt: null } },
      select: { employeeId: true, taxIdNumber: true },
    });
    const taxByEmployee = new Map(
      taxProfiles.map((p) => [
        p.employeeId,
        this.sensitiveFields.mask(p.taxIdNumber) ?? '',
      ]),
    );

    const columns = [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'taxId', label: 'Tax ID' },
      { key: 'period', label: 'Period' },
      { key: 'taxWithheld', label: 'Tax Withheld (Deductions)' },
    ];
    const rows = runs.map((run) => ({
      employeeNumber: run.employee.employeeNumber,
      employeeName: `${run.employee.firstName} ${run.employee.lastName}`.trim(),
      taxId: taxByEmployee.get(run.employeeId) ?? '',
      period: formatDateValue(run.payrollPeriod.endDate),
      taxWithheld: money(run.totalDeductions).toFixed(2),
    }));
    return { ...this.baseMeta('payroll.tax', range, rows.length), columns, rows };
  }

  private async overtime(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const runs = await this.loadRuns(companyId, range);
    const columns = [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'period', label: 'Period' },
      { key: 'grossPay', label: 'Gross Pay' },
      { key: 'note', label: 'Note' },
    ];
    const rows = runs
      .filter((run) => money(run.grossPay) > 0)
      .map((run) => ({
        employeeNumber: run.employee.employeeNumber,
        employeeName: `${run.employee.firstName} ${run.employee.lastName}`.trim(),
        period: formatDateValue(run.payrollPeriod.endDate),
        grossPay: money(run.grossPay).toFixed(2),
        note: 'Review component-level overtime when formula engine lines are persisted',
      }));
    return { ...this.baseMeta('payroll.overtime', range, rows.length), columns, rows };
  }

  private async variance(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const runs = await this.loadRuns(companyId, range);
    const byEmployeePeriod = new Map<string, { period: string; net: number; employeeNumber: string; name: string }[]>();

    for (const run of runs) {
      const period = formatDateValue(run.payrollPeriod.endDate);
      const list = byEmployeePeriod.get(run.employeeId) ?? [];
      list.push({
        period,
        net: money(run.netPay),
        employeeNumber: run.employee.employeeNumber,
        name: `${run.employee.firstName} ${run.employee.lastName}`.trim(),
      });
      byEmployeePeriod.set(run.employeeId, list);
    }

    const columns = [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'previousPeriod', label: 'Previous Period' },
      { key: 'currentPeriod', label: 'Current Period' },
      { key: 'previousNet', label: 'Previous Net' },
      { key: 'currentNet', label: 'Current Net' },
      { key: 'variance', label: 'Variance' },
    ];

    const rows: Array<Record<string, string | number | null>> = [];
    for (const periods of byEmployeePeriod.values()) {
      periods.sort((a, b) => a.period.localeCompare(b.period));
      for (let i = 1; i < periods.length; i += 1) {
        const prev = periods[i - 1]!;
        const curr = periods[i]!;
        rows.push({
          employeeNumber: curr.employeeNumber,
          employeeName: curr.name,
          previousPeriod: prev.period,
          currentPeriod: curr.period,
          previousNet: prev.net.toFixed(2),
          currentNet: curr.net.toFixed(2),
          variance: (curr.net - prev.net).toFixed(2),
        });
      }
    }

    return { ...this.baseMeta('payroll.variance', range, rows.length), columns, rows };
  }

  private async payment(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const batches = await this.prisma.unscoped.paymentBatch.findMany({
      where: {
        companyId,
        createdAt: { gte: range.from, lte: range.to },
      },
      include: {
        items: {
          include: {
            employee: { select: { employeeNumber: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const columns = [
      { key: 'batchReference', label: 'Batch Reference' },
      { key: 'batchStatus', label: 'Batch Status' },
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'amount', label: 'Amount' },
      { key: 'itemStatus', label: 'Item Status' },
    ];

    const rows = batches.flatMap((batch) =>
      batch.items.map((item) => ({
        batchReference: batch.referenceNumber,
        batchStatus: batch.status,
        employeeNumber: item.employee.employeeNumber,
        employeeName: `${item.employee.firstName} ${item.employee.lastName}`.trim(),
        amount: money(item.amount).toFixed(2),
        itemStatus: item.status,
      })),
    );

    return { ...this.baseMeta('payroll.payment', range, rows.length), columns, rows };
  }
}
