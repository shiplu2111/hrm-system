import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { SupportAccessGuard } from './support-access.guard';

describe('SupportAccessGuard', () => {
  let guard: SupportAccessGuard;

  const mockPrisma = {
    unscoped: {
      supportAccessRequest: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    },
  };

  const createMockContext = (req: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportAccessGuard,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    guard = module.get<SupportAccessGuard>(SupportAccessGuard);
  });

  it('allows standard authenticated users to pass through unaffected', async () => {
    const context = createMockContext({
      user: {
        id: 'user-uuid',
        tenantId: 'tenant-uuid',
        isSupportAccess: false,
      },
      method: 'POST',
      url: '/api/v1/employees',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(
      mockPrisma.unscoped.supportAccessRequest.findUnique,
    ).not.toHaveBeenCalled();
  });

  it('rejects support access if grant is not found or revoked (401)', async () => {
    mockPrisma.unscoped.supportAccessRequest.findUnique.mockResolvedValue({
      id: 'req-uuid',
      status: 'revoked',
      revokedAt: new Date(),
    });

    const context = createMockContext({
      user: {
        id: 'user-uuid',
        tenantId: 'tenant-uuid',
        isSupportAccess: true,
        supportRequestId: 'req-uuid',
        accessMode: 'read_only',
      },
      method: 'GET',
      url: '/api/v1/employees',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects support access if grant has expired (401)', async () => {
    mockPrisma.unscoped.supportAccessRequest.findUnique.mockResolvedValue({
      id: 'req-uuid',
      status: 'approved',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000), // in the past
    });

    const context = createMockContext({
      user: {
        id: 'user-uuid',
        tenantId: 'tenant-uuid',
        isSupportAccess: true,
        supportRequestId: 'req-uuid',
        accessMode: 'read_only',
      },
      method: 'GET',
      url: '/api/v1/employees',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('allows GET requests in read_only mode (200)', async () => {
    mockPrisma.unscoped.supportAccessRequest.findUnique.mockResolvedValue({
      id: 'req-uuid',
      status: 'approved',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });

    const context = createMockContext({
      user: {
        id: 'user-uuid',
        tenantId: 'tenant-uuid',
        isSupportAccess: true,
        supportRequestId: 'req-uuid',
        accessMode: 'read_only',
      },
      method: 'GET',
      url: '/api/v1/employees',
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('blocks mutation requests (POST/PUT/DELETE) in read_only mode (403)', async () => {
    mockPrisma.unscoped.supportAccessRequest.findUnique.mockResolvedValue({
      id: 'req-uuid',
      status: 'approved',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });

    const context = createMockContext({
      user: {
        id: 'user-uuid',
        tenantId: 'tenant-uuid',
        isSupportAccess: true,
        supportRequestId: 'req-uuid',
        accessMode: 'read_only',
      },
      method: 'POST',
      url: '/api/v1/departments',
      body: { name: 'Engineering' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('strictly blocks bank-detail reveal even in write mode (403)', async () => {
    mockPrisma.unscoped.supportAccessRequest.findUnique.mockResolvedValue({
      id: 'req-uuid',
      status: 'approved',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });

    const context = createMockContext({
      user: {
        id: 'user-uuid',
        tenantId: 'tenant-uuid',
        isSupportAccess: true,
        supportRequestId: 'req-uuid',
        accessMode: 'read_write', // Even with write access!
      },
      method: 'GET',
      url: '/api/v1/employees/emp-1/tax-profiles/reveal?field=bankAccountNumber',
      query: { field: 'bankAccountNumber' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('strictly blocks payroll finalization even in write mode (403)', async () => {
    mockPrisma.unscoped.supportAccessRequest.findUnique.mockResolvedValue({
      id: 'req-uuid',
      status: 'approved',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });

    const context = createMockContext({
      user: {
        id: 'user-uuid',
        tenantId: 'tenant-uuid',
        isSupportAccess: true,
        supportRequestId: 'req-uuid',
        accessMode: 'read_write',
      },
      method: 'POST',
      url: '/api/v1/companies/c-1/payroll-runs/run-1/transition',
      body: { targetStatus: 'finalized' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('strictly blocks payment batch execution even in write mode (403)', async () => {
    mockPrisma.unscoped.supportAccessRequest.findUnique.mockResolvedValue({
      id: 'req-uuid',
      status: 'approved',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });

    const context = createMockContext({
      user: {
        id: 'user-uuid',
        tenantId: 'tenant-uuid',
        isSupportAccess: true,
        supportRequestId: 'req-uuid',
        accessMode: 'read_write',
      },
      method: 'POST',
      url: '/api/v1/companies/c-1/payment-batches/batch-1/mark-paid',
      body: { transactionReference: 'TX123' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
  });

  it('allows non-restricted mutation in approved read_write mode (200)', async () => {
    mockPrisma.unscoped.supportAccessRequest.findUnique.mockResolvedValue({
      id: 'req-uuid',
      status: 'approved',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60000),
    });

    const context = createMockContext({
      user: {
        id: 'user-uuid',
        tenantId: 'tenant-uuid',
        isSupportAccess: true,
        supportRequestId: 'req-uuid',
        accessMode: 'read_write',
      },
      method: 'POST',
      url: '/api/v1/departments',
      body: { name: 'Support Operations' },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
