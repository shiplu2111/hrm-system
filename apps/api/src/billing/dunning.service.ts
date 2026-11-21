import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PlatformAuditService } from '../platform/audit/platform-audit.service';
import { MailService, escapeHtml } from '../settings/mail.service';
import { SmtpSettingsService } from '../settings/smtp-settings.service';
import { BillingInvoicingService } from './billing-invoicing.service';

export interface DunningStepConfig {
  step: number;
  delayDays: number;
  newStatus?: SubscriptionStatus;
  emailSubject: string;
  emailBody: (tenantName: string, amount: string, nextAction: string) => string;
}

export const DUNNING_SCHEDULE: Record<number, DunningStepConfig> = {
  1: {
    step: 1,
    delayDays: 1, // Retry on Day 1 (+24h)
    newStatus: 'active',
    emailSubject: 'Payment Failed — Automated retry scheduled for tomorrow',
    emailBody: (tenantName, amount, nextAction) =>
      `Hello ${tenantName} Team,\n\nWe were unable to process your recurring subscription charge of ${amount}. We will automatically retry this charge tomorrow (Day 1).\n\nAction: ${nextAction}\n\nYour account remains active.`,
  },
  2: {
    step: 2,
    delayDays: 2, // Retry on Day 3 (+48h)
    newStatus: 'past_due',
    emailSubject: 'Action Required: Your subscription is now Past Due',
    emailBody: (tenantName, amount, nextAction) =>
      `Hello ${tenantName} Team,\n\nA second payment attempt for ${amount} has failed. Your subscription status is now PAST DUE.\n\nNext automated retry: in 2 days (Day 3).\n\nAction: ${nextAction}\n\nPlease update your billing information promptly.`,
  },
  3: {
    step: 3,
    delayDays: 4, // Final retry on Day 7 (+96h)
    newStatus: 'past_due',
    emailSubject: 'Urgent: Final payment attempt scheduled for your subscription',
    emailBody: (tenantName, amount, nextAction) =>
      `Hello ${tenantName} Team,\n\nThe third payment attempt for ${amount} was declined. We have scheduled the FINAL automated retry for Day 7.\n\nIf unpaid, your account will enter a 3-day grace period before transitioning to read-only suspension.\n\nAction: ${nextAction}`,
  },
  4: {
    step: 4,
    delayDays: 3, // Grace period duration
    newStatus: 'past_due',
    emailSubject: 'Final Notice: Grace period active — Account entering Read-Only Suspension soon',
    emailBody: (tenantName, amount, nextAction) =>
      `Hello ${tenantName} Team,\n\nAll automated payment attempts for ${amount} have failed. You are now in a 3-day grace period.\n\nUpon expiry, your account will enter READ-ONLY SUSPENSION. Per our data policy, your records will NEVER be deleted, but all editing and payroll functions will be locked.\n\nAction: ${nextAction}`,
  },
};

@Injectable()
export class DunningService {
  private readonly logger = new Logger(DunningService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicingService: BillingInvoicingService,
    private readonly platformAudit: PlatformAuditService,
    private readonly mailService: MailService,
    private readonly smtpSettingsService: SmtpSettingsService,
  ) {}

  /**
   * Handle an initial or recurring payment failure on an invoice.
   * Advances the subscription's dunning step according to the 1-3-7 schedule.
   */
  async handlePaymentFailure(invoiceId: string, errorReason?: string) {
    const invoice = await this.prisma.unscoped.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: true,
        tenant: true,
      },
    });

    if (!invoice || !invoice.subscription) {
      this.logger.warn(`Cannot process dunning for invoice ${invoiceId}: invoice or subscription not found`);
      return;
    }

    const currentStep = invoice.subscription.dunningStep;
    const nextStep = currentStep + 1;
    const now = new Date();

    if (nextStep <= 3) {
      // Steps 1, 2, 3: Schedule next retry (Day 1, Day 3, Day 7)
      const stepConfig = DUNNING_SCHEDULE[nextStep];
      const nextRetryDate = new Date(now.getTime() + stepConfig.delayDays * 24 * 60 * 60 * 1000);

      await this.prisma.unscoped.subscription.update({
        where: { id: invoice.subscription.id },
        data: {
          dunningStep: nextStep,
          lastDunningAt: now,
          status: stepConfig.newStatus ?? invoice.subscription.status,
          nextBillingAt: nextRetryDate,
        },
      });

      await this.sendDunningEmail(invoice, nextStep, stepConfig);

      await this.platformAudit.log({
        action: 'billing.dunning_step_advanced',
        module: 'billing',
        recordId: invoice.subscription.id,
        newValue: {
          tenantId: invoice.tenantId,
          step: nextStep,
          nextRetryDate: nextRetryDate.toISOString(),
          status: stepConfig.newStatus ?? invoice.subscription.status,
          errorReason,
        },
        reason: `Dunning step ${nextStep} reached for ${invoice.tenant.name}. Next retry scheduled for ${nextRetryDate.toISOString().slice(0, 10)}.`,
      });

      this.logger.log(
        `Advanced dunning to step ${nextStep} for tenant ${invoice.tenant.name} (Retry scheduled: ${nextRetryDate.toISOString()})`,
      );
    } else if (nextStep === 4) {
      // Step 4: Final retry failed -> Start 3-day grace period
      const gracePeriodExpiry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

      await this.prisma.unscoped.subscription.update({
        where: { id: invoice.subscription.id },
        data: {
          dunningStep: 4,
          lastDunningAt: now,
          status: 'past_due',
          nextBillingAt: gracePeriodExpiry,
        },
      });

      const stepConfig = DUNNING_SCHEDULE[4];
      await this.sendDunningEmail(invoice, 4, stepConfig);

      await this.platformAudit.log({
        action: 'billing.dunning_grace_period_started',
        module: 'billing',
        recordId: invoice.subscription.id,
        newValue: {
          tenantId: invoice.tenantId,
          step: 4,
          gracePeriodExpiry: gracePeriodExpiry.toISOString(),
        },
        reason: `Final automated payment retry failed. Tenant ${invoice.tenant.name} entered 3-day grace period.`,
      });
    } else {
      // Grace period expired with no payment -> Read-only suspension (never data deletion!)
      await this.applyReadOnlySuspension(invoice.tenantId, invoice.subscription.id);
    }
  }

  /**
   * Applies Read-Only Suspension to a tenant after failed dunning and grace period expiry.
   * Conforms strictly to BILLING_SUBSCRIPTION.md §7:
   * "Non-payment leads to a grace period, then read-only/suspended access (never immediate data deletion)"
   */
  async applyReadOnlySuspension(tenantId: string, subscriptionId: string) {
    const tenant = await this.prisma.unscoped.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) return;

    // Apply read_only suspension
    await this.prisma.unscoped.tenant.update({
      where: { id: tenantId },
      data: {
        status: 'suspended',
        suspensionMode: 'read_only',
        suspensionReason: 'Subscription past due after dunning retries and grace period expiry',
        suspendedAt: new Date(),
      },
    });

    await this.prisma.unscoped.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'past_due',
        dunningStep: 5, // Fully suspended
      },
    });

    await this.platformAudit.log({
      action: 'billing.tenant_read_only_suspended',
      module: 'billing',
      recordId: tenantId,
      oldValue: { status: tenant.status, suspensionMode: tenant.suspensionMode },
      newValue: { tenantId, status: 'suspended', suspensionMode: 'read_only' },
      reason: `Tenant ${tenant.name} suspended to read-only mode due to delinquent subscription billing. Records preserved safely.`,
    });

    this.logger.warn(`Tenant ${tenant.name} has been placed in read-only suspension for non-payment.`);
  }

  /**
   * Handles payment success at ANY step of the dunning sequence:
   * Resets dunning, restores active subscription, and lifts read-only suspension if applicable.
   */
  async handlePaymentSuccess(subscriptionId: string) {
    const subscription = await this.prisma.unscoped.subscription.findUnique({
      where: { id: subscriptionId },
      include: { tenant: true },
    });

    if (!subscription) return;

    const wasSuspendedForBilling =
      subscription.tenant.status === 'suspended' &&
      subscription.tenant.suspensionReason?.includes('Subscription past due');

    // Reset dunning state and restore active subscription
    await this.prisma.unscoped.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'active',
        dunningStep: 0,
        lastDunningAt: null,
      },
    });

    // Lift suspension if it was caused by billing
    if (wasSuspendedForBilling) {
      await this.prisma.unscoped.tenant.update({
        where: { id: subscription.tenantId },
        data: {
          status: 'active',
          suspensionMode: null,
          suspensionReason: null,
          suspendedAt: null,
        },
      });

      this.logger.log(`Lifted billing suspension for tenant ${subscription.tenant.name}.`);
    }

    await this.platformAudit.log({
      action: 'billing.dunning_resolved',
      module: 'billing',
      recordId: subscriptionId,
      newValue: { tenantId: subscription.tenantId, status: 'active' },
      reason: `Successful payment received for tenant ${subscription.tenant.name}. Dunning reset and account restored.`,
    });
  }

  /**
   * Helper to dispatch transactional dunning email to tenant owner/admins.
   */
  private async sendDunningEmail(invoice: any, step: number, config: DunningStepConfig) {
    try {
      // Find tenant owner or company admin email
      const companyAdmin = await this.prisma.unscoped.user.findFirst({
        where: {
          tenantId: invoice.tenantId,
          isActive: true,
          role: {
            name: { in: ['Admin', 'Company Owner', 'admin', 'company_owner'] },
          },
        },
      });

      const recipientEmail = companyAdmin?.email ?? invoice.tenant.demoLeadEmail ?? 'billing@cmsnbd.com';
      const formattedAmount = `${invoice.currency} ${Number(invoice.total).toFixed(2)}`;
      const nextAction = 'Please navigate to Settings > Subscriptions & Billing to update your payment method.';

      const mailBody = config.emailBody(invoice.tenant.name, formattedAmount, nextAction);

      // Check if SMTP is configured
      const smtpSettings = await this.smtpSettingsService.resolveDecryptedSettings(invoice.tenantId);
      if (smtpSettings) {
        await this.mailService.sendMail({
          settings: smtpSettings,
          to: recipientEmail,
          subject: `[${invoice.tenant.name}] ${config.emailSubject}`,
          text: mailBody,
          html: `<div style="font-family:sans-serif;line-height:1.6;color:#1e293b;">
            <p>${escapeHtml(mailBody).replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>
          </div>`,
        });
      } else {
        this.logger.log(
          `[Dunning Email Simulation] Step ${step} to ${recipientEmail} for invoice ${invoice.invoiceNumber}: ${config.emailSubject}`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Failed to send dunning email for invoice ${invoice.id}: ${err.message}`);
    }
  }
}
