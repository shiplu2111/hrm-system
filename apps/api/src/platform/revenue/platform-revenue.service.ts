import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  MonthlyRevenueMovement,
  PlatformRevenueReportView,
  RevenueByCountryItem,
  RevenueByPlanItem,
} from '@hrm/shared-types';

@Injectable()
export class PlatformRevenueService {
  private readonly logger = new Logger(PlatformRevenueService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to compute monthly recurring revenue for a single subscription
   */
  public computeSubscriptionMrr(sub: {
    status?: string;
    billingCycle: string;
    discountPercent?: any;
    plan?: {
      code?: string;
      name?: string;
      prices?: Array<{
        billingCycle: string;
        amount: any;
        currency?: string;
      }>;
    };
  }): number {
    if (sub.status && !['active', 'past_due'].includes(sub.status)) {
      return 0;
    }
    if (!sub.plan || !sub.plan.prices || sub.plan.prices.length === 0) {
      return 0;
    }

    const price =
      sub.plan.prices.find((p) => p.billingCycle === sub.billingCycle) ||
      sub.plan.prices[0];

    const baseAmount = Number(price.amount) || 0;
    const monthlyRate =
      sub.billingCycle === 'annual' ? baseAmount / 12 : baseAmount;

    const discount = sub.discountPercent ? Number(sub.discountPercent) : 0;
    const effectiveMonthly = Math.max(0, monthlyRate * (1 - discount / 100));

    return Number(effectiveMonthly.toFixed(2));
  }

  /**
   * Generates aggregate platform revenue report
   */
  async getRevenueReport(): Promise<PlatformRevenueReportView> {
    const now = new Date();

    // 1. Fetch all active and past_due subscriptions with plan, prices, and tenant country
    const subscriptions = await this.prisma.unscoped.subscription.findMany({
      include: {
        plan: {
          include: {
            prices: true,
          },
        },
        tenant: {
          include: {
            companies: {
              include: {
                country: true,
              },
            },
          },
        },
      },
    });

    // 2. Fetch subscription changes for historical cohort calculations
    const subscriptionChanges =
      await this.prisma.unscoped.subscriptionChange.findMany({
        orderBy: { createdAt: 'asc' },
      });

    // Calculate current MRR and ARR
    let currentMrr = 0;
    const activeSubs = subscriptions.filter((s) =>
      ['active', 'past_due'].includes(s.status),
    );

    const planAggregationMap = new Map<
      string,
      {
        planId: string;
        planName: string;
        planCode: string;
        planTier: string;
        count: number;
        totalMrr: number;
      }
    >();

    const countryAggregationMap = new Map<
      string,
      {
        countryCode: string;
        countryName: string;
        count: number;
        totalMrr: number;
      }
    >();

    for (const sub of activeSubs) {
      const subMrr = this.computeSubscriptionMrr(sub);
      currentMrr += subMrr;

      // Plan aggregation
      const planId = sub.planId;
      const planCode = sub.plan?.code || 'unknown';
      const planName = sub.plan?.name || 'Standard Plan';
      const existingPlan = planAggregationMap.get(planId) || {
        planId,
        planName,
        planCode,
        planTier: planCode.toUpperCase(),
        count: 0,
        totalMrr: 0,
      };
      existingPlan.count += 1;
      existingPlan.totalMrr += subMrr;
      planAggregationMap.set(planId, existingPlan);

      // Country aggregation
      const firstCompany = sub.tenant?.companies?.[0];
      const countryCode = firstCompany?.country?.isoCode || 'GLO';
      const countryName = firstCompany?.country?.name || 'Global / Other';

      const existingCountry = countryAggregationMap.get(countryCode) || {
        countryCode,
        countryName,
        count: 0,
        totalMrr: 0,
      };
      existingCountry.count += 1;
      existingCountry.totalMrr += subMrr;
      countryAggregationMap.set(countryCode, existingCountry);
    }

    currentMrr = Number(currentMrr.toFixed(2));
    const currentArr = Number((currentMrr * 12).toFixed(2));

    // Revenue by Plan list
    const revenueByPlan: RevenueByPlanItem[] = Array.from(
      planAggregationMap.values(),
    ).map((item) => ({
      planId: item.planId,
      planName: item.planName,
      planCode: item.planCode,
      planTier: item.planTier,
      activeSubscriptionsCount: item.count,
      totalMrr: Number(item.totalMrr.toFixed(2)),
      percentage:
        currentMrr > 0
          ? Number(((item.totalMrr / currentMrr) * 100).toFixed(1))
          : 0,
    }));

    // Revenue by Country list
    const revenueByCountry: RevenueByCountryItem[] = Array.from(
      countryAggregationMap.values(),
    ).map((item) => ({
      countryCode: item.countryCode,
      countryName: item.countryName,
      activeSubscriptionsCount: item.count,
      totalMrr: Number(item.totalMrr.toFixed(2)),
      percentage:
        currentMrr > 0
          ? Number(((item.totalMrr / currentMrr) * 100).toFixed(1))
          : 0,
    }));

    // Sort by MRR descending
    revenueByPlan.sort((a, b) => b.totalMrr - a.totalMrr);
    revenueByCountry.sort((a, b) => b.totalMrr - a.totalMrr);

    // 3. Generate 12-month cohort movements
    const monthlyMovements: MonthlyRevenueMovement[] = [];
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    // Build the 12 calendar month keys (from 11 months ago to current month)
    const monthKeys: { year: number; month: number; key: string; label: string }[] =
      [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = `${y}-${m.toString().padStart(2, '0')}`;
      const label = `${monthNames[d.getMonth()]} ${y}`;
      monthKeys.push({ year: y, month: m, key, label });
    }

    let rollingMrr = 0;
    let netNewThisMonth = 0;
    let churnedThisMonthCount = 0;

    for (const mObj of monthKeys) {
      const monthStart = new Date(mObj.year, mObj.month - 1, 1);
      const monthEnd = new Date(mObj.year, mObj.month, 0, 23, 59, 59, 999);

      // Subscriptions created in this month
      const subsCreatedThisMonth = subscriptions.filter((s) => {
        const cDate = new Date(s.createdAt);
        return cDate >= monthStart && cDate <= monthEnd;
      });

      // Changes in this month
      const changesThisMonth = subscriptionChanges.filter((c) => {
        const cDate = new Date(c.createdAt);
        return cDate >= monthStart && cDate <= monthEnd;
      });

      // New revenue from newly created active subscriptions
      let newRev = 0;
      for (const s of subsCreatedThisMonth) {
        if (['active', 'past_due'].includes(s.status)) {
          newRev += this.computeSubscriptionMrr(s);
        }
      }

      // Expansion and Contraction and Churn from changes
      let expRev = 0;
      let contRev = 0;
      let chnRev = 0;
      let chnCount = 0;

      for (const chg of changesThisMonth) {
        if (chg.action === 'cancel') {
          const amt = Number(chg.amount) || 0;
          chnRev += amt;
          chnCount += 1;
        } else if (chg.action === 'plan_change' || chg.action === 'upgrade') {
          const amt = Number(chg.amount) || 0;
          if (amt > 0) expRev += amt;
          else if (amt < 0) contRev += Math.abs(amt);
        } else if (chg.action === 'downgrade') {
          const amt = Number(chg.amount) || 0;
          contRev += Math.abs(amt);
        }
      }

      // Also check cancelled subscriptions with canceledAt in this month
      const subsCanceledThisMonth = subscriptions.filter((s) => {
        if (!s.canceledAt) return false;
        const cDate = new Date(s.canceledAt);
        return cDate >= monthStart && cDate <= monthEnd;
      });

      for (const s of subsCanceledThisMonth) {
        if (!changesThisMonth.some((c) => c.action === 'cancel' && c.subscriptionId === s.id)) {
          const subMonthly = this.computeSubscriptionMrr({
            ...s,
            status: 'active', // measure lost MRR
          });
          chnRev += subMonthly;
          chnCount += 1;
        }
      }

      const startingMrr = Number(rollingMrr.toFixed(2));
      const newRevenue = Number(newRev.toFixed(2));
      const expansionRevenue = Number(expRev.toFixed(2));
      const contractionRevenue = Number(contRev.toFixed(2));
      const churnedRevenue = Number(chnRev.toFixed(2));
      const netNewRevenue = Number(
        (newRevenue + expansionRevenue - contractionRevenue - churnedRevenue).toFixed(2),
      );

      // Active subscriptions up to monthEnd
      const activeSubsAtMonth = subscriptions.filter((s) => {
        const cDate = new Date(s.createdAt);
        if (cDate > monthEnd) return false;
        if (s.canceledAt && new Date(s.canceledAt) <= monthEnd) return false;
        return ['active', 'past_due'].includes(s.status);
      }).length;

      rollingMrr = Math.max(0, startingMrr + netNewRevenue);

      // In case rollingMrr is less than current active subs in current month, align to actual
      if (mObj.key === monthKeys[monthKeys.length - 1].key) {
        rollingMrr = currentMrr;
        netNewThisMonth = netNewRevenue;
        churnedThisMonthCount = chnCount;
      }

      monthlyMovements.push({
        month: mObj.key,
        monthLabel: mObj.label,
        startingMrr,
        newRevenue,
        expansionRevenue,
        contractionRevenue,
        churnedRevenue,
        netNewRevenue,
        endingMrr: Number(rollingMrr.toFixed(2)),
        activeSubscriptionsCount: activeSubsAtMonth,
        newSubscriptionsCount: subsCreatedThisMonth.length,
        churnedSubscriptionsCount: chnCount,
      });
    }

    // Customer churn rate & revenue churn rate
    const totalActiveCount = activeSubs.length;
    const customerChurnRate =
      totalActiveCount + churnedThisMonthCount > 0
        ? Number(
            (
              (churnedThisMonthCount /
                (totalActiveCount + churnedThisMonthCount)) *
              100
            ).toFixed(1),
          )
        : 0;

    const currentMonthMovement =
      monthlyMovements[monthlyMovements.length - 1];
    const revenueChurnRate =
      currentMonthMovement.startingMrr > 0
        ? Number(
            (
              (currentMonthMovement.churnedRevenue /
                currentMonthMovement.startingMrr) *
              100
            ).toFixed(1),
          )
        : 0;

    const previousMonthMovement =
      monthlyMovements.length > 1
        ? monthlyMovements[monthlyMovements.length - 2]
        : null;
    const growthRatePercent =
      previousMonthMovement && previousMonthMovement.endingMrr > 0
        ? Number(
            (
              ((currentMrr - previousMonthMovement.endingMrr) /
                previousMonthMovement.endingMrr) *
              100
            ).toFixed(1),
          )
        : currentMrr > 0
          ? 100
          : 0;

    return {
      asOf: now.toISOString(),
      currency: 'USD',
      currentMrr,
      currentArr,
      netNewMrrThisMonth: netNewThisMonth,
      growthRatePercent,
      customerChurnRate,
      revenueChurnRate,
      totalActiveSubscriptions: totalActiveCount,
      monthlyMovements,
      revenueByPlan,
      revenueByCountry,
    };
  }

  /**
   * Generates formatted CSV string for export
   */
  async exportRevenueCsv(): Promise<string> {
    const report = await this.getRevenueReport();
    const lines: string[] = [];

    // Header Metadata
    lines.push('=== PLATFORM REVENUE REPORT ===');
    lines.push(`Generated As Of,${report.asOf}`);
    lines.push(`Reporting Currency,${report.currency}`);
    lines.push(`Current MRR,${report.currentMrr.toFixed(2)}`);
    lines.push(`Current ARR,${report.currentArr.toFixed(2)}`);
    lines.push(`Net New MRR This Month,${report.netNewMrrThisMonth.toFixed(2)}`);
    lines.push(`Monthly Growth Rate,${report.growthRatePercent}%`);
    lines.push(`Customer Churn Rate,${report.customerChurnRate}%`);
    lines.push(`Revenue Churn Rate,${report.revenueChurnRate}%`);
    lines.push(`Total Active Subscriptions,${report.totalActiveSubscriptions}`);
    lines.push('');

    // Section 1: Monthly Movements
    lines.push('=== MONTHLY REVENUE MOVEMENTS (LAST 12 MONTHS) ===');
    lines.push(
      [
        'Month',
        'Period',
        'Starting MRR',
        'New Revenue',
        'Expansion Revenue',
        'Contraction Revenue',
        'Churned Revenue',
        'Net New Revenue',
        'Ending MRR',
        'Active Subscriptions',
        'New Subscriptions',
        'Churned Subscriptions',
      ].join(','),
    );

    for (const m of report.monthlyMovements) {
      lines.push(
        [
          `"${m.month}"`,
          `"${m.monthLabel}"`,
          m.startingMrr.toFixed(2),
          m.newRevenue.toFixed(2),
          m.expansionRevenue.toFixed(2),
          m.contractionRevenue.toFixed(2),
          m.churnedRevenue.toFixed(2),
          m.netNewRevenue.toFixed(2),
          m.endingMrr.toFixed(2),
          m.activeSubscriptionsCount,
          m.newSubscriptionsCount,
          m.churnedSubscriptionsCount,
        ].join(','),
      );
    }
    lines.push('');

    // Section 2: Revenue by Plan
    lines.push('=== REVENUE BY SUBSCRIPTION PLAN ===');
    lines.push(
      [
        'Plan Name',
        'Plan Code',
        'Plan Tier',
        'Active Subscriptions',
        'Total MRR',
        'Share %',
      ].join(','),
    );

    for (const p of report.revenueByPlan) {
      lines.push(
        [
          `"${p.planName}"`,
          `"${p.planCode}"`,
          `"${p.planTier}"`,
          p.activeSubscriptionsCount,
          p.totalMrr.toFixed(2),
          `${p.percentage}%`,
        ].join(','),
      );
    }
    lines.push('');

    // Section 3: Revenue by Country
    lines.push('=== REVENUE BY COUNTRY ===');
    lines.push(
      [
        'Country Name',
        'Country Code',
        'Active Subscriptions',
        'Total MRR',
        'Share %',
      ].join(','),
    );

    for (const c of report.revenueByCountry) {
      lines.push(
        [
          `"${c.countryName}"`,
          `"${c.countryCode}"`,
          c.activeSubscriptionsCount,
          c.totalMrr.toFixed(2),
          `${c.percentage}%`,
        ].join(','),
      );
    }

    return lines.join('\n');
  }
}
