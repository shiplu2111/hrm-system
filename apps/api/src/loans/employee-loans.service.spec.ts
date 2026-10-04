import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EmployeeLoanStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { EmployeeLoansService } from './employee-loans.service';

function pendingLoan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'loan-1',
    tenantId: 't1',
    companyId: 'c1',
    employeeId: 'emp-1',
    referenceNumber: 'LN-2026-001',
    loanKind: 'loan',
    purposeLabel: null,
    principalAmount: 1200,
    interestRatePercent: 0,
    tenorMonths: 3,
    monthlyInstallment: 400,
    totalRepayable: 1200,
    repaidAmount: 0,
    remainingBalance: 1200,
    installmentsPaid: 0,
    deductFromPayroll: true,
    status: EmployeeLoanStatus.pending_approval,
    firstDueDate: null,
    disbursedAt: null,
    approvedAt: null,
    rejectedAt: null,
    payComponentId: null,
    salaryStructureId: null,
    notes: 'Original note',
    rejectionReason: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
    employee: { firstName: 'Jordan', lastName: 'Lee', employeeNumber: 'EMP-005' },
    installments: [],
    ...overrides,
  };
}

function approver(employeeId: string | null): AuthenticatedUser {
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

describe('EmployeeLoansService decisions', () => {
  let prisma: {
    unscoped: {
      employeeLoan: { findUnique: jest.Mock; update: jest.Mock };
    };
  };
  let service: EmployeeLoansService;

  beforeEach(() => {
    prisma = {
      unscoped: {
        employeeLoan: {
          findUnique: jest.fn().mockResolvedValue(pendingLoan()),
          update: jest.fn().mockImplementation(({ data }) => Promise.resolve(pendingLoan(data))),
        },
      },
    };
    service = new EmployeeLoansService(
      prisma as never,
      { assertCompanyInTenant: jest.fn().mockResolvedValue(undefined) } as never,
      { log: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
      { assertPermission: jest.fn().mockResolvedValue(undefined) } as never,
    );
  });

  it('blocks approving or rejecting your own request', async () => {
    await expect(service.approve('loan-1', approver('emp-1'))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.reject('loan-1', approver('emp-1'), { reason: 'No' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.unscoped.employeeLoan.update).not.toHaveBeenCalled();
  });

  it('rejects a first installment date in the past', async () => {
    await expect(
      service.approve('loan-1', approver('emp-9'), { firstDueDate: '2020-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('stores the rejection reason without overwriting the request notes', async () => {
    const record = await service.reject('loan-1', approver(null), { reason: 'Over the advance limit' });
    expect(prisma.unscoped.employeeLoan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EmployeeLoanStatus.rejected,
          rejectionReason: 'Over the advance limit',
        }),
      }),
    );
    expect(record.notes).toBe('Original note');
    expect(record.rejectionReason).toBe('Over the advance limit');
  });
});
