import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ExpenseClaimStatus, Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseClaimsService } from './expense-claims.service';

function claim(overrides: Record<string, unknown> = {}) {
  return {
    id: 'claim-1',
    tenantId: 't1',
    companyId: 'c1',
    employeeId: 'emp-1',
    categoryId: 'cat-1',
    referenceNumber: 'EXP-2026-001',
    expenseDate: new Date('2026-03-20T00:00:00Z'),
    amount: new Prisma.Decimal(120),
    currency: 'AUD',
    description: 'Client lunch',
    status: ExpenseClaimStatus.pending_approval,
    submittedAt: new Date('2026-03-21T00:00:00Z'),
    approvedAt: null,
    rejectedAt: null,
    reimbursedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-03-21T00:00:00Z'),
    updatedAt: new Date('2026-03-21T00:00:00Z'),
    employee: { firstName: 'James', lastName: 'Wilson', employeeNumber: 'EMP-002' },
    category: {
      id: 'cat-1',
      name: 'Meals',
      isActive: true,
      receiptRequired: false,
      maxAmountPerClaim: null,
      maxAmountPerMonth: null,
    },
    receipts: [],
    ...overrides,
  };
}

function actor(employeeId: string | null): AuthenticatedUser {
  return {
    id: 'u1',
    tenantId: 't1',
    roleId: 'r1',
    roleName: 'Company Owner',
    employeeId,
    email: 'owner@test.com',
    permissions: [],
  } as AuthenticatedUser;
}

describe('ExpenseClaimsService decisions', () => {
  let prisma: {
    unscoped: {
      expenseClaim: { findUnique: jest.Mock; update: jest.Mock; aggregate: jest.Mock };
    };
  };
  let workflow: Record<string, jest.Mock>;
  let service: ExpenseClaimsService;

  beforeEach(() => {
    prisma = {
      unscoped: {
        expenseClaim: {
          findUnique: jest.fn().mockResolvedValue(claim()),
          update: jest.fn().mockImplementation(({ data }) => Promise.resolve(claim(data))),
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
        },
      },
    };
    workflow = {
      approve: jest.fn(),
      reject: jest.fn().mockResolvedValue({ instance: null, fullyApproved: false, rejected: true }),
      findForClaims: jest.fn().mockResolvedValue(new Map()),
      resolveRoutes: jest.fn().mockResolvedValue(new Map()),
      startForClaim: jest.fn(),
    };
    service = new ExpenseClaimsService(
      prisma as never,
      { assertCompanyInTenant: jest.fn().mockResolvedValue(undefined) } as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      workflow as never,
      { canActOnSteps: jest.fn().mockResolvedValue([]) } as never,
      { emit: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      { hasPermission: jest.fn().mockReturnValue(true) } as never,
    );
  });

  it('blocks deciding or reimbursing your own claim', async () => {
    await expect(service.approve('claim-1', actor('emp-1'), {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.reject('claim-1', actor('emp-1'), { reason: 'No' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.unscoped.expenseClaim.findUnique.mockResolvedValue(
      claim({ status: ExpenseClaimStatus.approved }),
    );
    await expect(service.markReimbursed('claim-1', actor('emp-1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(workflow.approve).not.toHaveBeenCalled();
    expect(workflow.reject).not.toHaveBeenCalled();
    expect(prisma.unscoped.expenseClaim.update).not.toHaveBeenCalled();
  });

  it('stores the rejection reason and passes it to the workflow step', async () => {
    const record = await service.reject('claim-1', actor('emp-9'), {
      reason: 'Alcohol is not reimbursable',
    });
    expect(workflow.reject).toHaveBeenCalledWith(
      expect.objectContaining({ comment: 'Alcohol is not reimbursable' }),
    );
    expect(record.status).toBe(ExpenseClaimStatus.rejected);
    expect(record.rejectionReason).toBe('Alcohol is not reimbursable');
  });

  it('refuses to submit a draft whose category was deactivated', async () => {
    prisma.unscoped.expenseClaim.findUnique.mockResolvedValue(
      claim({
        status: ExpenseClaimStatus.draft,
        category: { ...claim().category, isActive: false },
      }),
    );
    await expect(service.submit('claim-1', actor('emp-9'))).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(workflow.startForClaim).not.toHaveBeenCalled();
  });
});

describe('ExpenseCategoriesService limits', () => {
  const existing = {
    id: 'cat-1',
    tenantId: 't1',
    companyId: 'c1',
    name: 'Meals',
    description: null,
    maxAmountPerClaim: new Prisma.Decimal(500),
    maxAmountPerMonth: new Prisma.Decimal(1500),
    receiptRequired: true,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
  let prisma: {
    unscoped: { expenseCategory: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock } };
  };
  let service: ExpenseCategoriesService;

  beforeEach(() => {
    prisma = {
      unscoped: {
        expenseCategory: {
          findUnique: jest.fn().mockResolvedValue(existing),
          update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...existing, ...data })),
          create: jest.fn(),
        },
      },
    };
    service = new ExpenseCategoriesService(
      prisma as never,
      { assertCompanyInTenant: jest.fn().mockResolvedValue({ tenantId: 't1' }) } as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  it('checks a new per-claim limit against the stored monthly limit', async () => {
    await expect(
      service.update('cat-1', { maxAmountPerClaim: 2000 }, actor(null)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.unscoped.expenseCategory.update).not.toHaveBeenCalled();
  });

  it('allows removing the monthly limit so the per-claim limit can rise', async () => {
    const record = await service.update(
      'cat-1',
      { maxAmountPerClaim: 2000, maxAmountPerMonth: null },
      actor(null),
    );
    expect(record.maxAmountPerClaim).toBe(2000);
    expect(record.maxAmountPerMonth).toBeNull();
  });

  it('reports a duplicate name as a conflict', async () => {
    prisma.unscoped.expenseCategory.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.create('c1', { name: 'Meals' }, actor(null)),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
