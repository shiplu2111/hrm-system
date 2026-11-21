import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EmploymentStatus, Prisma } from '@prisma/client';
import type {
  PlanChangePreview,
  PlanChangeResult,
  SubscriptionPlanTier,
} from '@hrm/shared-types';
import { PrismaService } from '../database/prisma.service';
import { BillingInvoicingService } from './billing-invoicing.service';
import { FeatureGateService } from './feature-gate.service';
import { PlatformAuditService } from '../platform/audit/platform-audit.service';
import {
  PLAN_COMPANY_LIMITS,
  PLAN_EMPLOYEE_LIMITS,
  PLAN_STORAGE_LIMITS,
} from './plan-features.constants';

const isUuid = (val?: string | null): val is string =>
  typeof val === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

@Injectable()
export class PlanChangeService {
  private readonly logger = new Logger(PlanChangeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicingService: BillingInvoicingService,
    @Optional() private readonly featureGate?: FeatureGateService,
    @Optional() private readonly auditService?: PlatformAuditService,
  ) {}

  /**
   * Previews a requested plan change (upgrade or downgrade).
   * Upgrades compute the exact prorated charge for the remaining cycle duration.
   * Downgrades compute eligibility and list exact reasons if blocked.
   */
  async previewPlanChange(tenantId: string, targetPlanCode: string): Promise<PlanChangePreview> {
    const normalizedTargetCode = targetPlanCode.toLowerCase().trim();

    // 1. Resolve target plan
    const targetPlan = await this.prisma.unscoped.plan.findUnique({
      where: { code: normalizedTargetCode },
      include: {
        limits: true,
        features: true,
        prices: true,
      },
    });

    if (!targetPlan) {
      throw new NotFoundException(`Target plan '${targetPlanCode}' not found`);
    }

    // 2. Resolve tenant & active subscription
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, planId: true, status: true, subdomain: true },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant '${tenantId}' not found`);
    }

    let subscription = await this.prisma.unscoped.subscription.findFirst({
      where: { tenantId, status: { not: 'cancelled' } },
      include: {
        plan: {
          include: { limits: true, features: true, prices: true },
        },
        pendingPlan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // If subscription doesn't exist yet, resolve or create active baseline
    if (!subscription) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      let currentPlan = isUuid(tenant.planId)
        ? await this.prisma.unscoped.plan.findUnique({
            where: { id: tenant.planId },
            include: { limits: true, features: true, prices: true },
          })
        : null;

      if (!currentPlan) {
        currentPlan = await this.prisma.unscoped.plan.findFirst({
          where: { code: 'starter' },
          include: { limits: true, features: true, prices: true },
        });
      }

      if (!currentPlan) {
        throw new NotFoundException('Current plan could not be resolved');
      }

      subscription = await this.prisma.unscoped.subscription.create({
        data: {
          tenantId,
          planId: currentPlan.id,
          status: 'active',
          billingCycle: 'monthly',
          currency: 'USD',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextBillingAt: periodEnd,
        },
        include: {
          plan: {
            include: { limits: true, features: true, prices: true },
          },
          pendingPlan: true,
        },
      });
    }

    const currentPlan = subscription.plan;

    // Same plan
    if (currentPlan.id === targetPlan.id) {
      return {
        changeType: 'same',
        currentPlanCode: currentPlan.code,
        currentPlanName: currentPlan.name,
        targetPlanCode: targetPlan.code,
        targetPlanName: targetPlan.name,
        isUpgrade: false,
        isDowngrade: false,
        immediate: false,
        proratedAmount: 0,
        currency: subscription.currency,
        billingCycle: subscription.billingCycle,
        daysRemaining: 0,
        totalDaysInPeriod: 30,
        currentRecurringAmount: 0,
        newRecurringAmount: 0,
        allowed: true,
        blockReasons: [],
        effectiveDate: subscription.currentPeriodEnd.toISOString(),
        message: `Tenant is already subscribed to the ${targetPlan.name} plan.`,
      };
    }

    const isUpgrade = targetPlan.rank > currentPlan.rank;
    const isDowngrade = targetPlan.rank < currentPlan.rank;

    // Period timing calculations
    const now = new Date();
    const periodStart = subscription.currentPeriodStart;
    const periodEnd = subscription.currentPeriodEnd;
    let totalMs = periodEnd.getTime() - periodStart.getTime();
    if (totalMs <= 0) totalMs = 30 * 24 * 60 * 60 * 1000;

    const remainingMs = Math.max(0, periodEnd.getTime() - now.getTime());
    const remainingRatio = Math.min(1, Math.max(0, remainingMs / totalMs));
    const totalDaysInPeriod = Math.max(1, Math.round(totalMs / (24 * 60 * 60 * 1000)));
    const daysRemaining = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    // Recurring amount calculations
    const activeSeats = await this.invoicingService.countActiveSeats(tenantId);
    const currentAmounts = await this.invoicingService.calculateCycleAmounts(
      currentPlan.id,
      subscription.currency,
      subscription.billingCycle,
      activeSeats,
    );
    const targetAmounts = await this.invoicingService.calculateCycleAmounts(
      targetPlan.id,
      subscription.currency,
      subscription.billingCycle,
      activeSeats,
    );

    // =========================================================================
    // UPGRADE: Immediate effect with prorated charge for remainder of cycle
    // =========================================================================
    if (isUpgrade) {
      const priceDifference = Math.max(0, targetAmounts.total - currentAmounts.total);
      const proratedAmount = Math.round(priceDifference * remainingRatio * 100) / 100;

      return {
        changeType: 'upgrade',
        currentPlanCode: currentPlan.code,
        currentPlanName: currentPlan.name,
        targetPlanCode: targetPlan.code,
        targetPlanName: targetPlan.name,
        isUpgrade: true,
        isDowngrade: false,
        immediate: true,
        proratedAmount,
        currency: subscription.currency,
        billingCycle: subscription.billingCycle,
        daysRemaining,
        totalDaysInPeriod,
        currentRecurringAmount: currentAmounts.total,
        newRecurringAmount: targetAmounts.total,
        allowed: true,
        blockReasons: [],
        effectiveDate: now.toISOString(),
        message: `Upgrading to ${targetPlan.name} takes effect immediately. A prorated charge of ${proratedAmount} ${subscription.currency} covers the remaining ${daysRemaining} days of your current billing cycle.`,
      };
    }

    // =========================================================================
    // DOWNGRADE: Takes effect at next renewal; blocked if feature or limit exceeded
    // =========================================================================
    const blockReasons: string[] = [];

    // 1. Employee limit check
    const targetEmpLimit =
      targetPlan.limits.find((l) => l.limitKey === 'employees')?.value ??
      PLAN_EMPLOYEE_LIMITS[targetPlan.code as SubscriptionPlanTier] ??
      null;

    if (targetEmpLimit !== null && activeSeats > targetEmpLimit) {
      blockReasons.push(
        `You currently have ${activeSeats} active employee seats, but the ${targetPlan.name} plan limit is ${targetEmpLimit}. Reduce active employees to ${targetEmpLimit} or fewer before downgrading.`,
      );
    }

    // 2. Storage limit check
    let storageGb = 0;
    if (this.featureGate) {
      storageGb = await this.featureGate.getCurrentUsage(tenantId, 'storage_gb');
    }
    const targetStorageLimit =
      targetPlan.limits.find((l) => l.limitKey === 'storage_gb')?.value ??
      PLAN_STORAGE_LIMITS[targetPlan.code as SubscriptionPlanTier] ??
      null;

    if (targetStorageLimit !== null && storageGb > targetStorageLimit) {
      blockReasons.push(
        `Cloud storage in use (${storageGb.toFixed(2)} GB) exceeds the ${targetPlan.name} plan limit of ${targetStorageLimit} GB. Delete excess files to proceed.`,
      );
    }

    // 3. Multi-company limit check
    const companyCount = await this.prisma.unscoped.company
      .count({ where: { tenantId } })
      .catch(() => 0);
    const targetCompanyLimit =
      targetPlan.limits.find((l) => l.limitKey === 'companies')?.value ??
      PLAN_COMPANY_LIMITS[targetPlan.code as SubscriptionPlanTier] ??
      null;

    if (targetCompanyLimit !== null && companyCount > targetCompanyLimit) {
      blockReasons.push(
        `Your tenant has ${companyCount} active companies configured, but the ${targetPlan.name} plan allows a maximum of ${targetCompanyLimit}.`,
      );
    }

    // 4. Feature usage check (BILLING_SUBSCRIPTION.md §7)
    const targetFeatures = new Set(
      targetPlan.features.filter((f) => f.enabled).map((f) => f.featureKey),
    );

    // 4a. Shift Rostering
    if (!targetFeatures.has('roster')) {
      const shiftCount = await this.prisma.unscoped.shift
        .count({ where: { company: { tenantId } } })
        .catch(() => 0);
      if (shiftCount > 0) {
        blockReasons.push(
          `Tenant actively uses Shift Rostering (${shiftCount} shifts defined), which is not included in the ${targetPlan.name} tier.`,
        );
      }
    }

    // 4b. Timesheets
    if (!targetFeatures.has('timesheets')) {
      const timesheetCount = await this.prisma.unscoped.timesheetEntry
        .count({ where: { tenantId } })
        .catch(() => 0);
      if (timesheetCount > 0) {
        blockReasons.push(
          `Tenant has recorded Timesheet entries (${timesheetCount} entries), which are not supported on the ${targetPlan.name} tier.`,
        );
      }
    }

    // 4c. API Access
    if (!targetFeatures.has('api_access')) {
      const activeApiKeys = await this.prisma.unscoped.tenantApiKey
        .count({ where: { tenantId, revokedAt: null } })
        .catch(() => 0);
      if (activeApiKeys > 0) {
        blockReasons.push(
          `Tenant has ${activeApiKeys} active API key(s) in use. Custom API integration is an Enterprise feature not supported on ${targetPlan.name}. Revoke keys to continue.`,
        );
      }
    }

    // 4d. Single Sign-On (SSO)
    if (!targetFeatures.has('sso')) {
      const ssoConfig = await this.prisma.unscoped.tenantSetting
        .findFirst({
          where: {
            tenantId,
            key: { in: ['sso_enabled', 'saml_enabled'] },
          },
        })
        .catch(() => null);
      const isSsoEnabled =
        ssoConfig &&
        (ssoConfig.value === true ||
          ssoConfig.value === 'true' ||
          ssoConfig.value === 1);
      if (isSsoEnabled) {
        blockReasons.push(
          `Tenant has Single Sign-On (SSO) actively enabled, which is not supported on the ${targetPlan.name} tier. Disable SSO to proceed.`,
        );
      }
    }

    // 4e. Advanced Workflow
    if (!targetFeatures.has('advanced_workflow')) {
      const customWorkflows = await this.prisma.unscoped.workflowDefinition
        .count({ where: { company: { tenantId } } })
        .catch(() => 0);
      if (customWorkflows > 0) {
        blockReasons.push(
          `Tenant has ${customWorkflows} custom workflow definition(s), which are not supported on the ${targetPlan.name} tier.`,
        );
      }
    }

    // 4f. Custom Payroll Rules
    if (!targetFeatures.has('custom_payroll_rules')) {
      const customRules = await this.prisma.unscoped.payrollRule
        .count({ where: { company: { tenantId } } })
        .catch(() => 0);
      if (customRules > 0) {
        blockReasons.push(
          `Tenant has ${customRules} custom payroll rule(s) configured, which are not supported on the ${targetPlan.name} tier.`,
        );
      }
    }

    // 4g. Attendance (if downgrading to Free)
    if (!targetFeatures.has('attendance')) {
      const attendanceRecords = await this.prisma.unscoped.attendanceRecord
        .count({ where: { employee: { tenantId } } })
        .catch(() => 0);
      if (attendanceRecords > 0) {
        blockReasons.push(
          `Tenant has recorded attendance data (${attendanceRecords} records), which is not available on the Free tier.`,
        );
      }
    }

    // 4h. Leave (if downgrading to Free)
    if (!targetFeatures.has('leave')) {
      const leaveRequests = await this.prisma.unscoped.leaveRequest
        .count({ where: { employee: { tenantId } } })
        .catch(() => 0);
      if (leaveRequests > 0) {
        blockReasons.push(
          `Tenant has recorded leave records (${leaveRequests} requests), which are not available on the Free tier.`,
        );
      }
    }

    // 4i. Basic Payroll (if downgrading to Free)
    if (!targetFeatures.has('basic_payroll')) {
      const payrollRuns = await this.prisma.unscoped.payrollRun
        .count({ where: { employee: { tenantId } } })
        .catch(() => 0);
      if (payrollRuns > 0) {
        blockReasons.push(
          `Tenant has processed payroll runs (${payrollRuns} runs), which are not available on the Free tier.`,
        );
      }
    }

    const allowed = blockReasons.length === 0;

    return {
      changeType: 'downgrade',
      currentPlanCode: currentPlan.code,
      currentPlanName: currentPlan.name,
      targetPlanCode: targetPlan.code,
      targetPlanName: targetPlan.name,
      isUpgrade: false,
      isDowngrade: true,
      immediate: false,
      proratedAmount: 0,
      currency: subscription.currency,
      billingCycle: subscription.billingCycle,
      daysRemaining,
      totalDaysInPeriod,
      currentRecurringAmount: currentAmounts.total,
      newRecurringAmount: targetAmounts.total,
      allowed,
      blockReasons,
      effectiveDate: subscription.currentPeriodEnd.toISOString(),
      message: allowed
        ? `Downgrade to ${targetPlan.name} will take effect at your next renewal on ${subscription.currentPeriodEnd.toLocaleDateString()}. You will keep full ${currentPlan.name} access until then.`
        : `Downgrade to ${targetPlan.name} is currently blocked due to active feature usage or limit overage. Resolve the listed blockers before downgrading.`,
    };
  }

  /**
   * Executes a plan change:
   * - Upgrade: charges prorated amount immediately, updates tenant and subscription immediately.
   * - Downgrade: validates eligibility; if blocked, throws 403 PLAN_DOWNGRADE_BLOCKED; if allowed, schedules pendingPlanId for next renewal.
   */
  async executePlanChange(tenantId: string, targetPlanCode: string): Promise<PlanChangeResult> {
    const preview = await this.previewPlanChange(tenantId, targetPlanCode);

    if (preview.changeType === 'same') {
      return {
        success: true,
        changeType: 'upgrade',
        planId: '',
        planCode: preview.targetPlanCode,
        effectiveImmediately: true,
        effectiveDate: new Date().toISOString(),
        message: 'Tenant is already subscribed to this plan tier.',
      };
    }

    const subscription = await this.prisma.unscoped.subscription.findFirst({
      where: { tenantId, status: { not: 'cancelled' } },
      include: {
        plan: true,
        tenant: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundException('Active subscription not found for tenant');
    }

    const targetPlan = await this.prisma.unscoped.plan.findUniqueOrThrow({
      where: { code: preview.targetPlanCode },
    });

    // =========================================================================
    // DOWNGRADE EXECUTION: Block if not allowed; schedule for next renewal if allowed
    // =========================================================================
    if (preview.isDowngrade) {
      if (!preview.allowed) {
        throw new ForbiddenException({
          code: 'PLAN_DOWNGRADE_BLOCKED',
          message: `Downgrade to ${preview.targetPlanName} is blocked because the tenant currently uses features or exceeds limits not allowed on ${preview.targetPlanName}.`,
          details: preview.blockReasons,
          reasons: preview.blockReasons,
        });
      }

      await this.prisma.unscoped.subscription.update({
        where: { id: subscription.id },
        data: {
          pendingPlanId: targetPlan.id,
        },
      });

      if (this.auditService) {
        await this.auditService.log({
          action: 'plan_downgrade_scheduled',
          module: 'billing',
          recordId: subscription.id,
          reason: `Downgrade to ${targetPlan.name} scheduled for renewal on ${subscription.currentPeriodEnd.toISOString()}`,
          oldValue: { planCode: subscription.plan.code, planId: subscription.planId },
          newValue: {
            tenantId,
            targetPlanCode: targetPlan.code,
            targetPlanId: targetPlan.id,
            effectiveDate: subscription.currentPeriodEnd.toISOString(),
          },
        });
      }

      return {
        success: true,
        changeType: 'downgrade',
        planId: targetPlan.id,
        planCode: targetPlan.code,
        effectiveImmediately: false,
        effectiveDate: preview.effectiveDate,
        message: `Downgrade to ${targetPlan.name} has been scheduled. It will take effect at your next renewal on ${new Date(preview.effectiveDate).toLocaleDateString()}.`,
      };
    }

    // =========================================================================
    // UPGRADE EXECUTION: Create prorated invoice, charge provider, apply immediately
    // =========================================================================
    let invoiceId: string | undefined;

    if (preview.proratedAmount > 0) {
      const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `INV-UPG-${yearMonth}-${subscription.tenant.subdomain?.toUpperCase().slice(0, 4) ?? 'TEN'}-${randomSuffix}`;

      const invoice = await this.prisma.unscoped.invoice.create({
        data: {
          tenantId,
          subscriptionId: subscription.id,
          invoiceNumber,
          currency: preview.currency,
          subtotal: new Prisma.Decimal(preview.proratedAmount),
          tax: new Prisma.Decimal(0.00),
          total: new Prisma.Decimal(preview.proratedAmount),
          amountPaid: new Prisma.Decimal(0.00),
          amountDue: new Prisma.Decimal(preview.proratedAmount),
          status: 'open',
          billingReason: 'plan_upgrade',
          periodStart: new Date(),
          periodEnd: subscription.currentPeriodEnd,
          dueDate: new Date(),
          lines: {
            create: [
              {
                tenantId,
                description: `Prorated upgrade: ${preview.currentPlanName} → ${preview.targetPlanName} (${preview.daysRemaining} days remaining in cycle)`,
                quantity: 1,
                unitAmount: new Prisma.Decimal(preview.proratedAmount),
                amount: new Prisma.Decimal(preview.proratedAmount),
              },
            ],
          },
        },
      });

      invoiceId = invoice.id;

      // Charge payment provider
      const chargeRes = await this.invoicingService.chargeInvoice(
        invoice.id,
        `upgrade_prorated_${subscription.id}_${targetPlan.id}`,
      );

      if (!chargeRes.success) {
        throw new BadRequestException(
          `Upgrade charge failed: ${chargeRes.chargeResult?.errorMessage ?? 'Payment declined by provider'}`,
        );
      }
    }

    // Apply upgrade immediately
    await this.prisma.unscoped.$transaction([
      this.prisma.unscoped.subscription.update({
        where: { id: subscription.id },
        data: {
          planId: targetPlan.id,
          pendingPlanId: null, // Clear any pending downgrade
          updatedAt: new Date(),
        },
      }),
      this.prisma.unscoped.tenant.update({
        where: { id: tenantId },
        data: {
          planId: targetPlan.id,
          updatedAt: new Date(),
        },
      }),
    ]);

    if (this.auditService) {
      await this.auditService.log({
        action: 'plan_upgrade_executed',
        module: 'billing',
        recordId: subscription.id,
        reason: `Immediate upgrade from ${subscription.plan.name} to ${targetPlan.name} with prorated charge`,
        oldValue: { planCode: subscription.plan.code, planId: subscription.planId },
        newValue: {
          tenantId,
          targetPlanCode: targetPlan.code,
          targetPlanId: targetPlan.id,
          proratedCharged: preview.proratedAmount,
          currency: preview.currency,
          invoiceId,
        },
      });
    }

    return {
      success: true,
      changeType: 'upgrade',
      planId: targetPlan.id,
      planCode: targetPlan.code,
      effectiveImmediately: true,
      effectiveDate: new Date().toISOString(),
      invoiceId,
      proratedCharged: preview.proratedAmount,
      currency: preview.currency,
      message: `Successfully upgraded to ${targetPlan.name}. Your new features and limits are now active.`,
    };
  }
}
