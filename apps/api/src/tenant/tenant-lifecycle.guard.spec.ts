import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantStatus, TenantSuspensionMode } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { TenantLifecycleGuard } from './tenant-lifecycle.guard';

describe('TenantLifecycleGuard', () => {
  let guard: TenantLifecycleGuard;
  let reflector: Reflector;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      unscoped: {
        tenant: {
          findUnique: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantLifecycleGuard,
        Reflector,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    guard = module.get<TenantLifecycleGuard>(TenantLifecycleGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  function createMockContext(req: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('should allow public endpoints', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValueOnce(true); // isPublic
    const ctx = createMockContext({ url: '/api/v1/auth/login' });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockPrisma.unscoped.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('should allow endpoints decorated with @SkipTenantScope', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValueOnce(false) // isPublic
      .mockReturnValueOnce(true); // skipScope
    const ctx = createMockContext({ url: '/api/v1/health' });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockPrisma.unscoped.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('should allow platform routes (/platform/...)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const ctx = createMockContext({
      url: '/api/v1/platform/tenants',
      originalUrl: '/api/v1/platform/tenants',
      user: { id: 'admin-1' },
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(mockPrisma.unscoped.tenant.findUnique).not.toHaveBeenCalled();
  });

  it('should allow requests without tenantId (e.g. system or unassigned users)', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    const ctx = createMockContext({
      url: '/api/v1/me',
      user: { id: 'user-1' }, // no tenantId
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should allow requests when tenant is active', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
      status: TenantStatus.active,
      suspensionMode: null,
    });

    const ctx = createMockContext({
      method: 'POST',
      url: '/api/v1/employees',
      user: { id: 'user-1', tenantId: 't-active' },
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when tenant is fully_blocked suspended', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
      status: TenantStatus.suspended,
      suspensionMode: TenantSuspensionMode.fully_blocked,
    });

    const ctx = createMockContext({
      method: 'GET',
      url: '/api/v1/employees',
      user: { id: 'user-1', tenantId: 't-blocked' },
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should permit GET requests when tenant is read_only suspended', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
      status: TenantStatus.suspended,
      suspensionMode: TenantSuspensionMode.read_only,
    });

    const ctx = createMockContext({
      method: 'GET',
      url: '/api/v1/employees',
      user: { id: 'user-1', tenantId: 't-readonly' },
    });

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('should block mutation requests (POST/PUT/PATCH/DELETE) when tenant is read_only suspended', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
      status: TenantStatus.suspended,
      suspensionMode: TenantSuspensionMode.read_only,
    });

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const ctx = createMockContext({
        method,
        url: '/api/v1/employees',
        user: { id: 'user-1', tenantId: 't-readonly' },
      });

      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    }
  });

  it('should throw ForbiddenException when tenant is cancelled', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
      status: TenantStatus.cancelled,
      suspensionMode: null,
    });

    const ctx = createMockContext({
      method: 'GET',
      url: '/api/v1/employees',
      user: { id: 'user-1', tenantId: 't-cancelled' },
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when tenant is pending_deletion or deleted', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    mockPrisma.unscoped.tenant.findUnique.mockResolvedValue({
      status: TenantStatus.pending_deletion,
      suspensionMode: null,
    });

    const ctx = createMockContext({
      method: 'GET',
      url: '/api/v1/employees',
      user: { id: 'user-1', tenantId: 't-pending-del' },
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
