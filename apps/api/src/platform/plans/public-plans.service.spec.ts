import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { PublicPlansService } from './public-plans.service';

describe('PublicPlansService', () => {
  let service: PublicPlansService;
  let mockPrisma: any;

  const now = new Date('2026-06-15T00:00:00Z');

  beforeEach(async () => {
    mockPrisma = {
      unscoped: {
        plan: {
          findMany: jest.fn(),
        },
        planPrice: {
          findMany: jest.fn(),
        },
        country: {
          findMany: jest.fn(),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicPlansService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<PublicPlansService>(PublicPlansService);
  });

  describe('listPublicPlans', () => {
    it('queries only public non-custom plans and returns customer-friendly labels without internal refs or tenant data', async () => {
      mockPrisma.unscoped.plan.findMany.mockResolvedValue([
        {
          id: 'plan-starter-id',
          code: 'starter',
          name: 'Starter',
          description: 'Core HR and Payroll (BILLING_SUBSCRIPTION.md §1)',
          rank: 1,
          features: [
            { featureKey: 'core_hr', enabled: true },
            { featureKey: 'basic_payroll', enabled: true },
            { featureKey: 'sso', enabled: false },
          ],
          limits: [
            { limitKey: 'employees', value: 50 },
            { limitKey: 'storage_gb', value: 10 },
          ],
          prices: [
            // Newer effective price comes first due to effectiveFrom desc ordering
            {
              currency: 'USD',
              billingCycle: 'monthly',
              amount: '59.00',
              perSeatAmount: '2.50',
              effectiveFrom: new Date('2026-06-01T00:00:00Z'),
            },
            {
              currency: 'USD',
              billingCycle: 'monthly',
              amount: '49.00',
              perSeatAmount: '2.00',
              effectiveFrom: new Date('2026-01-01T00:00:00Z'),
            },
            {
              currency: 'AUD',
              billingCycle: 'monthly',
              amount: '89.00',
              perSeatAmount: '3.50',
              effectiveFrom: new Date('2026-06-01T00:00:00Z'),
            },
          ],
        },
      ]);

      const plans = await service.listPublicPlans(now);

      expect(mockPrisma.unscoped.plan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true, isCustom: false },
        }),
      );
      expect(plans).toHaveLength(1);
      const starter = plans[0];

      // Strips internal specification references from public description
      expect(starter.description).toBe('Core HR and Payroll');
      expect(starter.description).not.toContain('BILLING_SUBSCRIPTION');

      // Friendly labels for features and limits
      expect(starter.features).toEqual([
        { key: 'core_hr', label: 'Core HR & Employee Directory', included: true },
        { key: 'basic_payroll', label: 'Payroll & Statutory Deductions', included: true },
        { key: 'sso', label: 'Single Sign-On (SAML / OIDC)', included: false },
      ]);
      expect(starter.limits).toEqual([
        { key: 'employees', label: 'Active employees', value: 50 },
        { key: 'storage_gb', label: 'Document storage (GB)', value: 10 },
      ]);

      // Deduplicated active prices pick the latest effectiveFrom price
      expect(starter.prices).toEqual([
        {
          currency: 'USD',
          billingCycle: 'monthly',
          amount: 59,
          perSeatAmount: 2.5,
          effectiveFrom: '2026-06-01T00:00:00.000Z',
        },
        {
          currency: 'AUD',
          billingCycle: 'monthly',
          amount: 89,
          perSeatAmount: 3.5,
          effectiveFrom: '2026-06-01T00:00:00.000Z',
        },
      ]);

      // Pricing model mirrors BillingInvoicingService (base + per extra seat over 10)
      expect(starter.pricingModel).toBe('base_plus_employee');
      expect(starter.includedSeats).toBe(10);

      // No internal/tenant fields leaked
      expect((starter as any).isActive).toBeUndefined();
      expect((starter as any).isCustom).toBeUndefined();
      expect((starter as any).subscriptions).toBeUndefined();
    });
  });

  describe('listPublicCurrencies', () => {
    beforeEach(() => {
      mockPrisma.unscoped.planPrice.findMany.mockResolvedValue([
        { currency: 'AUD' },
        { currency: 'BDT' },
        { currency: 'USD' },
      ]);
      mockPrisma.unscoped.country.findMany.mockResolvedValue([
        { isoCode: 'AU', name: 'Australia', currency: 'AUD' },
        { isoCode: 'BD', name: 'Bangladesh', currency: 'BDT' },
      ]);
    });

    it('resolves AUD when visitor country is AU and BDT when country is bangladesh', async () => {
      const auResult = await service.listPublicCurrencies('AU', now);
      expect(auResult.meta.detectedCountry).toBe('AU');
      expect(auResult.meta.defaultCurrency).toBe('AUD');

      const bdResult = await service.listPublicCurrencies('bangladesh', now);
      expect(bdResult.meta.defaultCurrency).toBe('BDT');
    });

    it('falls back to USD when visitor country is missing or unmapped', async () => {
      const unknownResult = await service.listPublicCurrencies('ZZ', now);
      expect(unknownResult.meta.defaultCurrency).toBe('USD');

      const noneResult = await service.listPublicCurrencies(null, now);
      expect(noneResult.meta.defaultCurrency).toBe('USD');
      expect(noneResult.currencies.map((c) => c.code)).toEqual(['USD', 'AUD', 'BDT']);
    });
  });
});
