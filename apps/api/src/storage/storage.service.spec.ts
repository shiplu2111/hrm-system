import { ForbiddenException } from '@nestjs/common';
import type { FeatureGateService } from '../billing/feature-gate.service';
import { StorageService } from './storage.service';
import type { FileMeta, StorageDriver } from './storage.types';

describe('StorageService', () => {
  let service: StorageService;
  let mockDriver: jest.Mocked<StorageDriver>;
  let mockFeatureGate: {
    assertWithinLimit: jest.Mock;
    withinLimit: jest.Mock;
    hasFeature: jest.Mock;
  };

  beforeEach(() => {
    mockDriver = {
      upload: jest.fn().mockResolvedValue('tenant-1/documents/emp-1/file.pdf'),
      getUrl: jest.fn().mockResolvedValue('https://storage.local/file.pdf'),
      delete: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(true),
      read: jest.fn().mockResolvedValue({
        buffer: Buffer.from('test file content'),
        meta: { originalName: 'file.pdf', contentType: 'application/pdf', size: 17 },
      }),
    };

    mockFeatureGate = {
      assertWithinLimit: jest.fn().mockResolvedValue(undefined),
      withinLimit: jest.fn().mockResolvedValue(true),
      hasFeature: jest.fn().mockResolvedValue(true),
    };

    service = new StorageService(
      mockDriver,
      mockFeatureGate as unknown as FeatureGateService,
    );
  });

  describe('upload', () => {
    const meta: FileMeta = {
      originalName: 'contract.pdf',
      contentType: 'application/pdf',
      size: 1024,
    };
    const fileBuffer = Buffer.alloc(1024);

    it('enforces storage limit via FeatureGate on upload', async () => {
      const key = 'tenant-1/contracts/contract-1/file.pdf';
      await service.upload(key, fileBuffer, meta);

      expect(mockFeatureGate.assertWithinLimit).toHaveBeenCalledWith(
        'tenant-1',
        'storage_gb',
        fileBuffer.byteLength / (1024 * 1024 * 1024),
      );
      expect(mockDriver.upload).toHaveBeenCalledWith(key, fileBuffer, meta);
    });

    it('uses explicitTenantId when provided', async () => {
      const key = 'custom-key/file.pdf';
      await service.upload(key, fileBuffer, meta, 'explicit-tenant-uuid');

      expect(mockFeatureGate.assertWithinLimit).toHaveBeenCalledWith(
        'explicit-tenant-uuid',
        'storage_gb',
        fileBuffer.byteLength / (1024 * 1024 * 1024),
      );
    });

    it('throws ForbiddenException PLAN_LIMIT_REACHED when storage limit is exceeded', async () => {
      mockFeatureGate.assertWithinLimit.mockRejectedValue(
        new ForbiddenException({
          code: 'PLAN_LIMIT_REACHED',
          message:
            'Your Starter plan storage limit of 10 GB has been reached (10.00 GB in use). Upgrade your plan to Business or Enterprise to upload more files.',
          upgradeHint: 'Upgrade your plan to Business or Enterprise to upload more files.',
          details: [{ field: 'storage_gb', message: 'Upgrade your plan to Business or Enterprise to upload more files.' }],
        }),
      );

      const key = 'tenant-1/documents/emp-1/large.pdf';
      await expect(service.upload(key, fileBuffer, meta)).rejects.toMatchObject({
        response: {
          code: 'PLAN_LIMIT_REACHED',
          message: expect.stringContaining('storage limit'),
          upgradeHint: expect.stringContaining('Upgrade your plan'),
          details: [{ field: 'storage_gb', message: expect.stringContaining('Upgrade') }],
        },
      });

      expect(mockDriver.upload).not.toHaveBeenCalled();
    });

    it('works cleanly when FeatureGate is omitted', async () => {
      const unmanagedService = new StorageService(mockDriver);
      const key = 'tenant-1/documents/emp-1/file.pdf';
      await expect(unmanagedService.upload(key, fileBuffer, meta)).resolves.toBe(
        'tenant-1/documents/emp-1/file.pdf',
      );
      expect(mockDriver.upload).toHaveBeenCalled();
    });
  });

  describe('key generators', () => {
    it('builds employee document key with tenantId prefix', () => {
      const key = service.buildEmployeeDocumentKey('t-123', 'emp-456', 'photo.png');
      expect(key.startsWith('t-123/documents/emp-456/')).toBe(true);
      expect(key.endsWith('.png')).toBe(true);
    });

    it('builds payslip key with tenantId prefix', () => {
      const key = service.buildPayslipKey('t-123', 'pr-456');
      expect(key.startsWith('t-123/payslips/pr-456/')).toBe(true);
      expect(key.endsWith('.pdf')).toBe(true);
    });

    it('builds expense receipt key with tenantId prefix', () => {
      const key = service.buildExpenseReceiptKey('t-123', 'claim-456', 'receipt.jpg');
      expect(key.startsWith('t-123/expenses/claim-456/')).toBe(true);
      expect(key.endsWith('.jpg')).toBe(true);
    });
  });
});
