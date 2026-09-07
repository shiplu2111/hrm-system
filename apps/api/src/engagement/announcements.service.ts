import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CompanyAnnouncement, Prisma } from '@prisma/client';
import type {
  CompanyAnnouncementRecord,
  CompanyAnnouncementStatus,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type {
  CreateAnnouncementDto,
  ListAnnouncementsQueryDto,
  UpdateAnnouncementDto,
} from './dto/engagement.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async listForAdmin(
    companyId: string,
    query: ListAnnouncementsQueryDto,
  ): Promise<CompanyAnnouncementRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const rows = await this.prisma.unscoped.companyAnnouncement.findMany({
      where: {
        companyId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => this.toRecord(row));
  }

  async listPublishedForCompany(companyId: string): Promise<CompanyAnnouncementRecord[]> {
    const now = new Date();
    const rows = await this.prisma.unscoped.companyAnnouncement.findMany({
      where: {
        companyId,
        status: 'published',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }],
      take: 10,
    });

    return rows.map((row) => this.toRecord(row));
  }

  async create(
    companyId: string,
    dto: CreateAnnouncementDto,
    user: AuthenticatedUser,
  ): Promise<CompanyAnnouncementRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);

    const row = await this.prisma.unscoped.companyAnnouncement.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        title: dto.title.trim(),
        body: dto.body.trim(),
        isPinned: dto.isPinned ?? false,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdByUserId: user.id,
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'engagement',
      recordId: row.id,
      newValue: { title: row.title, status: row.status },
    });

    return this.toRecord(row);
  }

  async update(
    announcementId: string,
    dto: UpdateAnnouncementDto,
    user: AuthenticatedUser,
  ): Promise<CompanyAnnouncementRecord> {
    const existing = await this.getOrThrow(announcementId);

    const row = await this.prisma.unscoped.companyAnnouncement.update({
      where: { id: announcementId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.body !== undefined ? { body: dto.body.trim() } : {}),
        ...(dto.isPinned !== undefined ? { isPinned: dto.isPinned } : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'engagement',
      recordId: announcementId,
      oldValue: { status: existing.status, title: existing.title },
      newValue: { ...dto },
    });

    return this.toRecord(row);
  }

  async publish(
    announcementId: string,
    user: AuthenticatedUser,
  ): Promise<CompanyAnnouncementRecord> {
    const existing = await this.getOrThrow(announcementId);

    const row = await this.prisma.unscoped.companyAnnouncement.update({
      where: { id: announcementId },
      data: {
        status: 'published',
        publishedAt: new Date(),
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'engagement',
      recordId: announcementId,
      oldValue: { status: existing.status },
      newValue: { status: 'published', publishedAt: row.publishedAt?.toISOString() },
    });

    return this.toRecord(row);
  }

  private async getOrThrow(announcementId: string): Promise<CompanyAnnouncement> {
    const row = await this.prisma.unscoped.companyAnnouncement.findUnique({
      where: { id: announcementId },
    });
    if (!row) throw new NotFoundException('Announcement not found');
    return row;
  }

  private toRecord(row: CompanyAnnouncement): CompanyAnnouncementRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      title: row.title,
      body: row.body,
      status: row.status as CompanyAnnouncementStatus,
      isPinned: row.isPinned,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
