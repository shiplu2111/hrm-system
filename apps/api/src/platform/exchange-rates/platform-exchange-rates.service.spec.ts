import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PlatformRateSource } from '@prisma/client';
import { PlatformExchangeRatesService } from './platform-exchange-rates.service';
import { ManualRateProvider } from './providers/manual-rate.provider';
import { PlatformFxRateProvider } from './providers/platform-fx.provider';

describe('PlatformExchangeRatesService', () => {
  let service: PlatformExchangeRatesService;
  let mockPrisma: any;
  let mockAudit: any;
  let manualProvider: ManualRateProvider;
  let platformFxProvider: PlatformFxRateProvider;

  beforeEach(() => {
    mockPrisma = {
      unscoped: {
        platformExchangeRate: {
          count: jest.fn(),
          create: jest.fn(),
          findMany: jest.fn(),
          findFirst: jest.fn(),
          update: jest.fn(),
        },
        $transaction: jest.fn((cb) => cb(mockPrisma.unscoped)),
      },
    };

    mockAudit = {
      log: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };

    manualProvider = new ManualRateProvider();
    platformFxProvider = new PlatformFxRateProvider();

    service = new PlatformExchangeRatesService(
      mockPrisma,
      manualProvider,
      platformFxProvider,
      mockAudit,
    );
  });

  describe('seedBaselineRatesIfEmpty', () => {
    it('seeds standard baseline currency pairs if table is empty', async () => {
      mockPrisma.unscoped.platformExchangeRate.count.mockResolvedValue(0);
      mockPrisma.unscoped.platformExchangeRate.create.mockResolvedValue({ id: 'seeded-1' });

      await service.seedBaselineRatesIfEmpty();

      expect(mockPrisma.unscoped.platformExchangeRate.count).toHaveBeenCalled();
      expect(mockPrisma.unscoped.platformExchangeRate.create).toHaveBeenCalled();
    });

    it('skips seeding if records already exist', async () => {
      mockPrisma.unscoped.platformExchangeRate.count.mockResolvedValue(12);

      await service.seedBaselineRatesIfEmpty();

      expect(mockPrisma.unscoped.platformExchangeRate.create).not.toHaveBeenCalled();
    });
  });

  describe('listPairs', () => {
    it('summarizes currency pairs and identifies active rate and override count', async () => {
      const now = new Date();
      const row1 = {
        id: 'r1',
        baseCurrency: 'AUD',
        quoteCurrency: 'USD',
        rate: new Decimal('1.54200000'),
        inverseRate: new Decimal('0.64850843'),
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        source: PlatformRateSource.provider,
        providerName: 'platform_fx_feed',
        overrideReason: null,
        notes: null,
        createdByUserId: null,
        createdAt: now,
        updatedAt: now,
      };

      const row2 = {
        id: 'r2',
        baseCurrency: 'AUD',
        quoteCurrency: 'USD',
        rate: new Decimal('1.55000000'),
        inverseRate: new Decimal('0.64516129'),
        effectiveFrom: new Date('2026-06-01'),
        effectiveTo: null,
        source: PlatformRateSource.manual_override,
        providerName: 'manual_override',
        overrideReason: 'Official gazette rate',
        notes: null,
        createdByUserId: null,
        createdAt: now,
        updatedAt: now,
      };

      mockPrisma.unscoped.platformExchangeRate.findMany.mockResolvedValue([row2, row1]);

      const pairs = await service.listPairs();

      expect(pairs).toHaveLength(1);
      expect(pairs[0].baseCurrency).toBe('AUD');
      expect(pairs[0].quoteCurrency).toBe('USD');
      expect(pairs[0].versionCount).toBe(2);
      expect(pairs[0].overrideCount).toBe(1);
      expect(pairs[0].status).toBe('active');
    });
  });

  describe('getPairHistory', () => {
    it('returns full rate-history table in chronological order', async () => {
      const row = {
        id: 'hist-1',
        baseCurrency: 'USD',
        quoteCurrency: 'BDT',
        rate: new Decimal('121.50000000'),
        inverseRate: new Decimal('0.00823045'),
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        source: PlatformRateSource.provider,
        providerName: 'platform_fx_feed',
        overrideReason: null,
        notes: 'Benchmark',
        createdByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.unscoped.platformExchangeRate.findMany.mockResolvedValue([row]);

      const history = await service.getPairHistory('USD', 'BDT');

      expect(history).toHaveLength(1);
      expect(history[0].rate).toBe('121.50000000');
      expect(history[0].inverseRate).toBe('0.00823045');
    });
  });

  describe('resolveRate', () => {
    it('returns identity 1.0 when base and quote currency match', async () => {
      const result = await service.resolveRate('AUD', 'AUD');

      expect(result.rate).toBe('1.00000000');
      expect(result.source).toBe('identity');
      expect(result.id).toBeNull();
    });

    it('resolves active platform default rate directly', async () => {
      const match = {
        id: 'match-1',
        baseCurrency: 'AUD',
        quoteCurrency: 'USD',
        rate: new Decimal('1.54200000'),
        inverseRate: new Decimal('0.64850843'),
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        source: PlatformRateSource.provider,
        providerName: 'platform_fx_feed',
        overrideReason: null,
      };

      mockPrisma.unscoped.platformExchangeRate.findFirst.mockResolvedValue(match);

      const result = await service.resolveRate('AUD', 'USD', '2026-03-15');

      expect(result.rate).toBe('1.54200000');
      expect(result.source).toBe('platform_default');
    });

    it('identifies manual override in source', async () => {
      const match = {
        id: 'match-ov',
        baseCurrency: 'AUD',
        quoteCurrency: 'USD',
        rate: new Decimal('1.56000000'),
        inverseRate: new Decimal('0.64102564'),
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        source: PlatformRateSource.manual_override,
        providerName: 'manual_override',
        overrideReason: 'Platform policy override',
      };

      mockPrisma.unscoped.platformExchangeRate.findFirst.mockResolvedValue(match);

      const result = await service.resolveRate('AUD', 'USD', '2026-03-15');

      expect(result.rate).toBe('1.56000000');
      expect(result.source).toBe('platform_manual_override');
      expect(result.overrideReason).toBe('Platform policy override');
    });

    it('throws NotFoundException when no rate is found', async () => {
      mockPrisma.unscoped.platformExchangeRate.findFirst.mockResolvedValue(null);

      await expect(service.resolveRate('XYZ', 'ABC')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createManualOverride', () => {
    it('requires a reason of at least 5 characters', async () => {
      await expect(
        service.createManualOverride({
          baseCurrency: 'AUD',
          quoteCurrency: 'USD',
          rate: 1.55,
          effectiveFrom: '2026-11-23',
          reason: 'abc', // too short
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates manual override record without destroying historical rates', async () => {
      const prevOpen = {
        id: 'prev-1',
        effectiveFrom: new Date('2026-01-01T00:00:00Z'),
        effectiveTo: null,
      };

      mockPrisma.unscoped.platformExchangeRate.findFirst.mockResolvedValue(prevOpen);
      mockPrisma.unscoped.platformExchangeRate.update.mockResolvedValue({ ...prevOpen, effectiveTo: new Date('2026-11-22') });
      mockPrisma.unscoped.platformExchangeRate.create.mockResolvedValue({
        id: 'new-ov-1',
        baseCurrency: 'AUD',
        quoteCurrency: 'USD',
        rate: new Decimal('1.55500000'),
        inverseRate: new Decimal('0.64308682'),
        effectiveFrom: new Date('2026-11-23T00:00:00Z'),
        effectiveTo: null,
        source: PlatformRateSource.manual_override,
        providerName: 'manual_override',
        overrideReason: 'Official central bank fixing rate',
        notes: null,
        createdByUserId: 'user-admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.createManualOverride(
        {
          baseCurrency: 'AUD',
          quoteCurrency: 'USD',
          rate: '1.55500000',
          effectiveFrom: '2026-11-23',
          reason: 'Official central bank fixing rate',
        },
        'user-admin',
      );

      expect(mockPrisma.unscoped.platformExchangeRate.update).toHaveBeenCalled();
      expect(mockPrisma.unscoped.platformExchangeRate.create).toHaveBeenCalled();
      expect(result.rate).toBe('1.55500000');
      expect(result.overrideReason).toBe('Official central bank fixing rate');
      expect(mockAudit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'manual_override',
          reason: 'Official central bank fixing rate',
        }),
      );
    });
  });

  describe('listProviders', () => {
    it('returns supported rate providers including platform FX benchmark', () => {
      const providers = service.listProviders();

      expect(providers.length).toBeGreaterThanOrEqual(2);
      expect(providers.some((p) => p.providerId === 'platform_fx_feed')).toBe(true);
      expect(providers.some((p) => p.providerId === 'manual')).toBe(true);
    });
  });
});
