import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { EmployeeCertification, Prisma } from '@prisma/client';
import type { EmployeeCertificationRecord, EmployeeCertificationStatus } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { DataScopeService } from '../rbac/data-scope.service';
import { formatDateValue } from '../contracts/employment-contract.utils';
import { assertValidDocumentUpload } from '../storage/document-file.policy';
import { StorageService } from '../storage/storage.service';
import type {
  CreateEmployeeCertificationDto,
  ListCertificationsQueryDto,
  UpdateEmployeeCertificationDto,
} from './dto/training.dto';
import { TrainingService } from './training.service';
import {
  assertCertificationDates,
  certificationExpiryState,
  normalizeCertificationName,
  parseDateOnly,
  signedDaysUntil,
  supersededBy,
} from './certification.rules';
import { startOfUtcDay } from './training.utils';

const CERTIFICATION_INCLUDE = {
  employee: {
    select: {
      firstName: true,
      lastName: true,
      employeeNumber: true,
      department: { select: { name: true } },
    },
  },
  course: { select: { title: true } },
} satisfies Prisma.EmployeeCertificationInclude;

type CertificationWithRelations = Prisma.EmployeeCertificationGetPayload<{
  include: typeof CERTIFICATION_INCLUDE;
}>;

function notFound(): never {
  throw new NotFoundException({ code: 'NOT_FOUND', message: 'Certification not found' });
}

function trimOrNull(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

@Injectable()
export class TrainingCertificationsService {
  private readonly logger = new Logger(TrainingCertificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly trainingService: TrainingService,
    private readonly dataScope: DataScopeService,
    private readonly storageService: StorageService,
  ) {}

  async listCertifications(
    companyId: string,
    query: ListCertificationsQueryDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeCertificationRecord[]> {
    await this.companyScope.assertCompanyInTenant(companyId);
    if (query.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, query.employeeId);
    }

    const rows = await this.prisma.unscoped.employeeCertification.findMany({
      where: {
        companyId,
        employeeId: query.employeeId ?? (await this.dataScope.employeeIdFilter(user)),
      },
      include: CERTIFICATION_INCLUDE,
      orderBy: [{ expiryDate: 'asc' }, { name: 'asc' }],
    });

    return this.toRecords(rows).filter(
      (row) =>
        (!query.status || row.status === query.status) &&
        (!query.expiryState || row.expiryState === query.expiryState) &&
        (!query.expiringOnly || (row.expiryState === 'expiring_soon' && !row.supersededById)) &&
        (!query.currentOnly || !row.supersededById),
    );
  }

  async createCertification(
    companyId: string,
    dto: CreateEmployeeCertificationDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeCertificationRecord> {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    await this.assertEmployeeCanHoldCertificates(dto.employeeId, companyId);
    await this.dataScope.assertEmployeeInScope(user, dto.employeeId);
    if (dto.courseId) await this.assertCourseInCompany(dto.courseId, company.tenantId, companyId);

    const name = dto.name.trim().replace(/\s+/g, ' ');
    const issuedAt = dto.issuedAt ? parseDateOnly(dto.issuedAt, 'issuedAt') : null;
    const expiryDate = dto.expiryDate ? parseDateOnly(dto.expiryDate, 'expiryDate') : null;
    assertCertificationDates(issuedAt, expiryDate, new Date());
    const certificateNumber = trimOrNull(dto.certificateNumber);
    await this.assertNotDuplicate({ employeeId: dto.employeeId, name, certificateNumber, issuedAt, expiryDate });

    const row = await this.prisma.unscoped.employeeCertification.create({
      data: {
        tenantId: company.tenantId,
        companyId,
        employeeId: dto.employeeId,
        courseId: dto.courseId ?? null,
        name,
        issuer: trimOrNull(dto.issuer),
        certificateNumber,
        issuedAt,
        expiryDate,
        status: 'active',
        notes: trimOrNull(dto.notes),
      },
    });

    await this.auditService.log({
      tenantId: company.tenantId,
      userId: user.id,
      action: 'create',
      module: 'training',
      recordId: row.id,
      newValue: { entity: 'certification', ...dto },
    });

    return this.recordFor(row.id, row.employeeId);
  }

  async updateCertification(
    certificationId: string,
    dto: UpdateEmployeeCertificationDto,
    user: AuthenticatedUser,
  ): Promise<EmployeeCertificationRecord> {
    const existing = await this.getCertificationOrThrow(certificationId, user.tenantId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId);
    if (dto.courseId) await this.assertCourseInCompany(dto.courseId, existing.tenantId, existing.companyId);

    const revoking = dto.status === 'revoked' && existing.status !== 'revoked';
    if (dto.revocationReason && dto.status !== 'revoked') {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'A revocation reason is only used when revoking',
      });
    }
    if (revoking && !dto.revocationReason?.trim()) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Give a reason for revoking' });
    }

    const name = dto.name !== undefined ? dto.name.trim().replace(/\s+/g, ' ') : existing.name;
    const issuedAt =
      dto.issuedAt === undefined ? existing.issuedAt : dto.issuedAt ? parseDateOnly(dto.issuedAt, 'issuedAt') : null;
    const expiryDate =
      dto.expiryDate === undefined
        ? existing.expiryDate
        : dto.expiryDate
          ? parseDateOnly(dto.expiryDate, 'expiryDate')
          : null;
    const certificateNumber =
      dto.certificateNumber === undefined ? existing.certificateNumber : trimOrNull(dto.certificateNumber);
    const datesChanged = dto.issuedAt !== undefined || dto.expiryDate !== undefined;
    if (datesChanged) assertCertificationDates(issuedAt, expiryDate, new Date());
    if (dto.name !== undefined || dto.certificateNumber !== undefined || datesChanged) {
      await this.assertNotDuplicate({
        employeeId: existing.employeeId,
        name,
        certificateNumber,
        issuedAt,
        expiryDate,
        excludeId: existing.id,
      });
    }

    let notes = dto.notes === undefined ? existing.notes : trimOrNull(dto.notes);
    if (revoking) {
      const line = `Revoked ${formatDateValue(startOfUtcDay(new Date()))}: ${dto.revocationReason!.trim()}`;
      notes = notes ? `${notes}\n${line}` : line;
    }

    // `expired` is derived from the date; only `revoked` needs storing.
    const status: EmployeeCertificationStatus =
      dto.status ?? (existing.status === 'revoked' ? 'revoked' : 'active');
    const expiryChanged =
      dto.expiryDate !== undefined && expiryDate?.getTime() !== existing.expiryDate?.getTime();

    await this.prisma.unscoped.employeeCertification.update({
      where: { id: certificationId },
      data: {
        name,
        ...(dto.courseId !== undefined ? { courseId: dto.courseId } : {}),
        ...(dto.issuer !== undefined ? { issuer: trimOrNull(dto.issuer) } : {}),
        certificateNumber,
        issuedAt,
        expiryDate,
        status,
        notes,
        ...(expiryChanged || status !== existing.status ? { expiryAlertSentAt: null } : {}),
      },
    });

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: certificationId,
      oldValue: {
        name: existing.name,
        issuedAt: existing.issuedAt ? formatDateValue(existing.issuedAt) : null,
        expiryDate: existing.expiryDate ? formatDateValue(existing.expiryDate) : null,
        status: existing.status,
      },
      newValue: { entity: 'certification', ...dto },
    });

    return this.recordFor(certificationId, existing.employeeId);
  }

  async deleteCertification(certificationId: string, user: AuthenticatedUser): Promise<void> {
    const existing = await this.getCertificationOrThrow(certificationId, user.tenantId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId);

    await this.prisma.unscoped.employeeCertification.delete({ where: { id: certificationId } });
    if (existing.fileKey) await this.discardFile(existing.fileKey);

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'training',
      recordId: certificationId,
      oldValue: {
        entity: 'certification',
        employeeId: existing.employeeId,
        name: existing.name,
        certificateNumber: existing.certificateNumber,
        expiryDate: existing.expiryDate ? formatDateValue(existing.expiryDate) : null,
        fileName: existing.fileName,
      },
    });
  }

  /** Attaches the certificate file, replacing any earlier one. */
  async uploadFile(
    certificationId: string,
    file: Express.Multer.File,
    user: AuthenticatedUser,
  ): Promise<EmployeeCertificationRecord> {
    assertValidDocumentUpload(file);
    const existing = await this.getCertificationOrThrow(certificationId, user.tenantId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId);

    const fileKey = this.storageService.buildCertificationFileKey(existing.tenantId, certificationId, file.originalname);
    await this.storageService.upload(fileKey, file.buffer, {
      contentType: file.mimetype,
      originalName: file.originalname,
      size: file.size,
    });
    await this.prisma.unscoped.employeeCertification.update({
      where: { id: certificationId },
      data: {
        fileKey,
        fileName: file.originalname,
        fileContentType: file.mimetype,
        fileSizeBytes: file.size,
        fileUploadedAt: new Date(),
      },
    });
    if (existing.fileKey) await this.discardFile(existing.fileKey);

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'update',
      module: 'training',
      recordId: certificationId,
      oldValue: existing.fileName ? { fileName: existing.fileName } : undefined,
      newValue: { entity: 'certification_file', fileName: file.originalname, sizeBytes: file.size },
    });

    return this.recordFor(certificationId, existing.employeeId);
  }

  async removeFile(certificationId: string, user: AuthenticatedUser): Promise<EmployeeCertificationRecord> {
    const existing = await this.getCertificationOrThrow(certificationId, user.tenantId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId);
    if (!existing.fileKey) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'This certification has no file attached' });
    }

    await this.prisma.unscoped.employeeCertification.update({
      where: { id: certificationId },
      data: { fileKey: null, fileName: null, fileContentType: null, fileSizeBytes: null, fileUploadedAt: null },
    });
    await this.discardFile(existing.fileKey);

    await this.auditService.log({
      tenantId: existing.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'training',
      recordId: certificationId,
      oldValue: { entity: 'certification_file', fileName: existing.fileName },
    });

    return this.recordFor(certificationId, existing.employeeId);
  }

  async readFile(
    certificationId: string,
    user: AuthenticatedUser,
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const existing = await this.getCertificationOrThrow(certificationId, user.tenantId);
    await this.dataScope.assertEmployeeInScope(user, existing.employeeId);
    if (!existing.fileKey || !(await this.storageService.exists(existing.fileKey))) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'The certificate file is missing' });
    }
    const { buffer } = await this.storageService.read(existing.fileKey);
    return {
      buffer,
      contentType: existing.fileContentType ?? 'application/octet-stream',
      filename: existing.fileName ?? 'certificate',
    };
  }

  /** Storage clean-up never fails the request; an orphaned object is only logged. */
  private async discardFile(fileKey: string): Promise<void> {
    try {
      await this.storageService.delete(fileKey);
    } catch (error) {
      this.logger.warn(`Couldn't delete certificate file ${fileKey}: ${error instanceof Error ? error.message : error}`);
    }
  }

  async getCertificationOrThrow(
    certificationId: string,
    tenantId: string | null,
  ): Promise<EmployeeCertification> {
    const row = tenantId
      ? await this.prisma.unscoped.employeeCertification.findFirst({ where: { id: certificationId, tenantId } })
      : null;
    if (!row) notFound();
    return row;
  }

  /** The record annotated against the employee's other certificates (for renewals). */
  private async recordFor(certificationId: string, employeeId: string): Promise<EmployeeCertificationRecord> {
    const rows = await this.prisma.unscoped.employeeCertification.findMany({
      where: { employeeId },
      include: CERTIFICATION_INCLUDE,
    });
    const record = this.toRecords(rows).find((row) => row.id === certificationId);
    if (!record) notFound();
    return record;
  }

  private toRecords(rows: CertificationWithRelations[]): EmployeeCertificationRecord[] {
    const today = new Date();
    const replacedBy = supersededBy(rows);
    return rows.map((row) => {
      const expiryState = certificationExpiryState(row.status, row.expiryDate, today);
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
        status: expiryState === 'revoked' ? 'revoked' : expiryState === 'expired' ? 'expired' : 'active',
        expiryState,
        daysUntilExpiry: row.expiryDate ? signedDaysUntil(today, row.expiryDate) : null,
        supersededById: replacedBy.get(row.id) ?? null,
        notes: row.notes,
        file:
          row.fileKey && row.fileName
            ? {
                name: row.fileName,
                contentType: row.fileContentType ?? 'application/octet-stream',
                sizeBytes: row.fileSizeBytes ?? 0,
                uploadedAt: (row.fileUploadedAt ?? row.updatedAt).toISOString(),
              }
            : null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  private async assertCourseInCompany(courseId: string, tenantId: string, companyId: string): Promise<void> {
    const course = await this.trainingService.getCourseOrThrow(courseId, tenantId);
    if (course.companyId !== companyId) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Training course not found' });
    }
  }

  private async assertEmployeeCanHoldCertificates(employeeId: string, companyId: string): Promise<void> {
    const employee = await this.prisma.unscoped.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { employmentStatus: true },
    });
    if (!employee) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Employee not found' });
    }
    if (employee.employmentStatus === 'terminated') {
      throw new BadRequestException({
        code: 'EMPLOYEE_TERMINATED',
        message: 'Certificates can’t be added for a terminated employee',
      });
    }
  }

  /** Same employee and name with the same certificate number, or with the same dates when unnumbered. */
  private async assertNotDuplicate(input: {
    employeeId: string;
    name: string;
    certificateNumber: string | null;
    issuedAt: Date | null;
    expiryDate: Date | null;
    excludeId?: string;
  }): Promise<void> {
    const others = await this.prisma.unscoped.employeeCertification.findMany({
      where: {
        employeeId: input.employeeId,
        name: { equals: input.name, mode: 'insensitive' },
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      },
      select: { name: true, certificateNumber: true, issuedAt: true, expiryDate: true },
    });
    const sameDay = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);
    const duplicate = others.some(
      (row) =>
        normalizeCertificationName(row.name) === normalizeCertificationName(input.name) &&
        (input.certificateNumber && row.certificateNumber
          ? row.certificateNumber.toLowerCase() === input.certificateNumber.toLowerCase()
          : sameDay(row.issuedAt, input.issuedAt) && sameDay(row.expiryDate, input.expiryDate)),
    );
    if (duplicate) {
      throw new ConflictException({
        code: 'DUPLICATE_CERTIFICATION',
        message: 'This employee already has this certificate on file',
      });
    }
  }
}
