import { BadRequestException } from '@nestjs/common';
import { EmploymentContractStatus } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { EmploymentContractsService } from './employment-contracts.service';

const user = { id: 'user-1', tenantId: 'tenant-1' } as AuthenticatedUser;

function setup(
  existing: { status: EmploymentContractStatus; startDate: string; endDate: string | null },
  workflowStatus: 'pending' | 'approved' | null = null,
) {
  const row = {
    id: 'contract-1',
    tenantId: 'tenant-1',
    companyId: 'company-1',
    employeeId: 'employee-1',
    contractType: 'fixed_term',
    status: existing.status,
    startDate: new Date(`${existing.startDate}T00:00:00Z`),
    endDate: existing.endDate ? new Date(`${existing.endDate}T00:00:00Z`) : null,
    probationEndDate: null,
    currency: 'AUD',
    expiryAlertSentAt: new Date('2026-01-01T06:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    employee: { firstName: 'A', lastName: 'B', employeeNumber: 'E1' },
    documents: [],
  };
  const update = jest.fn(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...row, ...data }),
  );
  const prisma = {
    unscoped: {
      employmentContract: {
        findUnique: jest.fn().mockResolvedValue(row),
        update,
      },
    },
  };
  const contractWorkflow = {
    findForContract: jest.fn().mockResolvedValue(workflowStatus ? { status: workflowStatus } : null),
  };
  const service = new EmploymentContractsService(
    prisma as never,
    { assertCompanyInTenant: jest.fn().mockResolvedValue(undefined) } as never,
    {} as never,
    { log: jest.fn().mockResolvedValue(undefined) } as never,
    contractWorkflow as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { assertEmployeeInScope: jest.fn().mockResolvedValue(undefined) } as never,
    { getWindowDays: jest.fn().mockResolvedValue(90) } as never,
  );
  return { service, update };
}

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(BadRequestException);
    return ((err as BadRequestException).getResponse() as { code: string }).code;
  }
  throw new Error('Expected the update to be rejected');
}

describe('EmploymentContractsService.update', () => {
  it('rejects term changes on a terminated contract', async () => {
    const { service, update } = setup({
      status: EmploymentContractStatus.terminated,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    await expect(errorCode(service.update('contract-1', { payRate: 50 }, user))).resolves.toBe(
      'CONTRACT_LOCKED',
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects term changes while a renewal is awaiting approval', async () => {
    const { service, update } = setup(
      { status: EmploymentContractStatus.draft, startDate: '2027-01-01', endDate: '2027-12-31' },
      'pending',
    );

    await expect(
      errorCode(service.update('contract-1', { endDate: '2028-06-30' }, user)),
    ).resolves.toBe('CONTRACT_LOCKED');
    expect(update).not.toHaveBeenCalled();
  });

  it('validates a new end date against the stored start date', async () => {
    const { service, update } = setup({
      status: EmploymentContractStatus.active,
      startDate: '2026-03-01',
      endDate: '2026-12-31',
    });

    await expect(
      errorCode(service.update('contract-1', { endDate: '2026-02-01' }, user)),
    ).resolves.toBe('VALIDATION_ERROR');
    expect(update).not.toHaveBeenCalled();
  });

  it('re-arms the expiry alert when the end date moves', async () => {
    const { service, update } = setup({
      status: EmploymentContractStatus.active,
      startDate: '2026-01-01',
      endDate: '2026-06-30',
    });

    await service.update('contract-1', { endDate: '2026-12-31' }, user);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expiryAlertSentAt: null }),
      }),
    );
  });

  it('keeps the alert marker when other terms change', async () => {
    const { service, update } = setup({
      status: EmploymentContractStatus.active,
      startDate: '2026-01-01',
      endDate: '2026-06-30',
    });

    await service.update('contract-1', { payRate: 60, endDate: '2026-06-30' }, user);

    expect(update.mock.calls[0]?.[0].data).not.toHaveProperty('expiryAlertSentAt');
  });

  it("flags expiring soon using the company's alert window", async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-01T09:00:00Z'));
    try {
      const { service } = setup({
        status: EmploymentContractStatus.active,
        startDate: '2026-01-01',
        endDate: '2026-07-15',
      });

      const record = await service.update('contract-1', { payRate: 60 }, user);

      expect(record.displayStatus).toBe('expiring_soon');
    } finally {
      jest.useRealTimers();
    }
  });
});
