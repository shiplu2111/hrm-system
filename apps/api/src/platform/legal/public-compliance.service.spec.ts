import { Test, TestingModule } from '@nestjs/testing';
import { StorageService } from '../../storage/storage.service';
import { PlatformSettingsService } from '../settings/platform-settings.service';
import { PublicComplianceService } from './public-compliance.service';

describe('PublicComplianceService (DPA PDF & Subprocessors)', () => {
  let service: PublicComplianceService;

  const mockSettings = {
    getAllSettings: jest.fn(),
  };

  const storedFiles = new Map<string, { buffer: Buffer; meta: any }>();
  const mockStorage = {
    exists: jest.fn(async (key: string) => storedFiles.has(key)),
    read: jest.fn(async (key: string) => storedFiles.get(key)!),
    uploadPlatformAsset: jest.fn(async (key: string, buffer: Buffer, meta: any) => {
      storedFiles.set(key, { buffer, meta });
      return key;
    }),
  };

  beforeEach(async () => {
    storedFiles.clear();
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicComplianceService,
        { provide: PlatformSettingsService, useValue: mockSettings },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = module.get(PublicComplianceService);
  });

  it('generates and stores the DPA PDF via FileStorage driver and serves the persisted bytes', async () => {
    const meta = await service.getDpaMetadata();

    expect(meta.filename).toBe('CMSN-HR-DPA-2026-11.pdf');
    expect(meta.storageKey).toBe('platform/legal/cmsn-hr-dpa-2026-11.pdf');
    expect(meta.byteSize).toBeGreaterThan(500);
    expect(mockStorage.uploadPlatformAsset).toHaveBeenCalledTimes(1);

    // Second request reads directly from FileStorage without re-uploading
    const downloaded = await service.getDpaPdfFile();
    expect(downloaded.contentType).toBe('application/pdf');
    expect(downloaded.buffer.slice(0, 4).toString('utf8')).toBe('%PDF');
    expect(mockStorage.uploadPlatformAsset).toHaveBeenCalledTimes(1);
    expect(mockStorage.read).toHaveBeenCalledTimes(1);
  });

  it('lists ONLY configured subprocessors matching platform settings', async () => {
    mockSettings.getAllSettings.mockResolvedValueOnce({
      email: {
        configured: true,
        provider: 'smtp',
        host: 'smtp.sendgrid.net',
        updatedAt: '2026-11-25T10:00:00.000Z',
      },
      sms: {
        configured: false,
        provider: 'twilio',
        updatedAt: null,
      },
      push: {
        configured: true,
        provider: 'firebase',
        updatedAt: '2026-11-24T09:00:00.000Z',
      },
      storage: {
        configured: false,
        storageDriver: 'local',
        updatedAt: null,
      },
      billing: {
        configured: true,
        provider: 'stripe',
        updatedAt: '2026-11-23T08:00:00.000Z',
      },
    });

    const result = await service.getSubprocessorsOverview();
    const names = result.subprocessors.map((s) => s.name);

    expect(names).toContain('SendGrid (Twilio)');
    expect(names).toContain('Google Firebase Cloud Messaging (FCM)');
    expect(names).toContain('Stripe, Inc.');

    // Unconfigured SMS, S3, and Error Tracking must NOT appear as active vendors
    expect(names.some((n) => n.includes('Twilio SMS'))).toBe(false);
    expect(names.some((n) => n.includes('Amazon Web Services'))).toBe(false);
    expect(names.some((n) => n.includes('Sentry'))).toBe(false);
    expect(result.unconfiguredCategories.map((c) => c.category)).toEqual(
      expect.arrayContaining(['hosting', 'sms', 'error_tracking']),
    );
  });
});
