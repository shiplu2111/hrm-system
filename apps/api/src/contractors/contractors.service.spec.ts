import { Decimal } from '@prisma/client/runtime/library';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ContractorContractsService } from './contractor-contracts.service';
import { ContractorInvoicesService } from './contractor-invoices.service';
import { ContractorPaymentBatchesService } from './contractor-payment-batches.service';
import { ContractorsService } from './contractors.service';

const MOCK_USER: AuthenticatedUser = {
  id: 'user-1',
  tenantId: 'tenant-1',
  roleId: 'role-1',
  roleName: 'Payroll Admin',
  email: 'payroll@cmsnbd.com',
  employeeId: null,
  permissions: [],
};

describe('Contractors & AP services', () => {
  it('masks contractor taxId in read endpoints and forwards contractorKind filter', async () => {
    const prisma = {
      unscoped: {
        contractor: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'con-1',
              tenantId: 'tenant-1',
              companyId: 'comp-1',
              contractorNumber: 'VEN-2026-001',
              legalName: 'ClearPath Consulting Pty Ltd',
              displayName: 'ClearPath Consulting',
              contractorKind: 'consultant',
              category: 'Advisory',
              contactName: 'Marcus Lee',
              email: 'marcus@clearpath.co',
              phone: '+61 2 5550 0172',
              location: 'Sydney',
              taxId: 'ABN-99-887766',
              status: 'active',
              ownerEmployeeId: null,
              owner: null,
              _count: { contracts: 1 },
              createdAt: new Date('2026-01-01T00:00:00Z'),
              updatedAt: new Date('2026-01-01T00:00:00Z'),
            },
          ]),
        },
        contractorInvoice: {
          aggregate: jest.fn().mockResolvedValue({ _sum: { amount: new Decimal(0) } }),
        },
      },
    };
    const companyScope = { assertCompanyInTenant: jest.fn().mockResolvedValue({ id: 'comp-1', tenantId: 'tenant-1' }) };
    const auditService = { log: jest.fn() };

    const service = new ContractorsService(
      prisma as never,
      companyScope as never,
      auditService as never,
    );

    const rows = await service.list('comp-1', { contractorKind: 'consultant' });

    expect(prisma.unscoped.contractor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'comp-1',
          contractorKind: 'consultant',
        }),
      }),
    );
    expect(rows[0]?.taxId).toBe('*********7766');
  });

  it('logs rejection reason in audit_logs and releases pending milestone', async () => {
    const existing = {
      id: 'inv-1',
      tenantId: 'tenant-1',
      companyId: 'comp-1',
      contractorId: 'con-1',
      contractId: 'ctr-1',
      milestoneId: 'ms-1',
      invoiceNumber: 'CINV-2026-009',
      periodLabel: 'Sprint 4',
      description: 'Phase 1',
      lineItems: [],
      hoursWorked: null,
      hourlyRate: null,
      amount: new Decimal('5000.00'),
      currency: 'AUD',
      issuedAt: new Date('2026-11-01T00:00:00Z'),
      dueAt: new Date('2026-12-01T00:00:00Z'),
      status: 'submitted' as const,
      paidAt: null,
      paymentReference: null,
      createdAt: new Date('2026-11-01T00:00:00Z'),
      updatedAt: new Date('2026-11-01T00:00:00Z'),
      contractor: { legalName: 'ClearPath', displayName: 'ClearPath' },
      contract: { contractNumber: 'CTR-2026-001', paymentTerms: 'net_30' as const },
    };
    const updated = { ...existing, status: 'rejected' as const };
    const prisma = {
      unscoped: {
        contractorInvoice: {
          findUnique: jest.fn().mockResolvedValue(existing),
          update: jest.fn().mockResolvedValue(updated),
        },
        contractorContractMilestone: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      },
    };
    const companyScope = { assertCompanyInTenant: jest.fn().mockResolvedValue({ id: 'comp-1', tenantId: 'tenant-1' }) };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const service = new ContractorInvoicesService(
      prisma as never,
      companyScope as never,
      auditService as never,
    );

    const res = await service.reject('inv-1', MOCK_USER, { reason: 'Missing SOW sign-off' });

    expect(res.status).toBe('rejected');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        module: 'contractors',
        action: 'update',
        newValue: { status: 'rejected', rejectionReason: 'Missing SOW sign-off' },
      }),
    );
    expect(prisma.unscoped.contractorContractMilestone.updateMany).toHaveBeenCalledWith({
      where: { id: 'ms-1', status: 'invoiced' },
      data: { status: 'pending' },
    });
  });

  it('marks batch, invoices, and linked milestones paid when finalizing payment batch', async () => {
    const batchRow = {
      id: 'batch-1',
      tenantId: 'tenant-1',
      companyId: 'comp-1',
      referenceNumber: 'CPAY-2026-0001',
      status: 'pending' as const,
      totalAmount: new Decimal('10000.00'),
      currency: 'AUD',
      itemCount: 1,
      transactionReference: null,
      paidAt: null,
      createdAt: new Date('2026-11-10T00:00:00Z'),
      items: [
        {
          id: 'item-1',
          contractorInvoiceId: 'inv-1',
          contractorInvoice: { milestoneId: 'ms-1' },
        },
      ],
    };
    const tx = {
      contractorPaymentBatch: {
        update: jest.fn().mockResolvedValue({ ...batchRow, status: 'paid', paidAt: new Date('2026-11-10T12:00:00Z') }),
      },
      contractorPaymentBatchItem: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      contractorInvoice: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      contractorContractMilestone: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      unscoped: {
        contractorPaymentBatch: { findUnique: jest.fn().mockResolvedValue(batchRow) },
        contractorJournalExport: {
          findUnique: jest.fn().mockResolvedValue({ id: 'jexp-1' }),
        },
        $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
      },
    };
    const companyScope = { assertCompanyInTenant: jest.fn().mockResolvedValue({ id: 'comp-1', tenantId: 'tenant-1' }) };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const contractorAccounting = {
      exportJournalForBatch: jest.fn().mockResolvedValue(undefined),
    };

    const service = new ContractorPaymentBatchesService(
      prisma as never,
      companyScope as never,
      auditService as never,
      contractorAccounting as never,
    );

    const paid = await service.markPaid('batch-1', MOCK_USER);

    expect(paid.status).toBe('paid');
    expect(paid.journalExportId).toBe('jexp-1');
    expect(tx.contractorContractMilestone.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['ms-1'] } },
      data: { status: 'paid' },
    });
  });

  it('updates payment terms and rejects removing invoiced milestones', async () => {
    const baseContract = {
      id: 'ctr-1',
      tenantId: 'tenant-1',
      companyId: 'comp-1',
      contractorId: 'con-1',
      contractNumber: 'CTR-2026-001',
      title: 'Retainer',
      scopeDescription: 'Advisory',
      status: 'active' as const,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2027-01-01T00:00:00Z'),
      annualValue: new Decimal('12000.00'),
      fixedFeeAmount: new Decimal('12000.00'),
      hourlyRate: null,
      currency: 'AUD',
      paymentStructure: 'fixed_project_fee' as const,
      paymentTerms: 'net_30' as const,
      billingFrequency: 'monthly' as const,
      autoRenewal: false,
      noticePeriodDays: 30,
      ownerEmployeeId: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      milestones: [] as Array<{ id: string; title: string; amount: Decimal; status: string }>,
      invoices: [] as Array<{ id: string }>,
    };

    const tx = {
      contractorContractMilestone: {
        deleteMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      contractorContract: {
        update: jest.fn().mockResolvedValue({
          ...baseContract,
          paymentStructure: 'hourly_invoice',
          paymentTerms: 'net_14',
          hourlyRate: new Decimal('140.00'),
          fixedFeeAmount: null,
          contractor: { legalName: 'ClearPath', displayName: 'ClearPath' },
          owner: null,
          milestones: [],
        }),
      },
    };

    const prisma = {
      unscoped: {
        contractorContract: { findUnique: jest.fn().mockResolvedValue(baseContract) },
        $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
      },
    };
    const companyScope = { assertCompanyInTenant: jest.fn().mockResolvedValue({ id: 'comp-1', tenantId: 'tenant-1' }) };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };

    const service = new ContractorContractsService(
      prisma as never,
      companyScope as never,
      auditService as never,
    );

    const updated = await service.updatePaymentTerms(
      'ctr-1',
      {
        paymentStructure: 'hourly_invoice',
        paymentTerms: 'net_14',
        hourlyRate: '140.00',
      },
      MOCK_USER,
    );

    expect(updated.paymentStructure).toBe('hourly_invoice');
    expect(updated.paymentTerms).toBe('net_14');
    expect(updated.hourlyRate).toBe('140.00');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'contractors', action: 'update', recordId: 'ctr-1' }),
    );

    prisma.unscoped.contractorContract.findUnique.mockResolvedValue({
      ...baseContract,
      paymentStructure: 'milestone',
      invoices: [{ id: 'inv-1' }],
      milestones: [{ id: 'ms-locked', title: 'Phase 1', amount: new Decimal('5000.00'), status: 'invoiced' }],
    });

    await expect(
      service.updatePaymentTerms(
        'ctr-1',
        {
          paymentStructure: 'milestone',
          paymentTerms: 'net_30',
          milestones: [{ title: 'New Only', amount: '5000.00' }],
        },
        MOCK_USER,
      ),
    ).rejects.toThrow(/already invoiced/i);
  });

  it('links direct invoice markPaid to contractor GL export', async () => {
    const existing = {
      id: 'inv-direct',
      tenantId: 'tenant-1',
      companyId: 'comp-1',
      contractorId: 'con-1',
      contractId: 'ctr-1',
      milestoneId: null,
      invoiceNumber: 'CINV-2026-011',
      periodLabel: 'Nov',
      description: 'Direct pay',
      lineItems: [],
      hoursWorked: null,
      hourlyRate: null,
      amount: new Decimal('2000.00'),
      currency: 'AUD',
      issuedAt: new Date('2026-11-01T00:00:00Z'),
      dueAt: new Date('2026-12-01T00:00:00Z'),
      status: 'approved' as const,
      paidAt: null,
      paymentReference: null,
      createdAt: new Date('2026-11-01T00:00:00Z'),
      updatedAt: new Date('2026-11-01T00:00:00Z'),
      contractor: { legalName: 'ClearPath', displayName: 'ClearPath' },
      contract: { contractNumber: 'CTR-2026-001', paymentTerms: 'net_30' as const },
    };
    const prisma = {
      unscoped: {
        contractorInvoice: {
          findUnique: jest.fn().mockResolvedValue(existing),
          update: jest.fn().mockResolvedValue({
            ...existing,
            status: 'paid',
            paymentReference: 'EFT-999',
            paidAt: new Date('2026-11-10T00:00:00Z'),
          }),
        },
      },
    };
    const companyScope = { assertCompanyInTenant: jest.fn().mockResolvedValue({ id: 'comp-1', tenantId: 'tenant-1' }) };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const contractorAccounting = {
      exportDirectPaidInvoice: jest.fn().mockResolvedValue(null),
    };

    const service = new ContractorInvoicesService(
      prisma as never,
      companyScope as never,
      auditService as never,
      contractorAccounting as never,
    );

    const paid = await service.markPaid('inv-direct', MOCK_USER, { paymentReference: 'EFT-999' });

    expect(paid.status).toBe('paid');
    expect(contractorAccounting.exportDirectPaidInvoice).toHaveBeenCalledWith(
      'inv-direct',
      MOCK_USER,
    );
  });
});
