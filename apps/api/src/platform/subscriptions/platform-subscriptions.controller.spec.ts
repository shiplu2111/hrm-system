import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { PlatformSubscriptionsController } from './platform-subscriptions.controller';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';

describe('PlatformSubscriptionsController and Role-Gating', () => {
  let controller: PlatformSubscriptionsController;
  let guard: PlatformPermissionsGuard;
  let reflector: Reflector;

  const mockService = {
    listSubscriptions: jest.fn(),
    getSubscriptionDetail: jest.fn(),
    changePlan: jest.fn(),
    extendTrial: jest.fn(),
    applyDiscountOrCredit: jest.fn(),
    pauseSubscription: jest.fn(),
    resumeSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformSubscriptionsController],
      providers: [
        {
          provide: PlatformSubscriptionsService,
          useValue: mockService,
        },
        Reflector,
        PlatformPermissionsGuard,
      ],
    })
      .overrideGuard(PlatformAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PlatformSubscriptionsController>(
      PlatformSubscriptionsController,
    );
    guard = module.get<PlatformPermissionsGuard>(PlatformPermissionsGuard);
    reflector = module.get<Reflector>(Reflector);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
    expect(guard).toBeDefined();
  });

  describe('Controller endpoints delegation', () => {
    const mockActor = {
      id: 'staff-1',
      email: 'billing@cmsn.test',
      roleName: 'Billing Admin',
      permissions: [{ module: 'billing', action: 'edit' }],
    };

    const mockReq = {
      platformUser: mockActor,
      ip: '127.0.0.1',
      headers: { 'user-agent': 'TestAgent' },
    };

    it('listSubscriptions calls service and wraps in data envelope', async () => {
      mockService.listSubscriptions.mockResolvedValueOnce([{ id: 'sub-1' }]);
      const result = await controller.listSubscriptions({ status: 'active' });
      expect(mockService.listSubscriptions).toHaveBeenCalledWith({
        status: 'active',
      });
      expect(result).toEqual({ data: [{ id: 'sub-1' }] });
    });

    it('getSubscription calls service with parsed UUID', async () => {
      mockService.getSubscriptionDetail.mockResolvedValueOnce({ id: 'sub-1' });
      const result = await controller.getSubscription('sub-1');
      expect(mockService.getSubscriptionDetail).toHaveBeenCalledWith('sub-1');
      expect(result).toEqual({ data: { id: 'sub-1' } });
    });

    it('changePlan delegates to service with actor info', async () => {
      mockService.changePlan.mockResolvedValueOnce({ id: 'sub-1' });
      const dto = { targetPlanId: 'plan-biz', reason: 'Upgrade to Business tier' };
      const result = await controller.changePlan('sub-1', dto, mockReq);
      expect(mockService.changePlan).toHaveBeenCalledWith(
        'sub-1',
        dto,
        mockActor,
        '127.0.0.1',
        'TestAgent',
      );
      expect(result).toEqual({ data: { id: 'sub-1' } });
    });

    it('extendTrial delegates to service with actor info', async () => {
      mockService.extendTrial.mockResolvedValueOnce({ id: 'sub-1' });
      const dto = { additionalDays: 14, reason: 'Prospect POC elongation' };
      const result = await controller.extendTrial('sub-1', dto, mockReq);
      expect(mockService.extendTrial).toHaveBeenCalledWith(
        'sub-1',
        dto,
        mockActor,
        '127.0.0.1',
        'TestAgent',
      );
      expect(result).toEqual({ data: { id: 'sub-1' } });
    });

    it('applyDiscountOrCredit delegates to service with actor info', async () => {
      mockService.applyDiscountOrCredit.mockResolvedValueOnce({ id: 'sub-1' });
      const dto = {
        discountPercent: 15,
        reason: 'Enterprise contractual discount',
      };
      const result = await controller.applyDiscountOrCredit(
        'sub-1',
        dto,
        mockReq,
      );
      expect(mockService.applyDiscountOrCredit).toHaveBeenCalledWith(
        'sub-1',
        dto,
        mockActor,
        '127.0.0.1',
        'TestAgent',
      );
      expect(result).toEqual({ data: { id: 'sub-1' } });
    });

    it('pauseSubscription and resumeSubscription delegate to service', async () => {
      mockService.pauseSubscription.mockResolvedValueOnce({
        id: 'sub-1',
        status: 'paused',
      });
      mockService.resumeSubscription.mockResolvedValueOnce({
        id: 'sub-1',
        status: 'active',
      });

      const pauseDto = { reason: 'Tenant migration hiatus' };
      const pauseRes = await controller.pauseSubscription(
        'sub-1',
        pauseDto,
        mockReq,
      );
      expect(mockService.pauseSubscription).toHaveBeenCalled();
      expect(pauseRes.data.status).toBe('paused');

      const resumeRes = await controller.resumeSubscription('sub-1', {}, mockReq);
      expect(mockService.resumeSubscription).toHaveBeenCalled();
      expect(resumeRes.data.status).toBe('active');
    });

    it('cancelSubscription delegates to service', async () => {
      mockService.cancelSubscription.mockResolvedValueOnce({
        id: 'sub-1',
        status: 'cancelled',
      });
      const cancelDto = {
        cancelImmediately: true,
        reason: 'Client company insolvency',
      };
      const result = await controller.cancelSubscription(
        'sub-1',
        cancelDto,
        mockReq,
      );
      expect(mockService.cancelSubscription).toHaveBeenCalledWith(
        'sub-1',
        cancelDto,
        mockActor,
        '127.0.0.1',
        'TestAgent',
      );
      expect(result.data.status).toBe('cancelled');
    });
  });

  describe('Role-gating enforcement (Billing Admin, Platform Admin, Platform Owner)', () => {
    function createMockContext(user: any, handler: any): ExecutionContext {
      return {
        getHandler: () => handler,
        getClass: () => PlatformSubscriptionsController,
        switchToHttp: () => ({
          getRequest: () => ({ platformUser: user }),
        }),
      } as unknown as ExecutionContext;
    }

    it('allows Platform Owner unconditionally', () => {
      const ownerUser = {
        roleName: 'Platform Owner',
        permissions: [],
      };
      const ctx = createMockContext(ownerUser, controller.changePlan);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows Platform Admin with platform:manage permission', () => {
      const adminUser = {
        roleName: 'Platform Admin',
        permissions: [{ module: 'platform', action: 'manage' }],
      };
      const ctx = createMockContext(adminUser, controller.changePlan);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows Billing Admin with billing:edit permission for actions', () => {
      const billingUser = {
        roleName: 'Billing Admin',
        permissions: [
          { module: 'billing', action: 'view' },
          { module: 'billing', action: 'edit' },
        ],
      };
      const ctx = createMockContext(billingUser, controller.changePlan);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows Billing Admin with billing:view permission for list/detail', () => {
      const billingUser = {
        roleName: 'Billing Admin',
        permissions: [{ module: 'billing', action: 'view' }],
      };
      const ctx = createMockContext(billingUser, controller.listSubscriptions);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('blocks Support Agent without billing:edit from performing actions', () => {
      const supportUser = {
        roleName: 'Support Agent',
        permissions: [
          { module: 'support', action: 'manage' },
          { module: 'tenant', action: 'view' },
        ],
      };
      const ctx = createMockContext(supportUser, controller.changePlan);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('blocks Read-Only Auditor from performing actions', () => {
      const auditorUser = {
        roleName: 'Read-Only Auditor',
        permissions: [{ module: 'audit', action: 'view' }],
      };
      const ctx = createMockContext(auditorUser, controller.changePlan);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('blocks unauthenticated requests', () => {
      const ctx = createMockContext(undefined, controller.changePlan);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });
});
