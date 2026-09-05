import { Injectable } from '@nestjs/common';
import { LifecycleEventType } from '@prisma/client';
import type { ReportResult } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { formatDateValue } from '../leave/leave.utils';
import type { ReportDateRange } from './report-date.util';
import { periodLabel } from './report-date.util';
import { findReportDefinition } from './reports.constants';

function readPersonalField(personalInfo: unknown, key: string): string {
  if (!personalInfo || typeof personalInfo !== 'object') return '';
  const value = (personalInfo as Record<string, unknown>)[key];
  return value === null || value === undefined ? '' : String(value);
}

@Injectable()
export class HrReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(
    companyId: string,
    reportId: string,
    range: ReportDateRange,
  ): Promise<ReportResult> {
    switch (reportId) {
      case 'hr.headcount':
        return this.headcount(companyId, range);
      case 'hr.new-hires':
        return this.newHires(companyId, range);
      case 'hr.terminations':
        return this.terminations(companyId, range);
      case 'hr.turnover':
        return this.turnover(companyId, range);
      case 'hr.demographics':
        return this.demographics(companyId, range);
      case 'hr.department-summary':
        return this.departmentSummary(companyId, range);
      case 'hr.employment-type-summary':
        return this.employmentTypeSummary(companyId, range);
      case 'hr.expiry':
        return this.expiry(companyId, range);
      case 'hr.probation-ending':
        return this.probationEnding(companyId, range);
      default:
        throw new Error(`Unknown HR report: ${reportId}`);
    }
  }

  private baseMeta(reportId: string, range: ReportDateRange, rowCount: number): ReportResult {
    const def = findReportDefinition(reportId)!;
    return {
      reportId,
      title: def.title,
      category: 'hr',
      generatedAt: new Date().toISOString(),
      period: periodLabel(range),
      columns: [],
      rows: [],
      rowCount,
    };
  }

  private employeeFilter(companyId: string) {
    return { companyId, deletedAt: null };
  }

  private async headcount(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const employees = await this.prisma.unscoped.employee.findMany({
      where: { ...this.employeeFilter(companyId), employmentStatus: 'active' },
      include: {
        department: { select: { name: true } },
        employmentType: { select: { name: true } },
      },
    });

    const byKey = new Map<string, number>();
    for (const employee of employees) {
      const dept = employee.department?.name ?? 'Unassigned';
      const type = employee.employmentType?.name ?? 'Unspecified';
      const key = `${dept} · ${type}`;
      byKey.set(key, (byKey.get(key) ?? 0) + 1);
    }

    const columns = [
      { key: 'department', label: 'Department' },
      { key: 'employmentType', label: 'Employment Type' },
      { key: 'headcount', label: 'Headcount' },
    ];
    const rows = [...byKey.entries()].map(([key, count]) => {
      const [department, employmentType] = key.split(' · ');
      return { department, employmentType, headcount: count };
    });

    return {
      ...this.baseMeta('hr.headcount', range, rows.length),
      columns,
      rows,
      summary: { totalHeadcount: employees.length },
    };
  }

  private async newHires(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const employees = await this.prisma.unscoped.employee.findMany({
      where: {
        ...this.employeeFilter(companyId),
        hireDate: { gte: range.from, lte: range.to },
      },
      include: {
        department: { select: { name: true } },
        designation: { select: { name: true } },
      },
      orderBy: { hireDate: 'asc' },
    });

    const columns = [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'hireDate', label: 'Hire Date' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
    ];
    const rows = employees.map((employee) => ({
      employeeNumber: employee.employeeNumber,
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      hireDate: formatDateValue(employee.hireDate),
      department: employee.department?.name ?? 'Unassigned',
      designation: employee.designation?.name ?? '',
    }));
    return { ...this.baseMeta('hr.new-hires', range, rows.length), columns, rows };
  }

  private async terminations(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const events = await this.prisma.unscoped.employeeLifecycleEvent.findMany({
      where: {
        eventType: { in: [LifecycleEventType.termination, LifecycleEventType.resignation] },
        effectiveDate: { gte: range.from, lte: range.to },
        employee: this.employeeFilter(companyId),
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
      },
      orderBy: { effectiveDate: 'asc' },
    });

    const columns = [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'eventType', label: 'Event Type' },
      { key: 'effectiveDate', label: 'Effective Date' },
      { key: 'department', label: 'Department' },
    ];
    const rows = events.map((event) => ({
      employeeNumber: event.employee.employeeNumber,
      employeeName: `${event.employee.firstName} ${event.employee.lastName}`.trim(),
      eventType: event.eventType,
      effectiveDate: formatDateValue(event.effectiveDate),
      department: event.employee.department?.name ?? 'Unassigned',
    }));
    return { ...this.baseMeta('hr.terminations', range, rows.length), columns, rows };
  }

  private async turnover(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const [activeEmployees, terminations] = await Promise.all([
      this.prisma.unscoped.employee.findMany({
        where: { ...this.employeeFilter(companyId), employmentStatus: 'active' },
        include: { department: { select: { name: true } } },
      }),
      this.prisma.unscoped.employeeLifecycleEvent.findMany({
        where: {
          eventType: { in: [LifecycleEventType.termination, LifecycleEventType.resignation] },
          effectiveDate: { gte: range.from, lte: range.to },
          employee: this.employeeFilter(companyId),
        },
        include: { employee: { include: { department: { select: { name: true } } } } },
      }),
    ]);

    const headcountByDept = new Map<string, number>();
    for (const employee of activeEmployees) {
      const dept = employee.department?.name ?? 'Unassigned';
      headcountByDept.set(dept, (headcountByDept.get(dept) ?? 0) + 1);
    }

    const terminationsByDept = new Map<string, number>();
    for (const event of terminations) {
      const dept = event.employee.department?.name ?? 'Unassigned';
      terminationsByDept.set(dept, (terminationsByDept.get(dept) ?? 0) + 1);
    }

    const departments = new Set([
      ...headcountByDept.keys(),
      ...terminationsByDept.keys(),
    ]);

    const columns = [
      { key: 'department', label: 'Department' },
      { key: 'headcount', label: 'Active Headcount' },
      { key: 'terminations', label: 'Terminations' },
      { key: 'turnoverRate', label: 'Turnover Rate %' },
    ];
    const rows = [...departments].map((department) => {
      const headcount = headcountByDept.get(department) ?? 0;
      const termCount = terminationsByDept.get(department) ?? 0;
      const rate = headcount > 0 ? ((termCount / headcount) * 100).toFixed(2) : '0.00';
      return {
        department,
        headcount,
        terminations: termCount,
        turnoverRate: rate,
      };
    });
    return { ...this.baseMeta('hr.turnover', range, rows.length), columns, rows };
  }

  private async demographics(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const employees = await this.prisma.unscoped.employee.findMany({
      where: { ...this.employeeFilter(companyId), employmentStatus: 'active' },
      select: { personalInfo: true },
    });

    const bySegment = new Map<string, number>();
    for (const employee of employees) {
      const gender = readPersonalField(employee.personalInfo, 'gender') || 'Not specified';
      const nationality =
        readPersonalField(employee.personalInfo, 'nationality') || 'Not specified';
      const key = `${gender} · ${nationality}`;
      bySegment.set(key, (bySegment.get(key) ?? 0) + 1);
    }

    const columns = [
      { key: 'gender', label: 'Gender' },
      { key: 'nationality', label: 'Nationality' },
      { key: 'count', label: 'Count' },
    ];
    const rows = [...bySegment.entries()].map(([key, count]) => {
      const [gender, nationality] = key.split(' · ');
      return { gender, nationality, count };
    });
    return { ...this.baseMeta('hr.demographics', range, rows.length), columns, rows };
  }

  private async departmentSummary(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const employees = await this.prisma.unscoped.employee.findMany({
      where: this.employeeFilter(companyId),
      include: { department: { select: { name: true } } },
    });

    const byDept = new Map<string, { active: number; inactive: number; total: number }>();
    for (const employee of employees) {
      const dept = employee.department?.name ?? 'Unassigned';
      const bucket = byDept.get(dept) ?? { active: 0, inactive: 0, total: 0 };
      bucket.total += 1;
      if (employee.employmentStatus === 'active') bucket.active += 1;
      else bucket.inactive += 1;
      byDept.set(dept, bucket);
    }

    const columns = [
      { key: 'department', label: 'Department' },
      { key: 'active', label: 'Active' },
      { key: 'inactive', label: 'Inactive' },
      { key: 'total', label: 'Total' },
    ];
    const rows = [...byDept.entries()].map(([department, data]) => ({
      department,
      active: data.active,
      inactive: data.inactive,
      total: data.total,
    }));
    return { ...this.baseMeta('hr.department-summary', range, rows.length), columns, rows };
  }

  private async employmentTypeSummary(
    companyId: string,
    range: ReportDateRange,
  ): Promise<ReportResult> {
    const employees = await this.prisma.unscoped.employee.findMany({
      where: { ...this.employeeFilter(companyId), employmentStatus: 'active' },
      include: { employmentType: { select: { name: true } } },
    });

    const byType = new Map<string, number>();
    for (const employee of employees) {
      const type = employee.employmentType?.name ?? 'Unspecified';
      byType.set(type, (byType.get(type) ?? 0) + 1);
    }

    const columns = [
      { key: 'employmentType', label: 'Employment Type' },
      { key: 'headcount', label: 'Headcount' },
    ];
    const rows = [...byType.entries()].map(([employmentType, headcount]) => ({
      employmentType,
      headcount,
    }));
    return { ...this.baseMeta('hr.employment-type-summary', range, rows.length), columns, rows };
  }

  private async expiry(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const [documents, contracts] = await Promise.all([
      this.prisma.unscoped.employeeDocument.findMany({
        where: {
          expiryDate: { gte: range.from, lte: range.to },
          employee: this.employeeFilter(companyId),
          documentType: { tracksExpiry: true },
        },
        include: {
          documentType: { select: { name: true } },
          employee: { select: { employeeNumber: true, firstName: true, lastName: true } },
        },
        orderBy: { expiryDate: 'asc' },
      }),
      this.prisma.unscoped.employmentContract.findMany({
        where: {
          endDate: { gte: range.from, lte: range.to },
          employee: this.employeeFilter(companyId),
        },
        include: {
          employee: { select: { employeeNumber: true, firstName: true, lastName: true } },
        },
        orderBy: { endDate: 'asc' },
      }),
    ]);

    const columns = [
      { key: 'itemType', label: 'Type' },
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'label', label: 'Item' },
      { key: 'expiryDate', label: 'Expiry Date' },
    ];

    const docRows = documents.map((doc) => ({
      itemType: 'Document',
      employeeNumber: doc.employee.employeeNumber,
      employeeName: `${doc.employee.firstName} ${doc.employee.lastName}`.trim(),
      label: doc.documentType.name,
      expiryDate: doc.expiryDate ? formatDateValue(doc.expiryDate) : '',
    }));

    const contractRows = contracts.map((contract) => ({
      itemType: 'Contract',
      employeeNumber: contract.employee.employeeNumber,
      employeeName: `${contract.employee.firstName} ${contract.employee.lastName}`.trim(),
      label: contract.contractType,
      expiryDate: contract.endDate ? formatDateValue(contract.endDate) : '',
    }));

    const rows = [...docRows, ...contractRows];
    return { ...this.baseMeta('hr.expiry', range, rows.length), columns, rows };
  }

  private async probationEnding(companyId: string, range: ReportDateRange): Promise<ReportResult> {
    const employees = await this.prisma.unscoped.employee.findMany({
      where: {
        ...this.employeeFilter(companyId),
        probationEndDate: { gte: range.from, lte: range.to },
      },
      include: {
        department: { select: { name: true } },
        designation: { select: { name: true } },
      },
      orderBy: { probationEndDate: 'asc' },
    });

    const columns = [
      { key: 'employeeNumber', label: 'Employee #' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'probationEndDate', label: 'Probation End Date' },
      { key: 'department', label: 'Department' },
      { key: 'designation', label: 'Designation' },
    ];
    const rows = employees.map((employee) => ({
      employeeNumber: employee.employeeNumber,
      employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
      probationEndDate: employee.probationEndDate
        ? formatDateValue(employee.probationEndDate)
        : '',
      department: employee.department?.name ?? 'Unassigned',
      designation: employee.designation?.name ?? '',
    }));
    return { ...this.baseMeta('hr.probation-ending', range, rows.length), columns, rows };
  }
}
