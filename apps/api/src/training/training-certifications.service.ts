import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { EmployeeCertification } from '@prisma/client';
import type {
  EmployeeCertificationRecord,
  EmployeeCertificationStatus,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { formatDateValue } from '../contracts/employment-contract.utils';
import type {
  CreateEmployeeCertificationDto,
  ListCertificationsQueryDto,
  UpdateEmployeeCertificationDto,
} from './dto/training.dto';
import { TrainingService } from './training.service';
import {
  CERTIFICATION_EXPIRY_WARNING_DAYS,
  daysUntilExpiry,
  resolveCertificationStatus,
  startOfUtcDay,
} from './training.utils';

type CertificationWithRelations = EmployeeCertification & {
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    department: { name: string } | null;
  };
  course: { title: string } | null;
};

@Injectable()
export class TrainingCertificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly trainingService: TrainingService,
  ) {}

  async listCertifications(
    companyId: string,
    query: ListCertificationsQueryDto,
  ): Promise<EmployeeCertificationRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);

    const today = startOfUtcDay(new Date());
    const windowEnd = new Date(today);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + CERTIFICATION_EXPIRY_WARNING_DAYS);

    const rows = await this.prisma.unscoped.employeeCertification.findMany({
      where: {
        companyId,
        employeeId: query.employeeId,
        status: query.status,
        ...(query.expiringOnly
          ? {
              status: 'active',
              expiryDate: { gte: today, lte: windowEnd },
            }
          : {}),
      },
      include: this.certificationInclude(),
      orderBy: [{ expiryDate: 'asc' }, { name: 'asc' }],
    });

    return rows.map((row) => this.toCertificationRecord(row as CertificationWithRelations));
  }

  async createCertification(
    companyId: string,
    dto: CreateEmployeeCertificationDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeCertificationRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    await this.assertEmployeeInCompany(dto.employeeId, companyId);

    if (dto.courseId) {
      const course = await this.trainingService.getCourseOrThrow(dto.courseId);
      if (course.companyId !== companyId) {
        throw new NotFoundException('Training course not found');
      }
    }

    const expiryDate = dto.expiryDate ? this.parseDate(dto.expiryDate) : null;
    const status =
      dto.status ??
      resolveCertificationStatus({
        storedStatus: 'active',
        expiryDate,
      });

    const row = await this.prisma.unscoped.employeeCertification.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        employeeId: dto.employeeId,
        courseId: dto.courseId,
        name: dto.name.trim(),
        issuer: dto.issuer?.trim() || null,
        certificateNumber: dto.certificateNumber?.trim() || null,
        issuedAt: dto.issuedAt ? this.parseDate(dto.issuedAt) : null,
        expiryDate,
        status,
        notes: dto.notes?.trim() || null,
      },
      include: this.certificationInclude(),
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'training',
      recordId: row.id,
      newValue: { ...dto },
    });

    return this.toCertificationRecord(row as CertificationWithRelations);
  }

  async updateCertification(
    certificationId: string,
    dto: UpdateEmployeeCertificationDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeCertificationRecord> {
    const existing = await this.getCertificationOrThrow(certificationId);

    if (dto.courseId) {
      const course = await this.trainingService.getCourseOrThrow(dto.courseId);
      if (course.companyId !== existing.companyId) {
        throw new NotFoundException('Training course not found');
      }
    }

    const expiryDate =
      dto.expiryDate !== undefined
        ? dto.expiryDate
          ? this.parseDate(dto.expiryDate)
          : null
        : existing.expiryDate;

    const storedStatus = dto.status ?? existing.status;
    const status = resolveCertificationStatus({
      storedStatus: storedStatus as EmployeeCertificationStatus,
      expiryDate,
    });

    const row = await this.prisma.unscoped.employeeCertification.update({
      where: { id: certificationId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.courseId !== undefined ? { courseId: dto.courseId } : {}),
        ...(dto.issuer !== undefined ? { issuer: dto.issuer?.trim() || null } : {}),
        ...(dto.certificateNumber !== undefined
          ? { certificateNumber: dto.certificateNumber?.trim() || null }
          : {}),
        ...(dto.issuedAt !== undefined
          ? { issuedAt: dto.issuedAt ? this.parseDate(dto.issuedAt) : null }
          : {}),
        ...(dto.expiryDate !== undefined ? { expiryDate } : {}),
        status,
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.expiryDate !== undefined || dto.status !== undefined
          ? { expiryAlertSentAt: null }
          : {}),
      },
      include: this.certificationInclude(),
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: certificationId,
      newValue: { ...dto },
    });

    return this.toCertificationRecord(row as CertificationWithRelations);
  }

  async deleteCertification(
    certificationId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const existing = await this.getCertificationOrThrow(certificationId);

    await this.prisma.unscoped.employeeCertification.delete({
      where: { id: certificationId },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'training',
      recordId: certificationId,
    });
  }

  async getCertificationOrThrow(certificationId: string): Promise<EmployeeCertification> {
    const row = await this.prisma.unscoped.employeeCertification.findUnique({
      where: { id: certificationId },
    });
    if (!row) {
      throw new NotFoundException('Employee certification not found');
    }
    return row;
  }

  private certificationInclude() {
    return {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
          department: { select: { name: true } },
        },
      },
      course: { select: { title: true } },
    };
  }

  private async assertEmployeeInCompany(
    employeeId: string,
    companyId: string,
  ): Promise<void> {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
  }

  private parseDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      throw new ConflictException(`Invalid date "${value}", expected YYYY-MM-DD`);
    }
    return new Date(Date.UTC(year, month - 1, day));
  }

  private toCertificationRecord(
    row: CertificationWithRelations,
  ): EmployeeCertificationRecord {
    const asOf = new Date();
    const status = resolveCertificationStatus({
      storedStatus: row.status as EmployeeCertificationStatus,
      expiryDate: row.expiryDate,
      asOf,
    });

    return {
      id: row.id,
      companyId: row.companyId,
      employeeId: row.employeeId,
      employeeName: `${row.employee.firstName} ${row.employee.lastName}`.trim(),
      employeeNumber: row.employee.employeeNumber,
      departmentName: row.employee.department?.name ?? null,
      courseId: row.courseId,
      courseTitle: row.course?.title ?? null,
      name: row.name,
      issuer: row.issuer,
      certificateNumber: row.certificateNumber,
      issuedAt: row.issuedAt ? formatDateValue(row.issuedAt) : null,
      expiryDate: row.expiryDate ? formatDateValue(row.expiryDate) : null,
      status,
      daysUntilExpiry: row.expiryDate ? daysUntilExpiry(asOf, row.expiryDate) : null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
