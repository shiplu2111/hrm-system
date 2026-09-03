import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { LeaveTypeRecord } from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import type { CreateLeaveTypeDto, UpdateLeaveTypeDto } from './dto/leave.dto';

@Injectable()
export class LeaveTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
  ) {}

  async list(companyId: string): Promise<LeaveTypeRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    const rows = await this.prisma.unscoped.leaveType.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async create(companyId: string, dto: CreateLeaveTypeDto): Promise<LeaveTypeRecord> {
    await this.companyScope.assertCompanyInTenant(companyId);
    try {
      const row = await this.prisma.unscoped.leaveType.create({
        data: {
          companyId,
          name: dto.name.trim(),
          isPaid: dto.isPaid ?? true,
        },
      });
      return this.toRecord(row);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'CONFLICT',
          message: 'Leave type with this name already exists',
        });
      }
      throw error;
    }
  }

  async update(
    companyId: string,
    leaveTypeId: string,
    dto: UpdateLeaveTypeDto,
  ): Promise<LeaveTypeRecord> {
    await this.findOrThrow(companyId, leaveTypeId);
    const row = await this.prisma.unscoped.leaveType.update({
      where: { id: leaveTypeId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.isPaid !== undefined ? { isPaid: dto.isPaid } : {}),
      },
    });
    return this.toRecord(row);
  }

  async remove(companyId: string, leaveTypeId: string): Promise<void> {
    await this.findOrThrow(companyId, leaveTypeId);
    const [policyCount, requestCount] = await Promise.all([
      this.prisma.unscoped.leavePolicy.count({ where: { leaveTypeId } }),
      this.prisma.unscoped.leaveRequest.count({ where: { leaveTypeId } }),
    ]);
    if (policyCount > 0 || requestCount > 0) {
      throw new ConflictException({
        code: 'CONFLICT',
        message: 'Leave type is in use and cannot be deleted',
      });
    }
    await this.prisma.unscoped.leaveType.delete({ where: { id: leaveTypeId } });
  }

  private async findOrThrow(companyId: string, leaveTypeId: string) {
    await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.unscoped.leaveType.findFirst({
      where: { id: leaveTypeId, companyId },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Leave type not found',
      });
    }
    return row;
  }

  private toRecord(row: {
    id: string;
    companyId: string;
    name: string;
    isPaid: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): LeaveTypeRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      isPaid: row.isPaid,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
