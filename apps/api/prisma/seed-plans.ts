import { PrismaClient } from '@prisma/client';

export interface PlanSeedDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  rank: number;
  features: Record<string, boolean>;
  limits: Record<string, number | null>;
  prices: Array<{
    currency: string;
    billingCycle: 'monthly' | 'annual';
    amount: number;
    perSeatAmount?: number | null;
  }>;
}

export const SEED_PLANS: PlanSeedDefinition[] = [
  {
    id: '10000000-0000-4000-8000-000000000701',
    code: 'free',
    name: 'Free',
    description: 'Limited employees, core HR only (BILLING_SUBSCRIPTION.md §1)',
    rank: 0,
    features: {
      core_hr: true,
      attendance: false,
      leave: false,
      basic_payroll: false,
      roster: false,
      timesheets: false,
      advanced_reports: false,
      api_access: false,
      sso: false,
      custom_payroll_rules: false,
      advanced_workflow: false,
    },
    limits: {
      employees: 10,
      storage_gb: 1,
      api_calls: 0,
      companies: 1,
    },
    prices: [
      { currency: 'USD', billingCycle: 'monthly', amount: 0, perSeatAmount: 0 },
      { currency: 'USD', billingCycle: 'annual', amount: 0, perSeatAmount: 0 },
      { currency: 'AUD', billingCycle: 'monthly', amount: 0, perSeatAmount: 0 },
      { currency: 'AUD', billingCycle: 'annual', amount: 0, perSeatAmount: 0 },
      { currency: 'EUR', billingCycle: 'monthly', amount: 0, perSeatAmount: 0 },
      { currency: 'EUR', billingCycle: 'annual', amount: 0, perSeatAmount: 0 },
      { currency: 'GBP', billingCycle: 'monthly', amount: 0, perSeatAmount: 0 },
      { currency: 'GBP', billingCycle: 'annual', amount: 0, perSeatAmount: 0 },
      { currency: 'BDT', billingCycle: 'monthly', amount: 0, perSeatAmount: 0 },
      { currency: 'BDT', billingCycle: 'annual', amount: 0, perSeatAmount: 0 },
    ],
  },
  {
    id: '10000000-0000-4000-8000-000000000702',
    code: 'starter',
    name: 'Starter',
    description: 'Core HR, Attendance, Leave, and Basic Payroll (BILLING_SUBSCRIPTION.md §1)',
    rank: 1,
    features: {
      core_hr: true,
      attendance: true,
      leave: true,
      basic_payroll: true,
      roster: false,
      timesheets: false,
      advanced_reports: false,
      api_access: false,
      sso: false,
      custom_payroll_rules: false,
      advanced_workflow: false,
    },
    limits: {
      employees: 50,
      storage_gb: 10,
      api_calls: 0,
      companies: 1,
    },
    prices: [
      { currency: 'USD', billingCycle: 'monthly', amount: 49.0, perSeatAmount: 2.0 },
      { currency: 'USD', billingCycle: 'annual', amount: 490.0, perSeatAmount: 20.0 },
      { currency: 'AUD', billingCycle: 'monthly', amount: 75.0, perSeatAmount: 3.0 },
      { currency: 'AUD', billingCycle: 'annual', amount: 750.0, perSeatAmount: 30.0 },
      { currency: 'EUR', billingCycle: 'monthly', amount: 45.0, perSeatAmount: 2.0 },
      { currency: 'EUR', billingCycle: 'annual', amount: 450.0, perSeatAmount: 20.0 },
      { currency: 'GBP', billingCycle: 'monthly', amount: 39.0, perSeatAmount: 1.8 },
      { currency: 'GBP', billingCycle: 'annual', amount: 390.0, perSeatAmount: 18.0 },
      { currency: 'BDT', billingCycle: 'monthly', amount: 5000.0, perSeatAmount: 200.0 },
      { currency: 'BDT', billingCycle: 'annual', amount: 50000.0, perSeatAmount: 2000.0 },
    ],
  },
  {
    id: '10000000-0000-4000-8000-000000000703',
    code: 'business',
    name: 'Business',
    description: 'Starter plus Roster, Timesheets, and Advanced Reports (BILLING_SUBSCRIPTION.md §1)',
    rank: 2,
    features: {
      core_hr: true,
      attendance: true,
      leave: true,
      basic_payroll: true,
      roster: true,
      timesheets: true,
      advanced_reports: true,
      api_access: false,
      sso: false,
      custom_payroll_rules: false,
      advanced_workflow: false,
    },
    limits: {
      employees: 250,
      storage_gb: 50,
      api_calls: 1000,
      companies: 3,
    },
    prices: [
      { currency: 'USD', billingCycle: 'monthly', amount: 199.0, perSeatAmount: 4.0 },
      { currency: 'USD', billingCycle: 'annual', amount: 1990.0, perSeatAmount: 40.0 },
      { currency: 'AUD', billingCycle: 'monthly', amount: 299.0, perSeatAmount: 6.0 },
      { currency: 'AUD', billingCycle: 'annual', amount: 2990.0, perSeatAmount: 60.0 },
      { currency: 'EUR', billingCycle: 'monthly', amount: 185.0, perSeatAmount: 3.8 },
      { currency: 'EUR', billingCycle: 'annual', amount: 1850.0, perSeatAmount: 38.0 },
      { currency: 'GBP', billingCycle: 'monthly', amount: 159.0, perSeatAmount: 3.2 },
      { currency: 'GBP', billingCycle: 'annual', amount: 1590.0, perSeatAmount: 32.0 },
      { currency: 'BDT', billingCycle: 'monthly', amount: 20000.0, perSeatAmount: 400.0 },
      { currency: 'BDT', billingCycle: 'annual', amount: 200000.0, perSeatAmount: 4000.0 },
    ],
  },
  {
    id: '10000000-0000-4000-8000-000000000704',
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Full Platform Access: API access, SSO, Advanced Workflow, Custom Payroll Rules (BILLING_SUBSCRIPTION.md §1)',
    rank: 3,
    features: {
      core_hr: true,
      attendance: true,
      leave: true,
      basic_payroll: true,
      roster: true,
      timesheets: true,
      advanced_reports: true,
      api_access: true,
      sso: true,
      custom_payroll_rules: true,
      advanced_workflow: true,
    },
    limits: {
      employees: null, // Unlimited
      storage_gb: null, // Unlimited
      api_calls: null, // Unlimited
      companies: null, // Unlimited
    },
    prices: [
      { currency: 'USD', billingCycle: 'monthly', amount: 599.0, perSeatAmount: 6.0 },
      { currency: 'USD', billingCycle: 'annual', amount: 5990.0, perSeatAmount: 60.0 },
      { currency: 'AUD', billingCycle: 'monthly', amount: 899.0, perSeatAmount: 9.0 },
      { currency: 'AUD', billingCycle: 'annual', amount: 8990.0, perSeatAmount: 90.0 },
      { currency: 'EUR', billingCycle: 'monthly', amount: 550.0, perSeatAmount: 5.5 },
      { currency: 'EUR', billingCycle: 'annual', amount: 5500.0, perSeatAmount: 55.0 },
      { currency: 'GBP', billingCycle: 'monthly', amount: 475.0, perSeatAmount: 4.8 },
      { currency: 'GBP', billingCycle: 'annual', amount: 4750.0, perSeatAmount: 48.0 },
      { currency: 'BDT', billingCycle: 'monthly', amount: 60000.0, perSeatAmount: 600.0 },
      { currency: 'BDT', billingCycle: 'annual', amount: 600000.0, perSeatAmount: 6000.0 },
    ],
  },
];

export async function seedPlans(prisma: PrismaClient): Promise<void> {
  const effectiveFrom = new Date('2026-01-01T00:00:00Z');

  for (const planDef of SEED_PLANS) {
    // 1. Upsert Plan
    const plan = await prisma.plan.upsert({
      where: { code: planDef.code },
      create: {
        id: planDef.id,
        code: planDef.code,
        name: planDef.name,
        description: planDef.description,
        rank: planDef.rank,
        isActive: true,
        isCustom: false,
      },
      update: {
        name: planDef.name,
        description: planDef.description,
        rank: planDef.rank,
        isActive: true,
      },
    });

    // 2. Upsert Features
    for (const [featureKey, enabled] of Object.entries(planDef.features)) {
      await prisma.planFeature.upsert({
        where: {
          planId_featureKey: {
            planId: plan.id,
            featureKey,
          },
        },
        create: {
          planId: plan.id,
          featureKey,
          enabled,
        },
        update: {
          enabled,
        },
      });
    }

    // 3. Upsert Limits
    for (const [limitKey, value] of Object.entries(planDef.limits)) {
      await prisma.planLimit.upsert({
        where: {
          planId_limitKey: {
            planId: plan.id,
            limitKey,
          },
        },
        create: {
          planId: plan.id,
          limitKey,
          value,
        },
        update: {
          value,
        },
      });
    }

    // 4. Upsert Prices (per currency, per billing cycle, effective-dated)
    for (const price of planDef.prices) {
      // Find existing price matching plan, currency, billingCycle and active range
      const existing = await prisma.planPrice.findFirst({
        where: {
          planId: plan.id,
          currency: price.currency,
          billingCycle: price.billingCycle,
          effectiveFrom,
        },
      });

      if (existing) {
        await prisma.planPrice.update({
          where: { id: existing.id },
          data: {
            amount: price.amount,
            perSeatAmount: price.perSeatAmount,
            effectiveTo: null,
          },
        });
      } else {
        await prisma.planPrice.create({
          data: {
            planId: plan.id,
            currency: price.currency,
            billingCycle: price.billingCycle,
            amount: price.amount,
            perSeatAmount: price.perSeatAmount,
            effectiveFrom,
            effectiveTo: null,
          },
        });
      }
    }
  }

  console.log('✅ Seeded 4 subscription plans (Free, Starter, Business, Enterprise) with features, limits, and prices.');
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedPlans(prisma)
    .catch((err) => {
      console.error('Failed to seed plans:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
