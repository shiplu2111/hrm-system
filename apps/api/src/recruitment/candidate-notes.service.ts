import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { CandidateNoteRecord } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { CompanyScopeService } from '../organization/company-scope.service';
import { PermissionsService } from '../rbac/permissions.service';
import { CandidatesService } from './candidates.service';
import type { CreateCandidateNoteDto } from './dto/recruitment.dto';

const NOTE_INCLUDE = {
  author: {
    select: {
      email: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  },
  application: {
    select: { requisition: { select: { title: true, referenceNumber: true } } },
  },
} satisfies Prisma.CandidateNoteInclude;

type NoteRow = Prisma.CandidateNoteGetPayload<{ include: typeof NOTE_INCLUDE }>;

@Injectable()
export class CandidateNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
    private readonly candidatesService: CandidatesService,
    private readonly permissions: PermissionsService,
  ) {}

  async list(candidateId: string): Promise<CandidateNoteRecord[]> {
    const candidate = await this.candidatesService.findOrThrow(candidateId);
    await this.companyScope.assertCompanyInTenant(candidate.companyId);

    const rows = await this.prisma.unscoped.candidateNote.findMany({
      where: { candidateId },
      include: NOTE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toRecord(row));
  }

  async create(
    candidateId: string,
    dto: CreateCandidateNoteDto,
    user: AuthenticatedUser,
  ): Promise<CandidateNoteRecord> {
    const candidate = await this.candidatesService.findOrThrow(candidateId);
    await this.companyScope.assertCompanyInTenant(candidate.companyId);

    if (dto.applicationId) {
      const application = await this.prisma.unscoped.jobApplication.findFirst({
        where: { id: dto.applicationId, candidateId },
        select: { id: true },
      });
      if (!application) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Application does not belong to this candidate',
        });
      }
    }

    const row = await this.prisma.unscoped.candidateNote.create({
      data: {
        tenantId: candidate.tenantId,
        candidateId,
        applicationId: dto.applicationId ?? null,
        authorUserId: user.id,
        body: dto.body.trim(),
      },
      include: NOTE_INCLUDE,
    });

    await this.auditService.log({
      tenantId: candidate.tenantId,
      userId: user.id,
      action: 'create',
      module: 'recruitment',
      recordId: candidateId,
      newValue: { noteId: row.id },
    });

    return this.toRecord(row);
  }

  /** Authors can remove their own notes; anyone else needs recruitment:approve. */
  async remove(noteId: string, user: AuthenticatedUser): Promise<void> {
    const note = await this.prisma.unscoped.candidateNote.findUnique({
      where: { id: noteId },
      include: { candidate: { select: { companyId: true } } },
    });
    if (!note) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Note not found' });
    }
    await this.companyScope.assertCompanyInTenant(note.candidate.companyId);

    if (note.authorUserId !== user.id) {
      try {
        await this.permissions.assertPermission(user, 'recruitment', 'approve');
      } catch {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Only the author or a recruitment approver can delete this note',
        });
      }
    }

    await this.prisma.unscoped.candidateNote.delete({ where: { id: noteId } });

    await this.auditService.log({
      tenantId: note.tenantId,
      userId: user.id,
      action: 'delete',
      module: 'recruitment',
      recordId: note.candidateId,
      oldValue: { noteId, body: note.body },
    });
  }

  private toRecord(row: NoteRow): CandidateNoteRecord {
    const employee = row.author?.employee;
    const authorName = employee
      ? `${employee.firstName} ${employee.lastName}`.trim()
      : (row.author?.email ?? 'Deleted user');
    const requisition = row.application?.requisition;
    return {
      id: row.id,
      candidateId: row.candidateId,
      applicationId: row.applicationId,
      applicationLabel: requisition
        ? `${requisition.referenceNumber} · ${requisition.title}`
        : null,
      body: row.body,
      authorUserId: row.authorUserId,
      authorName,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
