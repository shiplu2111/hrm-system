import { Injectable } from '@nestjs/common';
import type { OrgChartData } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from './company-scope.service';
import {
  buildOrgChart,
  type OrgChartEmployeeInput,
  type OrgChartRequisitionInput,
} from './org-chart.builder';

const ACTIVE_CANDIDATE_STAGES = ['applied', 'screening', 'interview', 'offer'] as const;

function readContact(personalInfo: unknown): { email: string | null; phone: string | null } {
  const contact =
    personalInfo && typeof personalInfo === 'object'
      ? (personalInfo as { contact?: Record<string, unknown> }).contact
      : undefined;
  const pick = (key: string) => {
    const value = contact?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  };
  return { email: pick('email'), phone: pick('phone') ?? pick('mobile') };
}

@Injectable()
export class OrgChartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  async getOrgChart(companyId: string, user: AuthenticatedUser): Promise<OrgChartData> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const includesRequisitions = user.permissions.some(
      (p) => p.module === 'recruitment' && p.action === 'view',
    );

    const [employeeRows, departments, requisitionRows] = await Promise.all([
      this.prisma.unscoped.employee.findMany({
        where: { companyId, deletedAt: null },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        select: {
          id: true,
          employeeNumber: true,
          firstName: true,
          lastName: true,
          employmentStatus: true,
          hireDate: true,
          personalInfo: true,
          managerId: true,
          departmentId: true,
          designationId: true,
          department: { select: { name: true } },
          designation: {
            select: {
              name: true,
              jobLevel: { select: { id: true, code: true, name: true, rank: true } },
            },
          },
          user: { select: { email: true } },
        },
      }),
      this.prisma.unscoped.department.findMany({
        where: { companyId },
        select: { id: true, parentDepartmentId: true },
      }),
      includesRequisitions
        ? this.prisma.unscoped.jobRequisition.findMany({
            where: { companyId, status: { in: ['open', 'pending_approval'] } },
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              referenceNumber: true,
              title: true,
              status: true,
              headcount: true,
              openedAt: true,
              requestedByEmployeeId: true,
              departmentId: true,
              designationId: true,
              department: { select: { name: true } },
              jobLevel: { select: { id: true, code: true, name: true, rank: true } },
              designation: {
                select: {
                  jobLevel: { select: { id: true, code: true, name: true, rank: true } },
                },
              },
              applications: { select: { stage: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const terminatedIds = employeeRows
      .filter((e) => e.employmentStatus === 'terminated')
      .map((e) => e.id);
    const exits = terminatedIds.length
      ? await this.prisma.unscoped.employeeLifecycleEvent.findMany({
          where: {
            employeeId: { in: terminatedIds },
            eventType: { in: ['resignation', 'termination'] },
          },
          orderBy: { effectiveDate: 'desc' },
          select: { employeeId: true, eventType: true, effectiveDate: true },
        })
      : [];
    const latestExit = new Map<string, (typeof exits)[number]>();
    for (const exit of exits) {
      if (!latestExit.has(exit.employeeId)) latestExit.set(exit.employeeId, exit);
    }

    const employees: OrgChartEmployeeInput[] = employeeRows.map((e) => {
      const contact = readContact(e.personalInfo);
      const exit = latestExit.get(e.id);
      return {
        id: e.id,
        employeeNumber: e.employeeNumber,
        firstName: e.firstName,
        lastName: e.lastName,
        status: e.employmentStatus,
        hireDate: e.hireDate.toISOString().slice(0, 10),
        email: contact.email ?? e.user?.email ?? null,
        phone: contact.phone,
        managerId: e.managerId,
        designationId: e.designationId,
        designationName: e.designation?.name ?? null,
        departmentId: e.departmentId,
        departmentName: e.department?.name ?? null,
        jobLevel: e.designation?.jobLevel ?? null,
        exitType:
          exit?.eventType === 'resignation' || exit?.eventType === 'termination'
            ? exit.eventType
            : null,
        exitDate: exit ? exit.effectiveDate.toISOString().slice(0, 10) : null,
      };
    });

    const requisitions: OrgChartRequisitionInput[] = requisitionRows.map((r) => ({
      id: r.id,
      referenceNumber: r.referenceNumber,
      title: r.title,
      status: r.status as 'open' | 'pending_approval',
      headcount: r.headcount,
      hired: r.applications.filter((a) => a.stage === 'hired').length,
      activeCandidates: r.applications.filter((a) =>
        (ACTIVE_CANDIDATE_STAGES as readonly string[]).includes(a.stage),
      ).length,
      openedAt: r.openedAt ? r.openedAt.toISOString() : null,
      requestedByEmployeeId: r.requestedByEmployeeId,
      designationId: r.designationId,
      departmentId: r.departmentId,
      departmentName: r.department?.name ?? null,
      jobLevel: r.jobLevel ?? r.designation?.jobLevel ?? null,
    }));

    const { nodes, summary } = buildOrgChart(employees, requisitions, departments);
    return {
      companyId,
      generatedAt: new Date().toISOString(),
      includesRequisitions,
      nodes,
      summary,
    };
  }
}
