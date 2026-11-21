import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { PlatformInvoicesController } from './platform-invoices.controller';
import { PlatformInvoicesService } from './platform-invoices.service';

describe('PlatformInvoicesController and Role-Gating', () => {
  let controller: PlatformInvoicesController;
  let guard: PlatformPermissionsGuard;

  const mockService = {
    listInvoices: jest.fn(),
    getInvoiceDetail: jest.fn(),
    getOrGeneratePdf: jest.fn(),
    resendInvoiceEmail: jest.fn(),
    markAsPaidManually: jest.fn(),
    issueCreditNote: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlatformInvoicesController],
      providers: [
        {
          provide: PlatformInvoicesService,
          useValue: mockService,
        },
        Reflector,
        PlatformPermissionsGuard,
      ],
    })
      .overrideGuard(PlatformAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PlatformInvoicesController>(
      PlatformInvoicesController,
    );
    guard = module.get<PlatformPermissionsGuard>(PlatformPermissionsGuard);
    jest.clearAllMocks();
  });

  describe('Endpoints delegation', () => {
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

    it('listInvoices delegates to service and wraps in data envelope', async () => {
      mockService.listInvoices.mockResolvedValueOnce([{ id: 'inv-1' }]);
      const result = await controller.listInvoices({ status: 'open' as any });
      expect(mockService.listInvoices).toHaveBeenCalledWith({ status: 'open' });
      expect(result).toEqual({ data: [{ id: 'inv-1' }] });
    });

    it('getInvoice delegates to service and wraps in data envelope', async () => {
      mockService.getInvoiceDetail.mockResolvedValueOnce({ id: 'inv-1' });
      const result = await controller.getInvoice('inv-1');
      expect(mockService.getInvoiceDetail).toHaveBeenCalledWith('inv-1');
      expect(result).toEqual({ data: { id: 'inv-1' } });
    });

    it('downloadPdf sends file stream with attachment disposition', async () => {
      mockService.getOrGeneratePdf.mockResolvedValueOnce({
        buffer: Buffer.from('%PDF'),
        filename: 'INV-001.pdf',
        mimeType: 'application/pdf',
      });

      const mockRes: any = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await controller.downloadPdf('inv-1', mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/pdf',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="INV-001.pdf"',
      );
      expect(mockRes.send).toHaveBeenCalled();
    });

    it('resendInvoiceEmail delegates to service with actor info', async () => {
      mockService.resendInvoiceEmail.mockResolvedValueOnce({
        success: true,
        recipient: 'tenant@test.com',
        sent: true,
      });

      const result = await controller.resendInvoiceEmail(
        'inv-1',
        { recipientEmail: 'tenant@test.com' },
        mockReq,
      );

      expect(mockService.resendInvoiceEmail).toHaveBeenCalledWith(
        'inv-1',
        { recipientEmail: 'tenant@test.com' },
        mockActor,
        '127.0.0.1',
        'TestAgent',
      );
      expect(result.data.success).toBe(true);
    });

    it('markAsPaid delegates to service with actor info', async () => {
      mockService.markAsPaidManually.mockResolvedValueOnce({
        id: 'inv-1',
        status: 'paid',
      });

      const result = await controller.markAsPaid(
        'inv-1',
        { reason: 'Check deposit verified' },
        mockReq,
      );

      expect(mockService.markAsPaidManually).toHaveBeenCalledWith(
        'inv-1',
        { reason: 'Check deposit verified' },
        mockActor,
        '127.0.0.1',
        'TestAgent',
      );
      expect(result.data.status).toBe('paid');
    });

    it('issueCreditNote delegates to service with actor info', async () => {
      mockService.issueCreditNote.mockResolvedValueOnce({
        id: 'inv-1',
        amountDue: 29,
      });

      const result = await controller.issueCreditNote(
        'inv-1',
        { amount: 30, reason: 'Overcharge adjustment' },
        mockReq,
      );

      expect(mockService.issueCreditNote).toHaveBeenCalledWith(
        'inv-1',
        { amount: 30, reason: 'Overcharge adjustment' },
        mockActor,
        '127.0.0.1',
        'TestAgent',
      );
      expect(result.data.amountDue).toBe(29);
    });
  });

  describe('Role-gating enforcement', () => {
    function createMockContext(user: any, handler: any): ExecutionContext {
      return {
        getHandler: () => handler,
        getClass: () => PlatformInvoicesController,
        switchToHttp: () => ({
          getRequest: () => ({ platformUser: user }),
        }),
      } as unknown as ExecutionContext;
    }

    it('allows Platform Owner unconditionally for actions', () => {
      const ownerUser = { roleName: 'Platform Owner', permissions: [] };
      const ctx = createMockContext(ownerUser, controller.markAsPaid);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows Platform Admin with platform:manage permission', () => {
      const adminUser = {
        roleName: 'Platform Admin',
        permissions: [{ module: 'platform', action: 'manage' }],
      };
      const ctx = createMockContext(adminUser, controller.issueCreditNote);
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
      const ctx = createMockContext(billingUser, controller.markAsPaid);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('allows Billing Admin with billing:view permission for list/detail/pdf', () => {
      const billingUser = {
        roleName: 'Billing Admin',
        permissions: [{ module: 'billing', action: 'view' }],
      };
      const ctx = createMockContext(billingUser, controller.listInvoices);
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('blocks Support Agent without billing:edit from marking as paid', () => {
      const supportUser = {
        roleName: 'Support Agent',
        permissions: [{ module: 'support', action: 'manage' }],
      };
      const ctx = createMockContext(supportUser, controller.markAsPaid);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('blocks unauthenticated requests', () => {
      const ctx = createMockContext(undefined, controller.listInvoices);
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });
});
