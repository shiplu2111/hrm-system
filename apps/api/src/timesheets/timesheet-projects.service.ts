import { Injectable, NotFoundException } from '@nestjs/common';
import type { TimesheetProjectRecord } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type { CreateTimesheetProjectDto } from './dto/timesheet.dto';

@Injectable()
export class TimesheetProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  async list(companyId: string): Promise<TimesheetProjectRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.timesheetProject.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async create(
    companyId: string,
    dto: CreateTimesheetProjectDto,
  ): Promise<TimesheetProjectRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.unscoped.timesheetProject.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        name: dto.name.trim(),
        code: dto.code?.trim() ?? null,
        isActive: dto.isActive ?? true,
      },
    });
    return this.toRecord(row);
  }

  async findOrThrow(projectId: string) {
    const row = await this.prisma.unscoped.timesheetProject.findUnique({
      where: { id: projectId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Timesheet project not found',
      });
    }
    return row;
  }

  private toRecord(row: {
    id: string;
    tenantId: string;
    companyId: string;
    name: string;
    code: string | null;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): TimesheetProjectRecord {
    return {
      id: row.id,
      tenantId: row.tenantId,
      companyId: row.companyId,
      name: row.name,
      code: row.code,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
