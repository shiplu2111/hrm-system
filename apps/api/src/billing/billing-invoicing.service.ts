import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EmploymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import {
  PAYMENT_PROVIDER,
  type PaymentProvider,
} from './payment-provider/payment-provider.interface';

export interface CycleCalculationResult {
  baseAmount: number;
  perSeatAmount: number | null;
  includedSeats: number;
  activeSeats: number;
  billableExtraSeats: number;
  extraSeatsAmount: number;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
}

@Injectable()
export class BillingInvoicingService {
  private readonly logger = new Logger(BillingInvoicingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER)
    private readonly paymentProvider: PaymentProvider,
  ) {}

  /**
   * Count active employee seats holding an active profile (BILLING_SUBSCRIPTION.md §3a).
   * Active, on_leave, and suspended profiles hold a seat. Terminated and soft-deleted do not.
   */
  async countActiveSeats(tenantId: string): Promise<number> {
    const count = await this.prisma.unscoped.employee.count({
      where: {
        tenantId,
        employmentStatus: { not: EmploymentStatus.terminated },
        deletedAt: null,
      },
    });
    return count;
  }

  /**
   * Resolves the active effective-dated price point for a plan, currency, and billing cycle.
   */
  async resolvePlanPrice(planId: string, currency: string, billingCycle: string) {
    const price = await this.prisma.unscoped.planPrice.findFirst({
      where: {
        planId,
        currency: currency.toUpperCase(),
        billingCycle,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!price) {
      // Fallback: any active price in any cycle or default USD
      const fallback = await this.prisma.unscoped.planPrice.findFirst({
        where: {
          planId,
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });
      return fallback;
    }

    return price;
  }

  /**
   * Applies the plan's pricing model:
   * (per-employee, or base fee plus per-employee above an included threshold).
   * Money stored and returned as numeric(14,2) floating decimals without roundoff drift.
   */
  async calculateCycleAmounts(
    planId: string,
    currency: string,
    billingCycle: string,
    activeSeats: number,
  ): Promise<CycleCalculationResult> {
    const plan = await this.prisma.unscoped.plan.findUnique({
      where: { id: planId },
      include: { limits: true },
    });

    if (!plan) {
      throw new NotFoundException(`Plan '${planId}' not found`);
    }

    const price = await this.resolvePlanPrice(planId, currency, billingCycle);
    const baseAmount = price ? Number(price.amount) : 0;
    const perSeatAmount = price?.perSeatAmount !== null && price?.perSeatAmount !== undefined
      ? Number(price.perSeatAmount)
      : null;

    // Threshold of included seats:
    // If plan code is 'free', cap is 10. If starter, base includes up to 10 seats or threshold.
    // If plan limit 'employees' is set, base includes min(limit, threshold)
    const empLimit = plan.limits.find((l) => l.limitKey === 'employees');
    // Threshold defaults to 10 seats included in base price (or 0 if pure per-employee)
    const includedSeats = baseAmount === 0 ? 0 : Math.min(activeSeats, empLimit?.value ? Math.min(10, empLimit.value) : 10);

    let billableExtraSeats = 0;
    let extraSeatsAmount = 0;

    if (perSeatAmount && perSeatAmount > 0) {
      billableExtraSeats = Math.max(0, activeSeats - includedSeats);
      extraSeatsAmount = Math.round(billableExtraSeats * perSeatAmount * 100) / 100;
    }

    const subtotal = Math.round((baseAmount + extraSeatsAmount) * 100) / 100;
    const tax = 0.00; // Tax calculation can be customized per jurisdiction
    const total = Math.round((subtotal + tax) * 100) / 100;

    return {
      baseAmount,
      perSeatAmount,
      includedSeats,
      activeSeats,
      billableExtraSeats,
      extraSeatsAmount,
      subtotal,
      tax,
      total,
      currency: price?.currency ?? currency,
    };
  }

  /**
   * Generate an invoice and line items for a subscription cycle.
   */
  async generateCycleInvoice(subscriptionId: string) {
    const subscription = await this.prisma.unscoped.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: true,
        tenant: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription '${subscriptionId}' not found`);
    }

    const activeSeats = await this.countActiveSeats(subscription.tenantId);
    const amounts = await this.calculateCycleAmounts(
      subscription.planId,
      subscription.currency,
      subscription.billingCycle,
      activeSeats,
    );

    const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const invoiceNumber = `INV-${yearMonth}-${subscription.tenant.subdomain.toUpperCase().slice(0, 4)}-${randomSuffix}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // 7-day payment window

    const invoice = await this.prisma.unscoped.invoice.create({
      data: {
        tenantId: subscription.tenantId,
        subscriptionId: subscription.id,
        invoiceNumber,
        currency: amounts.currency,
        subtotal: new Prisma.Decimal(amounts.subtotal),
        tax: new Prisma.Decimal(amounts.tax),
        total: new Prisma.Decimal(amounts.total),
        amountPaid: new Prisma.Decimal(0.00),
        amountDue: new Prisma.Decimal(amounts.total),
        status: amounts.total === 0 ? 'paid' : 'open',
        billingReason: 'subscription_cycle',
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
        dueDate,
        paidAt: amounts.total === 0 ? new Date() : null,
        lines: {
          create: [
            {
              tenantId: subscription.tenantId,
              description: `${subscription.plan.name} (${subscription.billingCycle}) base subscription fee`,
              quantity: 1,
              unitAmount: new Prisma.Decimal(amounts.baseAmount),
              amount: new Prisma.Decimal(amounts.baseAmount),
            },
            ...(amounts.billableExtraSeats > 0 && amounts.perSeatAmount
              ? [
                  {
                    tenantId: subscription.tenantId,
                    description: `Active employee seats (${amounts.activeSeats} active, ${amounts.billableExtraSeats} above included threshold of ${amounts.includedSeats})`,
                    quantity: amounts.billableExtraSeats,
                    unitAmount: new Prisma.Decimal(amounts.perSeatAmount),
                    amount: new Prisma.Decimal(amounts.extraSeatsAmount),
                  },
                ]
              : []),
          ],
        },
      },
      include: {
        lines: true,
      },
    });

    this.logger.log(
      `Generated cycle invoice ${invoice.invoiceNumber} for tenant ${subscription.tenant.name} (${amounts.currency} ${amounts.total})`,
    );

    return invoice;
  }

  /**
   * Execute an automated charge against the invoice using the payment provider.
   */
  async chargeInvoice(invoiceId: string, idempotencyPrefix?: string) {
    const invoice = await this.prisma.unscoped.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        subscription: true,
        tenant: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice '${invoiceId}' not found`);
    }

    const totalAmount = Number(invoice.total);
    if (totalAmount <= 0) {
      // Free invoice
      await this.prisma.unscoped.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'paid',
          amountPaid: invoice.total,
          amountDue: new Prisma.Decimal(0),
          paidAt: new Date(),
        },
      });
      return { success: true, amount: 0, status: 'succeeded' as const };
    }

    const idempotencyKey = `${idempotencyPrefix ?? 'inv'}_${invoice.id}_${invoice.subscription?.dunningStep ?? 0}`;

    const chargeResult = await this.paymentProvider.charge({
      tenantId: invoice.tenantId,
      customerId: invoice.subscription?.customerId,
      paymentMethodId: invoice.subscription?.paymentMethodId,
      amount: totalAmount,
      currency: invoice.currency,
      description: `Payment for invoice ${invoice.invoiceNumber} (${invoice.tenant.name})`,
      idempotencyKey,
    });

    // Create payment record
    const payment = await this.prisma.unscoped.payment.create({
      data: {
        tenantId: invoice.tenantId,
        invoiceId: invoice.id,
        subscriptionId: invoice.subscriptionId,
        provider: 'stripe',
        providerPaymentId: chargeResult.providerPaymentId ?? null,
        idempotencyKey,
        amount: new Prisma.Decimal(totalAmount),
        currency: invoice.currency,
        status: chargeResult.status === 'succeeded' ? 'succeeded' : 'failed',
        errorCode: chargeResult.errorCode ?? null,
        errorMessage: chargeResult.errorMessage ?? null,
        paidAt: chargeResult.status === 'succeeded' ? new Date() : null,
      },
    });

    if (chargeResult.status === 'succeeded') {
      await this.prisma.unscoped.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'paid',
          amountPaid: invoice.total,
          amountDue: new Prisma.Decimal(0.00),
          paidAt: new Date(),
        },
      });

      this.logger.log(`Invoice ${invoice.invoiceNumber} successfully paid via ${payment.providerPaymentId}`);
      return { success: true, payment, chargeResult };
    } else {
      this.logger.warn(`Invoice ${invoice.invoiceNumber} charge failed: ${chargeResult.errorMessage}`);
      return { success: false, payment, chargeResult };
    }
  }
}
