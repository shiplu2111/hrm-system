import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CandidateNotesService } from './candidate-notes.service';

const user = (id: string): AuthenticatedUser => ({
  id,
  tenantId: 'tenant-1',
  roleId: 'role-1',
  roleName: 'Recruiter',
  employeeId: null,
  email: `${id}@example.com`,
  permissions: [],
});

describe('CandidateNotesService.remove', () => {
  const note = {
    id: 'note-1',
    tenantId: 'tenant-1',
    candidateId: 'cand-1',
    authorUserId: 'author',
    body: 'Strong communicator',
    candidate: { companyId: 'company-1' },
  };

  function build(assertPermission: jest.Mock) {
    const prisma = {
      unscoped: {
        candidateNote: {
          findUnique: jest.fn().mockResolvedValue(note),
          delete: jest.fn().mockResolvedValue(note),
        },
      },
    };
    const auditService = { log: jest.fn() };
    const service = new CandidateNotesService(
      prisma as never,
      { assertCompanyInTenant: jest.fn() } as never,
      auditService as never,
      {} as never,
      { assertPermission } as never,
    );
    return { service, prisma, auditService };
  }

  it('lets the author delete without approve permission', async () => {
    const assertPermission = jest.fn();
    const { service, prisma, auditService } = build(assertPermission);

    await service.remove('note-1', user('author'));

    expect(assertPermission).not.toHaveBeenCalled();
    expect(prisma.unscoped.candidateNote.delete).toHaveBeenCalledWith({
      where: { id: 'note-1' },
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete', recordId: 'cand-1' }),
    );
  });

  it('requires recruitment:approve for someone else’s note', async () => {
    const assertPermission = jest
      .fn()
      .mockRejectedValue(new ForbiddenException('nope'));
    const { service, prisma } = build(assertPermission);

    await expect(service.remove('note-1', user('other'))).rejects.toThrow(
      /Only the author/,
    );
    expect(assertPermission).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'other' }),
      'recruitment',
      'approve',
    );
    expect(prisma.unscoped.candidateNote.delete).not.toHaveBeenCalled();
  });
});
