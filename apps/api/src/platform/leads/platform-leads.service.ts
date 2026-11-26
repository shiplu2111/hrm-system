import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import type {
  LeadStatus as SharedLeadStatus,
  PlatformLeadActivityItem,
  PlatformLeadDetail,
  PlatformLeadItem,
  PlatformLeadRecordKind,
  PlatformLeadStaffOption,
  PlatformLeadsListQuery,
  PlatformLeadsListResponse,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformActorContext, PlatformAuditService } from '../audit/platform-audit.service';
import { UpdatePlatformLeadDto } from './dto/platform-leads.dto';

const ALLOWED_LEAD_ROLES = new Set(['Platform Owner', 'Platform Admin', 'Sales']);
const VALID_KINDS: readonly PlatformLeadRecordKind[] = ['lead', 'demo', 'contact'];
const STATUS_LIST: readonly SharedLeadStatus[] = ['new', 'contacted', 'qualified', 'closed'];

function sanitizeCsvCell(val: unknown): string {
  if (val === null || val === undefined) return '""';
  let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
  // Mitigate spreadsheet formula injection when exporting user-submitted lead fields
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function normalizeCommonRow(
  kind: PlatformLeadRecordKind,
  row: {
    id: string;
    name: string;
    workEmail: string;
    company: string | null;
    country: string | null;
    employeeCountBand: string | null;
    topic?: string | null;
    message: string | null;
    sourcePage: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmTerm: string | null;
    utmContent: string | null;
    referrer: string | null;
    privacyConsent: boolean;
    marketingConsent: boolean;
    consentAt: Date | null;
    status: LeadStatus;
    assigneeUserId: string | null;
    assigneeName: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
): PlatformLeadItem {
  return {
    id: row.id,
    kind,
    name: row.name,
    workEmail: row.workEmail,
    company: row.company,
    country: row.country,
    employeeCountBand: row.employeeCountBand,
    topic: row.topic ?? null,
    message: row.message,
    sourcePage: row.sourcePage,
    utmSource: row.utmSource,
    utmMedium: row.utmMedium,
    utmCampaign: row.utmCampaign,
    utmTerm: row.utmTerm,
    utmContent: row.utmContent,
    referrer: row.referrer,
    privacyConsent: row.privacyConsent,
    marketingConsent: row.marketingConsent,
    consentAt: row.consentAt ? row.consentAt.toISOString() : null,
    status: row.status as SharedLeadStatus,
    assigneeUserId: row.assigneeUserId,
    assigneeName: row.assigneeName,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class PlatformLeadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformAudit: PlatformAuditService,
  ) {}

  assertLeadAccess(actor?: PlatformActorContext | null): void {
    const role = actor?.roleName;
    if (!role || !ALLOWED_LEAD_ROLES.has(role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Access restricted to Platform Owner, Platform Admin, and Sales roles.',
      });
    }
  }

  private assertValidKind(kind: string): PlatformLeadRecordKind {
    if (!VALID_KINDS.includes(kind as PlatformLeadRecordKind)) {
      throw new BadRequestException({
        code: 'INVALID_LEAD_KIND',
        message: `Unsupported lead record kind "${kind}". Expected lead, demo, or contact.`,
      });
    }
    return kind as PlatformLeadRecordKind;
  }

  private buildBaseWhere(
    query: PlatformLeadsListQuery,
    options: { includeStatus?: boolean } = { includeStatus: true },
  ): Record<string, any> {
    const where: Record<string, any> = {};

    if (options.includeStatus && query.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (query.country && query.country !== 'all') {
      where.country = { equals: query.country.trim(), mode: 'insensitive' };
    }

    if (query.source && query.source !== 'all') {
      const src = query.source.trim();
      where.OR = [
        ...(where.OR ?? []),
        { sourcePage: { equals: src, mode: 'insensitive' } },
        { utmSource: { equals: src, mode: 'insensitive' } },
      ];
    }

    if (query.assigneeUserId && query.assigneeUserId !== 'all') {
      where.assigneeUserId = query.assigneeUserId === 'unassigned' ? null : query.assigneeUserId;
    }

    if (query.from || query.to) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.from) {
        const fromDate = new Date(query.from);
        if (!Number.isNaN(fromDate.getTime())) {
          createdAt.gte = fromDate;
        }
      }
      if (query.to) {
        const toDate = new Date(query.to);
        if (!Number.isNaN(toDate.getTime())) {
          // Include entire end date when passed as YYYY-MM-DD
          if (/^\d{4}-\d{2}-\d{2}$/.test(query.to.trim())) {
            toDate.setUTCHours(23, 59, 59, 999);
          }
          createdAt.lte = toDate;
        }
      }
      if (Object.keys(createdAt).length > 0) {
        where.createdAt = createdAt;
      }
    }

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      const searchOr = [
        { name: { contains: term, mode: 'insensitive' } },
        { workEmail: { contains: term, mode: 'insensitive' } },
        { company: { contains: term, mode: 'insensitive' } },
        { message: { contains: term, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOr }];
        delete where.OR;
      } else {
        where.OR = searchOr;
      }
    }

    return where;
  }

  private async fetchMatchingNormalized(
    query: PlatformLeadsListQuery,
    options: { includeStatus?: boolean } = { includeStatus: true },
  ): Promise<PlatformLeadItem[]> {
    const where = this.buildBaseWhere(query, options);
    const kind = query.kind ?? 'leads_and_contacts';

    if (kind === 'demo') {
      const rows = await this.prisma.unscoped.demoRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row) => normalizeCommonRow('demo', row));
    }

    if (kind === 'lead') {
      const rows = await this.prisma.unscoped.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row) => normalizeCommonRow('lead', row));
    }

    if (kind === 'contact') {
      const rows = await this.prisma.unscoped.contactMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return rows.map((row) => normalizeCommonRow('contact', row));
    }

    // Default Leads workspace aggregates marketing/sales leads + contact_messages
    const [leadRows, contactRows] = await Promise.all([
      this.prisma.unscoped.lead.findMany({ where, orderBy: { createdAt: 'desc' } }),
      this.prisma.unscoped.contactMessage.findMany({ where, orderBy: { createdAt: 'desc' } }),
    ]);

    return [
      ...leadRows.map((row) => normalizeCommonRow('lead', row)),
      ...contactRows.map((row) => normalizeCommonRow('contact', row)),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  private async getFilterOptions(kind: PlatformLeadsListQuery['kind']): Promise<{
    countries: string[];
    sources: string[];
  }> {
    const collectFromRows = async (): Promise<
      Array<{ country: string | null; sourcePage: string | null; utmSource: string | null }>
    > => {
      if (kind === 'demo') {
        return this.prisma.unscoped.demoRequest.findMany({
          select: { country: true, sourcePage: true, utmSource: true },
        });
      }
      if (kind === 'lead') {
        return this.prisma.unscoped.lead.findMany({
          select: { country: true, sourcePage: true, utmSource: true },
        });
      }
      if (kind === 'contact') {
        return this.prisma.unscoped.contactMessage.findMany({
          select: { country: true, sourcePage: true, utmSource: true },
        });
      }
      const [l, c] = await Promise.all([
        this.prisma.unscoped.lead.findMany({
          select: { country: true, sourcePage: true, utmSource: true },
        }),
        this.prisma.unscoped.contactMessage.findMany({
          select: { country: true, sourcePage: true, utmSource: true },
        }),
      ]);
      return [...l, ...c];
    };

    const rows = await collectFromRows();
    const countrySet = new Set<string>();
    const sourceSet = new Set<string>();

    for (const r of rows) {
      if (r.country?.trim()) countrySet.add(r.country.trim().toUpperCase());
      if (r.sourcePage?.trim()) sourceSet.add(r.sourcePage.trim());
      if (r.utmSource?.trim()) sourceSet.add(r.utmSource.trim());
    }

    return {
      countries: Array.from(countrySet).sort(),
      sources: Array.from(sourceSet).sort(),
    };
  }

  private async getAssignableStaff(): Promise<PlatformLeadStaffOption[]> {
    const users = await this.prisma.unscoped.platformUser.findMany({
      where: {
        isActive: true,
        role: {
          name: { in: Array.from(ALLOWED_LEAD_ROLES) },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: { select: { name: true } },
      },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      roleName: u.role.name,
    }));
  }

  async list(
    query: PlatformLeadsListQuery,
    actor?: PlatformActorContext | null,
  ): Promise<PlatformLeadsListResponse> {
    this.assertLeadAccess(actor);

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const kind = query.kind ?? 'leads_and_contacts';

    const [allMatchingWithStatus, allMatchingForCounts, filterOptions, staff] = await Promise.all([
      this.fetchMatchingNormalized({ ...query, kind }, { includeStatus: true }),
      this.fetchMatchingNormalized({ ...query, kind }, { includeStatus: false }),
      this.getFilterOptions(kind),
      this.getAssignableStaff(),
    ]);

    const countsByStatus: Record<SharedLeadStatus, number> = {
      new: 0,
      contacted: 0,
      qualified: 0,
      closed: 0,
    };
    for (const item of allMatchingForCounts) {
      countsByStatus[item.status] = (countsByStatus[item.status] ?? 0) + 1;
    }

    const total = allMatchingWithStatus.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    return {
      items: allMatchingWithStatus.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages,
      filters: {
        countries: filterOptions.countries,
        sources: filterOptions.sources,
        statuses: [...STATUS_LIST],
      },
      staff,
      countsByStatus,
    };
  }

  async getDetail(
    rawKind: string,
    id: string,
    actor?: PlatformActorContext | null,
  ): Promise<PlatformLeadDetail> {
    this.assertLeadAccess(actor);
    const kind = this.assertValidKind(rawKind);

    let item: PlatformLeadItem | null = null;
    if (kind === 'lead') {
      const row = await this.prisma.unscoped.lead.findUnique({ where: { id } });
      if (row) item = normalizeCommonRow('lead', row);
    } else if (kind === 'demo') {
      const row = await this.prisma.unscoped.demoRequest.findUnique({ where: { id } });
      if (row) item = normalizeCommonRow('demo', row);
    } else {
      const row = await this.prisma.unscoped.contactMessage.findUnique({ where: { id } });
      if (row) item = normalizeCommonRow('contact', row);
    }

    if (!item) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: `Lead record ${id} was not found.`,
      });
    }

    const logs = await this.prisma.unscoped.platformAuditLog.findMany({
      where: {
        module: 'leads',
        recordId: id,
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const activity: PlatformLeadActivityItem[] = logs.map((log) => ({
      id: log.id,
      action: log.action,
      userId: log.userId,
      actorEmail: log.user?.email ?? null,
      actorName: log.user ? `${log.user.firstName} ${log.user.lastName}`.trim() : null,
      reason: log.reason,
      oldValue: (log.oldValue as Record<string, unknown> | null) ?? null,
      newValue: (log.newValue as Record<string, unknown> | null) ?? null,
      createdAt: log.createdAt.toISOString(),
    }));

    return {
      ...item,
      activity,
    };
  }

  async update(
    rawKind: string,
    id: string,
    dto: UpdatePlatformLeadDto,
    actor: PlatformActorContext,
  ): Promise<PlatformLeadDetail> {
    this.assertLeadAccess(actor);
    const kind = this.assertValidKind(rawKind);

    const existingDetail = await this.getDetail(kind, id, actor);

    const updateData: Record<string, any> = {};

    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }

    if (dto.assigneeUserId !== undefined) {
      const targetUserId = dto.assigneeUserId?.trim() || null;
      if (!targetUserId) {
        updateData.assigneeUserId = null;
        updateData.assigneeName = null;
      } else {
        const assignee = await this.prisma.unscoped.platformUser.findUnique({
          where: { id: targetUserId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            isActive: true,
            role: { select: { name: true } },
          },
        });
        if (!assignee || !assignee.isActive || !ALLOWED_LEAD_ROLES.has(assignee.role.name)) {
          throw new BadRequestException({
            code: 'INVALID_ASSIGNEE',
            message: 'Selected staff member is inactive or lacks Sales/Platform access.',
          });
        }
        updateData.assigneeUserId = assignee.id;
        updateData.assigneeName = `${assignee.firstName} ${assignee.lastName}`.trim();
      }
    }

    if (dto.notes !== undefined) {
      updateData.notes = dto.notes.trim() || null;
    } else if (dto.noteAppend && dto.noteAppend.trim()) {
      const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      const author = actor.email ?? actor.roleName ?? 'Staff';
      const entry = `[${stamp} · ${author}] ${dto.noteAppend.trim()}`;
      updateData.notes = existingDetail.notes ? `${entry}\n\n${existingDetail.notes}` : entry;
    }

    if (Object.keys(updateData).length === 0) {
      return existingDetail;
    }

    if (kind === 'lead') {
      await this.prisma.unscoped.lead.update({ where: { id }, data: updateData });
    } else if (kind === 'demo') {
      await this.prisma.unscoped.demoRequest.update({ where: { id }, data: updateData });
    } else {
      await this.prisma.unscoped.contactMessage.update({ where: { id }, data: updateData });
    }

    const statusChanged =
      dto.status !== undefined && dto.status !== (existingDetail.status as LeadStatus);
    const assigneeChanged =
      dto.assigneeUserId !== undefined &&
      (updateData.assigneeUserId ?? null) !== existingDetail.assigneeUserId;

    const action = statusChanged
      ? 'lead.status_changed'
      : assigneeChanged
        ? 'lead.assigned'
        : 'lead.note_updated';

    await this.platformAudit.log({
      userId: actor.id ?? null,
      action,
      module: 'leads',
      recordId: id,
      reason:
        dto.reason?.trim() ||
        (statusChanged
          ? `Changed ${kind} status from ${existingDetail.status} to ${dto.status}`
          : assigneeChanged
            ? `Assigned ${kind} to ${updateData.assigneeName ?? 'Unassigned'}`
            : `Updated internal notes on ${kind}`),
      oldValue: {
        kind,
        status: existingDetail.status,
        assigneeUserId: existingDetail.assigneeUserId,
        assigneeName: existingDetail.assigneeName,
        notes: existingDetail.notes,
      },
      newValue: {
        kind,
        status: updateData.status ?? existingDetail.status,
        assigneeUserId:
          updateData.assigneeUserId !== undefined
            ? updateData.assigneeUserId
            : existingDetail.assigneeUserId,
        assigneeName:
          updateData.assigneeName !== undefined
            ? updateData.assigneeName
            : existingDetail.assigneeName,
        notes: updateData.notes !== undefined ? updateData.notes : existingDetail.notes,
      },
    });

    return this.getDetail(kind, id, actor);
  }

  async exportCsv(
    query: PlatformLeadsListQuery,
    actor?: PlatformActorContext | null,
  ): Promise<{ filename: string; content: string }> {
    this.assertLeadAccess(actor);

    const rows = (await this.fetchMatchingNormalized(query, { includeStatus: true })).slice(0, 5000);
    const headers = [
      'ID',
      'Kind',
      'Name',
      'Work Email',
      'Company',
      'Country',
      'Employee Count Band',
      'Topic',
      'Status',
      'Assignee',
      'Source Page',
      'UTM Source',
      'UTM Medium',
      'UTM Campaign',
      'Marketing Consent',
      'Created At',
      'Notes',
      'Message',
    ];

    const lines = [
      headers.map(sanitizeCsvCell).join(','),
      ...rows.map((r) =>
        [
          r.id,
          r.kind,
          r.name,
          r.workEmail,
          r.company ?? '',
          r.country ?? '',
          r.employeeCountBand ?? '',
          r.topic ?? '',
          r.status,
          r.assigneeName ?? 'Unassigned',
          r.sourcePage ?? '',
          r.utmSource ?? '',
          r.utmMedium ?? '',
          r.utmCampaign ?? '',
          r.marketingConsent ? 'Yes' : 'No',
          r.createdAt,
          r.notes ?? '',
          r.message ?? '',
        ]
          .map(sanitizeCsvCell)
          .join(','),
      ),
    ];

    const dateTag = new Date().toISOString().slice(0, 10);
    const prefix = query.kind === 'demo' ? 'demo-requests' : 'leads';

    return {
      filename: `cmsn-${prefix}-${dateTag}.csv`,
      content: lines.join('\r\n'),
    };
  }
}
