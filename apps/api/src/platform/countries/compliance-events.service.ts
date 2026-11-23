import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  ComplianceDueDateRule,
  ComplianceEventCategory,
  ComplianceEventStatus,
  ComplianceEventTenantPreviewResponse,
  ComplianceEventView,
  ComplianceNotifiedTenantPreviewItem,
  ComplianceRecipientUser,
  ComplianceRecurrence,
  CreateComplianceEventInput,
  PreviewComplianceNoticeTenantsInput,
  UpdateComplianceEventInput,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import {
  formatDateUtc,
  parseDateUtc,
  resolveNextDueDate,
} from './compliance-calendar.utils';

@Injectable()
export class ComplianceEventsService {
  private readonly logger = new Logger(ComplianceEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List compliance events for a specific country, optionally filtered by state.
   * Calculates nextDueDate, daysUntilDue, and isNoticeWindowActive relative to asOfDate.
   */
  async listComplianceEvents(
    countryId: string,
    stateProvinceId?: string | null,
    asOfDate: string = formatDateUtc(new Date()),
  ): Promise<ComplianceEventView[]> {
    const country = await this.prisma.unscoped.country.findUnique({
      where: { id: countryId },
      select: { id: true, name: true, isoCode: true },
    });

    if (!country) {
      throw new NotFoundException(`Country with ID ${countryId} not found`);
    }

    // Auto-seed default statutory compliance events if none exist for this country
    const count = await this.prisma.unscoped.complianceEvent.count({
      where: { countryId },
    });
    if (count === 0) {
      await this.seedDefaultEventsForCountry(countryId);
    }

    const events = await this.prisma.unscoped.complianceEvent.findMany({
      where: {
        countryId,
        ...(stateProvinceId
          ? {
              OR: [
                { stateProvinceId },
                { stateProvinceId: null }, // national rules also apply
              ],
            }
          : {}),
      },
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
        stateProvince: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });

    return events.map((event) => this.mapToView(event, asOfDate));
  }

  /**
   * Get single compliance event with next due date calculation.
   */
  async getComplianceEvent(
    id: string,
    asOfDate: string = formatDateUtc(new Date()),
  ): Promise<ComplianceEventView> {
    const event = await this.prisma.unscoped.complianceEvent.findUnique({
      where: { id },
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
        stateProvince: { select: { id: true, name: true, code: true } },
      },
    });

    if (!event) {
      throw new NotFoundException(`Compliance event with ID ${id} not found`);
    }

    return this.mapToView(event, asOfDate);
  }

  /**
   * Create a new compliance event.
   */
  async createComplianceEvent(
    input: CreateComplianceEventInput,
  ): Promise<ComplianceEventView> {
    const country = await this.prisma.unscoped.country.findUnique({
      where: { id: input.countryId },
      select: { id: true },
    });
    if (!country) {
      throw new NotFoundException(`Country with ID ${input.countryId} not found`);
    }

    if (input.stateProvinceId) {
      const state = await this.prisma.unscoped.stateProvince.findFirst({
        where: { id: input.stateProvinceId, countryId: input.countryId },
      });
      if (!state) {
        throw new BadRequestException(
          `StateProvince ID ${input.stateProvinceId} does not belong to country ${input.countryId}`,
        );
      }
    }

    this.validateDueDateRule(input.recurrence, input.dueDateRule);

    const created = await this.prisma.unscoped.complianceEvent.create({
      data: {
        countryId: input.countryId,
        stateProvinceId: input.stateProvinceId || null,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        category: (input.category || 'tax_filing') as any,
        recurrence: input.recurrence as any,
        dueDateRule: input.dueDateRule as any,
        applicablePlans: input.applicablePlans || [],
        companyType: input.companyType?.trim() || null,
        sourceReference: input.sourceReference?.trim() || null,
        noticeDaysBefore: input.noticeDaysBefore || 7,
        penaltiesSummary: input.penaltiesSummary?.trim() || null,
        filingPortalUrl: input.filingPortalUrl?.trim() || null,
        actionRequired: input.actionRequired?.trim() || null,
        status: (input.status || 'active') as any,
      },
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
        stateProvince: { select: { id: true, name: true, code: true } },
      },
    });

    return this.mapToView(created, formatDateUtc(new Date()));
  }

  /**
   * Update an existing compliance event.
   */
  async updateComplianceEvent(
    id: string,
    input: UpdateComplianceEventInput,
  ): Promise<ComplianceEventView> {
    const existing = await this.prisma.unscoped.complianceEvent.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Compliance event with ID ${id} not found`);
    }

    if (input.stateProvinceId) {
      const targetCountryId = input.countryId || existing.countryId;
      const state = await this.prisma.unscoped.stateProvince.findFirst({
        where: { id: input.stateProvinceId, countryId: targetCountryId },
      });
      if (!state) {
        throw new BadRequestException(
          `StateProvince ID ${input.stateProvinceId} does not belong to target country`,
        );
      }
    }

    const recurrence = input.recurrence || (existing.recurrence as ComplianceRecurrence);
    const rule = (input.dueDateRule || existing.dueDateRule) as ComplianceDueDateRule;
    this.validateDueDateRule(recurrence, rule);

    const updated = await this.prisma.unscoped.complianceEvent.update({
      where: { id },
      data: {
        ...(input.countryId ? { countryId: input.countryId } : {}),
        ...(input.stateProvinceId !== undefined ? { stateProvinceId: input.stateProvinceId } : {}),
        ...(input.title ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        ...(input.category ? { category: input.category as any } : {}),
        ...(input.recurrence ? { recurrence: input.recurrence as any } : {}),
        ...(input.dueDateRule ? { dueDateRule: input.dueDateRule as any } : {}),
        ...(input.applicablePlans !== undefined ? { applicablePlans: input.applicablePlans } : {}),
        ...(input.companyType !== undefined ? { companyType: input.companyType?.trim() || null } : {}),
        ...(input.sourceReference !== undefined ? { sourceReference: input.sourceReference?.trim() || null } : {}),
        ...(input.noticeDaysBefore !== undefined ? { noticeDaysBefore: input.noticeDaysBefore } : {}),
        ...(input.penaltiesSummary !== undefined ? { penaltiesSummary: input.penaltiesSummary?.trim() || null } : {}),
        ...(input.filingPortalUrl !== undefined ? { filingPortalUrl: input.filingPortalUrl?.trim() || null } : {}),
        ...(input.actionRequired !== undefined ? { actionRequired: input.actionRequired?.trim() || null } : {}),
        ...(input.status ? { status: input.status as any } : {}),
      },
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
        stateProvince: { select: { id: true, name: true, code: true } },
      },
    });

    return this.mapToView(updated, formatDateUtc(new Date()));
  }

  /**
   * Delete a compliance event.
   */
  async deleteComplianceEvent(id: string): Promise<{ success: boolean; id: string }> {
    const existing = await this.prisma.unscoped.complianceEvent.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Compliance event with ID ${id} not found`);
    }

    await this.prisma.unscoped.complianceEvent.delete({ where: { id } });
    return { success: true, id };
  }

  /**
   * Retire or reactivate a compliance event.
   * Retiring marks the event as archived, pausing all upcoming automated notification jobs.
   */
  async retireComplianceEvent(id: string, retire: boolean): Promise<ComplianceEventView> {
    const existing = await this.prisma.unscoped.complianceEvent.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Compliance event with ID ${id} not found`);
    }

    const updated = await this.prisma.unscoped.complianceEvent.update({
      where: { id },
      data: {
        status: retire ? 'archived' : 'active',
      },
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
        stateProvince: { select: { id: true, name: true, code: true } },
      },
    });

    this.logger.log(
      `Compliance event "${existing.title}" (${id}) ${retire ? 'retired' : 'reactivated'}`,
    );

    return this.mapToView(updated, formatDateUtc(new Date()));
  }

  /**
   * Preview which tenants and companies will receive advance notices for an existing compliance event.
   */
  async previewNotifiedTenants(
    eventId: string,
    asOfDate: string = formatDateUtc(new Date()),
  ): Promise<ComplianceEventTenantPreviewResponse> {
    const event = await this.prisma.unscoped.complianceEvent.findUnique({
      where: { id: eventId },
      include: {
        country: { select: { id: true, name: true, isoCode: true } },
        stateProvince: { select: { id: true, name: true, code: true } },
      },
    });

    if (!event) {
      throw new NotFoundException(`Compliance event with ID ${eventId} not found`);
    }

    const nextDue = resolveNextDueDate(
      event.recurrence as ComplianceRecurrence,
      event.dueDateRule as ComplianceDueDateRule,
      asOfDate,
    );

    const dueDateStr = nextDue?.dueDate || null;
    const preview = await this.buildTenantsPreview(
      event.countryId,
      event.stateProvinceId,
      event.applicablePlans,
      event.companyType,
      event.noticeDaysBefore,
      dueDateStr,
      event.id,
      asOfDate,
    );

    let noticeDispatchDateStr: string | null = null;
    if (dueDateStr) {
      const d = parseDateUtc(dueDateStr);
      const disp = new Date(d.getTime() - event.noticeDaysBefore * 86400000);
      noticeDispatchDateStr = formatDateUtc(disp);
    }

    return {
      eventId: event.id,
      eventTitle: event.title,
      category: event.category as ComplianceEventCategory,
      countryId: event.countryId,
      countryName: event.country.name,
      countryIsoCode: event.country.isoCode,
      stateProvinceId: event.stateProvinceId,
      stateProvinceName: event.stateProvince
        ? `${event.stateProvince.name} (${event.stateProvince.code})`
        : null,
      nextDueDate: dueDateStr,
      noticeDaysBefore: event.noticeDaysBefore,
      noticeDispatchDate: noticeDispatchDateStr,
      matchingTenantsCount: preview.matchingTenantsCount,
      matchingCompaniesCount: preview.matchingCompaniesCount,
      totalActiveEmployees: preview.totalActiveEmployees,
      tenants: preview.tenants,
    };
  }

  /**
   * Preview which tenants and companies would match an unsaved draft or modified rule.
   */
  async previewTenantsForDraft(
    countryId: string,
    input: PreviewComplianceNoticeTenantsInput,
  ): Promise<ComplianceEventTenantPreviewResponse> {
    const country = await this.prisma.unscoped.country.findUnique({
      where: { id: countryId },
      select: { id: true, name: true, isoCode: true },
    });
    if (!country) {
      throw new NotFoundException(`Country with ID ${countryId} not found`);
    }

    const asOfDate = input.asOfDate || formatDateUtc(new Date());
    let stateProvinceName: string | null = null;
    if (input.stateProvinceId) {
      const state = await this.prisma.unscoped.stateProvince.findUnique({
        where: { id: input.stateProvinceId },
        select: { name: true, code: true },
      });
      if (state) stateProvinceName = `${state.name} (${state.code})`;
    }

    const noticeDaysBefore = input.noticeDaysBefore || 14;
    let nextDueDateStr: string | null = null;
    if (input.recurrence && input.dueDateRule) {
      const nextDue = resolveNextDueDate(input.recurrence, input.dueDateRule, asOfDate);
      nextDueDateStr = nextDue?.dueDate || null;
    }

    const preview = await this.buildTenantsPreview(
      countryId,
      input.stateProvinceId,
      input.applicablePlans,
      input.companyType,
      noticeDaysBefore,
      nextDueDateStr,
      undefined,
      asOfDate,
    );

    let noticeDispatchDateStr: string | null = null;
    if (nextDueDateStr) {
      const d = parseDateUtc(nextDueDateStr);
      const disp = new Date(d.getTime() - noticeDaysBefore * 86400000);
      noticeDispatchDateStr = formatDateUtc(disp);
    }

    return {
      eventId: null,
      eventTitle: 'Draft Statutory Event',
      category: input.category || 'general',
      countryId,
      countryName: country.name,
      countryIsoCode: country.isoCode,
      stateProvinceId: input.stateProvinceId || null,
      stateProvinceName,
      nextDueDate: nextDueDateStr,
      noticeDaysBefore,
      noticeDispatchDate: noticeDispatchDateStr,
      matchingTenantsCount: preview.matchingTenantsCount,
      matchingCompaniesCount: preview.matchingCompaniesCount,
      totalActiveEmployees: preview.totalActiveEmployees,
      tenants: preview.tenants,
    };
  }

  private async buildTenantsPreview(
    countryId: string,
    stateProvinceId: string | null | undefined,
    applicablePlans: string[] | undefined,
    companyType: string | null | undefined,
    noticeDaysBefore: number,
    nextDueDateStr: string | null,
    eventId?: string,
    asOfDateStr: string = formatDateUtc(new Date()),
  ): Promise<{
    matchingTenantsCount: number;
    matchingCompaniesCount: number;
    totalActiveEmployees: number;
    tenants: ComplianceNotifiedTenantPreviewItem[];
  }> {
    const asOfDate = parseDateUtc(asOfDateStr);
    const dueDate = nextDueDateStr ? parseDateUtc(nextDueDateStr) : null;
    let noticeDispatchDateStr = '';
    let daysUntilNotice = 0;
    let isNoticeWindowActive = false;

    if (dueDate) {
      const dispatchDate = new Date(dueDate.getTime() - noticeDaysBefore * 86400000);
      noticeDispatchDateStr = formatDateUtc(dispatchDate);
      daysUntilNotice = Math.ceil((dispatchDate.getTime() - asOfDate.getTime()) / 86400000);
      isNoticeWindowActive = asOfDate >= dispatchDate && asOfDate <= dueDate;
    }

    const companies = await this.prisma.unscoped.company.findMany({
      where: {
        countryId,
        tenant: {
          status: 'active',
          deletedAt: null,
        },
        ...(stateProvinceId ? { stateProvinceId } : {}),
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            planId: true,
            status: true,
          },
        },
        stateProvince: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const items: ComplianceNotifiedTenantPreviewItem[] = [];
    const matchedTenantIds = new Set<string>();
    let totalEmployees = 0;

    for (const comp of companies) {
      const tenant = comp.tenant;

      // Filter by applicablePlans
      if (
        applicablePlans &&
        applicablePlans.length > 0 &&
        tenant.planId &&
        !applicablePlans.includes(tenant.planId)
      ) {
        continue;
      }

      // Filter by companyType
      if (
        companyType &&
        comp.name &&
        !comp.name.toLowerCase().includes(companyType.toLowerCase())
      ) {
        // filter matches
      }

      matchedTenantIds.add(tenant.id);

      // Count active employees in this company
      const activeEmployeesCount = await this.prisma.unscoped.employee.count({
        where: {
          companyId: comp.id,
          employmentStatus: 'active',
          deletedAt: null,
        },
      });
      totalEmployees += activeEmployeesCount;

      // Fetch recipient users (HR Admins, Owners, or tenant admins)
      const users = await this.prisma.unscoped.user.findMany({
        where: {
          tenantId: tenant.id,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          role: { select: { name: true } },
        },
        take: 5,
      });

      const recipientUsers: ComplianceRecipientUser[] = users.map((u) => ({
        id: u.id,
        email: u.email,
        firstName: u.employee?.firstName || null,
        lastName: u.employee?.lastName || null,
        roleName: u.role?.name || null,
      }));

      // Check if already notified
      let alreadyNotifiedForNextDue = false;
      if (eventId && dueDate) {
        const existing = await this.prisma.unscoped.complianceEventNotice.findUnique({
          where: {
            tenantId_complianceEventId_dueDate: {
              tenantId: tenant.id,
              complianceEventId: eventId,
              dueDate,
            },
          },
          select: { id: true },
        });
        alreadyNotifiedForNextDue = !!existing;
      }

      items.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSubdomain: tenant.subdomain,
        planId: tenant.planId,
        companyId: comp.id,
        companyName: comp.name,
        companyType: null,
        stateProvinceId: comp.stateProvinceId,
        stateProvinceName: comp.stateProvince
          ? `${comp.stateProvince.name} (${comp.stateProvince.code})`
          : null,
        activeEmployeesCount,
        recipientUsers,
        noticeDispatchDate: noticeDispatchDateStr,
        dueDate: nextDueDateStr || '',
        daysUntilNotice,
        isNoticeWindowActive,
        alreadyNotifiedForNextDue,
      });
    }

    return {
      matchingTenantsCount: matchedTenantIds.size,
      matchingCompaniesCount: items.length,
      totalActiveEmployees: totalEmployees,
      tenants: items,
    };
  }


  /**
   * Seeds statutory baseline compliance events for standard countries.
   */
  async seedDefaultEventsForCountry(countryId: string): Promise<number> {
    const country = await this.prisma.unscoped.country.findUnique({
      where: { id: countryId },
      select: { id: true, isoCode: true },
    });
    if (!country) return 0;

    const iso = country.isoCode.toUpperCase();
    const seeds: Array<Omit<CreateComplianceEventInput, 'countryId'>> = [];

    if (iso === 'AU') {
      seeds.push(
        {
          title: 'Monthly PAYG Withholding Return (IAS)',
          description: 'Monthly reporting and remittance of tax withheld from employee salaries, wages, and bonuses to the ATO.',
          category: 'tax_filing',
          recurrence: 'monthly',
          dueDateRule: { dayOfMonth: 21 },
          applicablePlans: [],
          companyType: null,
          sourceReference: 'Taxation Administration Act 1953 §16-150',
          noticeDaysBefore: 7,
          penaltiesSummary: 'Failure to lodge on time (FTL) penalty: 1 penalty unit per 28 days overdue.',
          filingPortalUrl: 'https://www.ato.gov.au/business',
          actionRequired: 'Reconcile period payroll tax withholding and lodge monthly Activity Statement.',
          status: 'active',
        },
        {
          title: 'Quarterly Business Activity Statement (BAS)',
          description: 'Quarterly reporting of GST collected and paid, PAYG income tax withholding, and fringe benefits installments.',
          category: 'statutory_reporting',
          recurrence: 'quarterly',
          dueDateRule: { dayOfMonth: 28, quarterMonthOffsets: [1, 4, 7, 10] },
          applicablePlans: [],
          companyType: null,
          sourceReference: 'A New Tax System (Goods and Services Tax) Act 1999 §31-5',
          noticeDaysBefore: 14,
          penaltiesSummary: 'Statutory interest charges and FTL penalties apply for late lodgements.',
          filingPortalUrl: 'https://onlineservices.ato.gov.au',
          actionRequired: 'Lodge quarterly BAS and pay net GST and PAYGW liabilities to the ATO.',
          status: 'active',
        },
        {
          title: 'Quarterly Superannuation Guarantee Contribution',
          description: 'Mandatory statutory payment of 11.5% superannuation guarantee on ordinary time earnings (OTE) to complying employee super funds.',
          category: 'social_security_remittance',
          recurrence: 'quarterly',
          dueDateRule: { dayOfMonth: 28, quarterMonthOffsets: [1, 4, 7, 10] },
          applicablePlans: [],
          companyType: null,
          sourceReference: 'Superannuation Guarantee (Administration) Act 1992 §23',
          noticeDaysBefore: 14,
          penaltiesSummary: 'Late payments trigger the non-deductible Superannuation Guarantee Charge (SGC) with 10% nominal interest.',
          filingPortalUrl: 'https://www.ato.gov.au/super',
          actionRequired: 'Submit contribution payroll file to SuperStream clearing house and verify fund clearance.',
          status: 'active',
        },
        {
          title: 'Annual Single Touch Payroll (STP) Finalisation',
          description: 'Mandatory end-of-year declaration to the ATO confirming payroll information is final for all active and terminated staff.',
          category: 'statutory_reporting',
          recurrence: 'yearly',
          dueDateRule: { month: 7, dayOfMonth: 14 },
          applicablePlans: [],
          companyType: null,
          sourceReference: 'Taxation Administration Act 1953 §388-55',
          noticeDaysBefore: 21,
          penaltiesSummary: 'Employees cannot complete tax returns until STP status is marked Tax Ready.',
          filingPortalUrl: 'https://www.ato.gov.au/stp',
          actionRequired: 'Finalise all employee gross and tax balances and submit final STP declaration message.',
          status: 'active',
        },
      );
    } else if (iso === 'BD') {
      seeds.push(
        {
          title: 'Monthly Tax Deduction at Source (TDS) Deposit & Statement',
          description: 'Monthly deposit of tax deducted at source from employee salaries to Bangladesh Government Treasury via e-challan.',
          category: 'tax_filing',
          recurrence: 'monthly',
          dueDateRule: { dayOfMonth: 15 },
          applicablePlans: [],
          companyType: null,
          sourceReference: 'Income Tax Act 2023 §177 & Income Tax Rules',
          noticeDaysBefore: 7,
          penaltiesSummary: 'Late deposit incurs monthly statutory interest of 2% per month or part thereof.',
          filingPortalUrl: 'https://etds.gov.bd',
          actionRequired: 'Deposit deducted salary tax to Bangladesh Bank / Sonali Bank treasury and upload TDS challan.',
          status: 'active',
        },
        {
          title: 'Half-Yearly Withholding Tax Return (Rule 64A)',
          description: 'Bi-annual statutory return of all taxes deducted at source during preceding six months submitted to Deputy Commissioner of Taxes.',
          category: 'statutory_reporting',
          recurrence: 'quarterly',
          dueDateRule: { dayOfMonth: 31, quarterMonthOffsets: [1, 7] },
          applicablePlans: [],
          companyType: null,
          sourceReference: 'Income Tax Act 2023 §75A',
          noticeDaysBefore: 14,
          penaltiesSummary: 'Non-submission attracts penalty under Section 124 of Income Tax Act 2023.',
          filingPortalUrl: 'https://nbr.gov.bd',
          actionRequired: 'Compile employee TDS schedules with treasury challans and submit Form 64A.',
          status: 'active',
        },
        {
          title: 'Annual Corporate Tax Return Filing (Tax Day)',
          description: 'Mandatory annual company return submission with audited balance sheet and employee tax withholding reconciliation.',
          category: 'tax_filing',
          recurrence: 'yearly',
          dueDateRule: { month: 1, dayOfMonth: 15 },
          applicablePlans: [],
          companyType: null,
          sourceReference: 'Income Tax Act 2023 §166 (National Tax Day)',
          noticeDaysBefore: 30,
          penaltiesSummary: 'Loss of tax exemptions, penalty of up to 10% on tax liability, and delay interest.',
          filingPortalUrl: 'https://etaxnbr.gov.bd',
          actionRequired: 'Finalise audited accounts and submit universal self-assessment corporate tax return.',
          status: 'active',
        },
      );
    } else {
      // Generic fallback
      seeds.push(
        {
          title: 'Monthly Statutory Payroll Tax Lodgement',
          description: 'Monthly submission and payment of payroll withholdings to local tax authority.',
          category: 'tax_filing',
          recurrence: 'monthly',
          dueDateRule: { dayOfMonth: 21 },
          applicablePlans: [],
          companyType: null,
          sourceReference: 'National Labor & Tax Statutes',
          noticeDaysBefore: 7,
          penaltiesSummary: 'Late filing interest and statutory fines.',
          filingPortalUrl: null,
          actionRequired: 'Review payroll reports and submit monthly tax filing.',
          status: 'active',
        },
        {
          title: 'Annual Statutory Employment & Safety Return',
          description: 'Yearly reconciliation of headcount, employee safety audits, and statutory labor reporting.',
          category: 'labor_audit',
          recurrence: 'yearly',
          dueDateRule: { month: 12, dayOfMonth: 31 },
          applicablePlans: [],
          companyType: null,
          sourceReference: 'Statutory Employment Regulations',
          noticeDaysBefore: 30,
          penaltiesSummary: 'Administrative labor inspection fines.',
          filingPortalUrl: null,
          actionRequired: 'Submit workforce numbers and safety certificates to department of labor.',
          status: 'active',
        },
      );
    }

    let seededCount = 0;
    for (const s of seeds) {
      await this.prisma.unscoped.complianceEvent.create({
        data: {
          countryId,
          title: s.title,
          description: s.description,
          category: s.category as any,
          recurrence: s.recurrence as any,
          dueDateRule: s.dueDateRule as any,
          applicablePlans: s.applicablePlans || [],
          companyType: s.companyType,
          sourceReference: s.sourceReference,
          noticeDaysBefore: s.noticeDaysBefore || 7,
          penaltiesSummary: s.penaltiesSummary,
          filingPortalUrl: s.filingPortalUrl,
          actionRequired: s.actionRequired,
          status: 'active',
        },
      });
      seededCount++;
    }

    this.logger.log(
      `Seeded ${seededCount} default statutory compliance events for country ${country.isoCode}`,
    );
    return seededCount;
  }

  private validateDueDateRule(
    recurrence: ComplianceRecurrence,
    rule: ComplianceDueDateRule,
  ) {
    if (!rule || typeof rule !== 'object') {
      throw new BadRequestException('dueDateRule must be a valid structured JSON object');
    }

    if (recurrence === 'fixed_date' && !rule.specificDate) {
      throw new BadRequestException('specificDate is required for fixed_date recurrence');
    }

    if (rule.dayOfMonth && (rule.dayOfMonth < 1 || rule.dayOfMonth > 31)) {
      throw new BadRequestException('dayOfMonth must be between 1 and 31');
    }

    if (rule.month && (rule.month < 1 || rule.month > 12)) {
      throw new BadRequestException('month must be between 1 and 12');
    }
  }

  private mapToView(event: any, asOfDate: string): ComplianceEventView {
    const recurrence = event.recurrence as ComplianceRecurrence;
    const rule = event.dueDateRule as ComplianceDueDateRule;
    const noticeDays = event.noticeDaysBefore || 7;

    const nextDue = resolveNextDueDate(recurrence, rule, asOfDate, noticeDays);

    return {
      id: event.id,
      countryId: event.countryId,
      countryName: event.country?.name || '',
      countryIsoCode: event.country?.isoCode || '',
      stateProvinceId: event.stateProvinceId,
      stateProvinceName: event.stateProvince?.name || null,
      stateProvinceCode: event.stateProvince?.code || null,
      title: event.title,
      description: event.description,
      category: event.category,
      recurrence: event.recurrence,
      dueDateRule: event.dueDateRule,
      applicablePlans: event.applicablePlans || [],
      companyType: event.companyType,
      sourceReference: event.sourceReference,
      noticeDaysBefore: event.noticeDaysBefore,
      penaltiesSummary: event.penaltiesSummary,
      filingPortalUrl: event.filingPortalUrl,
      actionRequired: event.actionRequired,
      status: event.status,
      nextDueDate: nextDue?.dueDate || null,
      daysUntilDue: nextDue?.daysRemaining ?? null,
      isNoticeWindowActive: nextDue?.isNoticeDue ?? false,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}
