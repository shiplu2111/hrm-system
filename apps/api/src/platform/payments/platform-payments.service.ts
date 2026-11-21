import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import type {
  DunningTenantView,
  PaymentRefundView,
  PlatformPaymentDetailView,
  PlatformPaymentListItem,
} from '@hrm/shared-types';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import {
  QueryPlatformPaymentsDto,
  RefundPaymentDto,
  RefundTypeEnum,
  RetryPaymentDto,
} from './dto/platform-payments.dto';

interface PlatformActor {
  id: string;
  email?: string;
  role?: string;
}

@Injectable()
export class PlatformPaymentsService {
  private readonly logger = new Logger(PlatformPaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: PlatformAuditService,
  ) {}

  /**
   * List all platform payments with status, provider, date, and tenant filtering.
   */
  async listPayments(
    query: QueryPlatformPaymentsDto,
  ): Promise<PlatformPaymentListItem[]> {
    const where: Prisma.PaymentWhereInput = {};

    if (query.tenantId) {
      where.tenantId = query.tenantId;
    }

    if (query.status) {
      where.status = query.status as PaymentStatus;
    }

    if (query.provider) {
      where.provider = query.provider;
    }

    if (query.search) {
      const term = query.search.trim();
      where.OR = [
        { providerPaymentId: { contains: term, mode: 'insensitive' } },
        { errorCode: { contains: term, mode: 'insensitive' } },
        { errorMessage: { contains: term, mode: 'insensitive' } },
        { tenant: { name: { contains: term, mode: 'insensitive' } } },
        { tenant: { subdomain: { contains: term, mode: 'insensitive' } } },
        { invoice: { invoiceNumber: { contains: term, mode: 'insensitive' } } },
      ];
    }

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) {
        where.createdAt.gte = new Date(query.fromDate);
      }
      if (query.toDate) {
        where.createdAt.lte = new Date(query.toDate);
      }
    }

    const take = query.limit ? Math.min(query.limit, 100) : 50;
    const skip = query.page && query.page > 1 ? (query.page - 1) * take : 0;

    const rows = await this.prisma.unscoped.payment.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, name: true, subdomain: true },
        },
        invoice: {
          select: { id: true, invoiceNumber: true },
        },
        _count: {
          select: { refunds: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });

    return rows.map((r: any) => this.mapToListItem(r));
  }

  /**
   * Get payment detail including full refund history and invoice breakdown.
   */
  async getPaymentDetail(id: string): Promise<PlatformPaymentDetailView> {
    const payment = await this.prisma.unscoped.payment.findUnique({
      where: { id },
      include: {
        tenant: {
          select: { id: true, name: true, subdomain: true },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            amountPaid: true,
            amountDue: true,
            status: true,
            billingReason: true,
          },
        },
        refunds: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found.`);
    }

    const base = this.mapToListItem({
      ...payment,
      _count: { refunds: payment.refunds.length },
    });

    return {
      ...base,
      refunds: payment.refunds.map((ref: any) => ({
        id: ref.id,
        paymentId: ref.paymentId,
        tenantId: ref.tenantId,
        amount: Number(ref.amount),
        currency: ref.currency,
        reason: ref.reason,
        refundedBy: ref.refundedBy,
        status: ref.status,
        providerRefundId: ref.providerRefundId,
        createdAt: ref.createdAt.toISOString(),
      })),
      invoice: payment.invoice
        ? {
            id: payment.invoice.id,
            invoiceNumber: payment.invoice.invoiceNumber,
            total: Number(payment.invoice.total),
            amountPaid: Number(payment.invoice.amountPaid),
            amountDue: Number(payment.invoice.amountDue),
            status: payment.invoice.status as any,
            billingReason: payment.invoice.billingReason,
          }
        : null,
    };
  }

  /**
   * Retry a payment immediately.
   */
  async retryPayment(
    id: string,
    actor: PlatformActor,
    dto?: RetryPaymentDto,
  ): Promise<{
    success: boolean;
    message: string;
    payment: PlatformPaymentDetailView;
  }> {
    const payment = await this.prisma.unscoped.payment.findUnique({
      where: { id },
      include: {
        tenant: true,
        invoice: true,
        subscription: true,
        refunds: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found.`);
    }

    if (
      payment.status === PaymentStatus.succeeded ||
      payment.status === PaymentStatus.refunded
    ) {
      throw new BadRequestException(
        `Cannot retry payment with status "${payment.status}". Only failed or pending payments can be retried.`,
      );
    }

    const now = new Date();
    const retryCount = (payment.retryCount || 0) + 1;

    // Failure simulation or failed condition
    if (dto?.simulateFailure) {
      const errorCode = 'card_declined';
      const errorMessage =
        dto.failureReason?.trim() ||
        'The card was declined by the issuer (insufficient funds or bank rejection).';

      // Advance dunning sequence on subscription
      let newDunningStep = 1;
      if (payment.subscription) {
        newDunningStep = Math.min((payment.subscription.dunningStep || 0) + 1, 5);

        await this.prisma.unscoped.subscription.update({
          where: { id: payment.subscription.id },
          data: {
            dunningStep: newDunningStep,
            lastDunningAt: now,
            status: 'past_due',
          },
        });

        // Stage 5 or step 4 expired: Apply read-only suspension
        if (newDunningStep >= 4) {
          await this.prisma.unscoped.tenant.update({
            where: { id: payment.tenantId },
            data: {
              status: 'suspended',
              suspensionMode: 'read_only',
              suspendedAt: now,
              suspensionReason:
                'Automated dunning retries exhausted. Subscription suspended in read-only mode.',
            },
          });
        }
      }

      await this.prisma.unscoped.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.failed,
          errorCode,
          errorMessage,
          retryCount,
          lastRetryAt: now,
        },
      });

      await this.auditService.log({
        userId: actor.id,
        action: 'payment_retry_failed',
        module: 'billing',
        recordId: payment.id,
        reason: errorMessage,
        newValue: {
          dunningStep: newDunningStep,
          errorCode,
          retryCount,
          actor: actor.email,
        },
      });

      const updated = await this.getPaymentDetail(payment.id);
      return {
        success: false,
        message: `Retry declined by provider: ${errorMessage}`,
        payment: updated,
      };
    }

    // Successful retry
    await this.prisma.unscoped.$transaction(async (tx: any) => {
      // 1. Update Payment
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.succeeded,
          errorCode: null,
          errorMessage: null,
          paidAt: now,
          retryCount,
          lastRetryAt: now,
        },
      });

      // 2. Settle linked invoice
      if (payment.invoiceId && payment.invoice) {
        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            status: 'paid',
            amountPaid: payment.invoice.total,
            amountDue: new Prisma.Decimal('0.00'),
            paidAt: now,
            pdfKey: null, // invalidate cache
          },
        });
      }

      // 3. Restore Subscription to active, reset dunning
      if (payment.subscriptionId) {
        await tx.subscription.update({
          where: { id: payment.subscriptionId },
          data: {
            status: 'active',
            dunningStep: 0,
            lastDunningAt: null,
          },
        });
      }

      // 4. Lift any tenant suspension
      await tx.tenant.update({
        where: { id: payment.tenantId },
        data: {
          status: 'active',
          suspensionMode: null,
          suspendedAt: null,
          suspensionReason: null,
        },
      });
    });

    await this.auditService.log({
      userId: actor.id,
      action: 'payment_retry_succeeded',
      module: 'billing',
      recordId: payment.id,
      reason: 'Manual or automated retry succeeded; tenant restored to good standing.',
      newValue: {
        amount: Number(payment.amount),
        currency: payment.currency,
        retryCount,
        actor: actor.email,
      },
    });

    const updated = await this.getPaymentDetail(payment.id);
    return {
      success: true,
      message:
        'Payment retry succeeded! Outstanding invoice settled and tenant restored to good standing.',
      payment: updated,
    };
  }

  /**
   * Refund a payment (Full or Partial). Reason is strictly required.
   */
  async refundPayment(
    id: string,
    actor: PlatformActor,
    dto: RefundPaymentDto,
  ): Promise<PlatformPaymentDetailView> {
    const payment = await this.prisma.unscoped.payment.findUnique({
      where: { id },
      include: {
        tenant: true,
        invoice: true,
        refunds: true,
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found.`);
    }

    if (
      payment.status !== PaymentStatus.succeeded &&
      payment.status !== PaymentStatus.partially_refunded
    ) {
      throw new BadRequestException(
        `Cannot refund payment with status "${payment.status}". Only successful or partially refunded payments can be refunded.`,
      );
    }

    const trimmedReason = dto.reason?.trim();
    if (!trimmedReason || trimmedReason.length < 5) {
      throw new BadRequestException(
        'A valid, meaningful refund reason (at least 5 characters) is required for audit compliance.',
      );
    }

    const currentTotal = Number(payment.amount);
    const alreadyRefunded = Number(payment.amountRefunded || 0);
    const availableToRefund = Number(
      Math.max(0, currentTotal - alreadyRefunded).toFixed(2),
    );

    if (availableToRefund <= 0) {
      throw new BadRequestException(
        'This payment has already been completely refunded.',
      );
    }

    let refundAmount: number;
    if (dto.refundType === RefundTypeEnum.full) {
      refundAmount = availableToRefund;
    } else {
      if (!dto.amount || dto.amount <= 0) {
        throw new BadRequestException(
          'A positive refund amount is required for partial refunds.',
        );
      }
      if (dto.amount > availableToRefund) {
        throw new BadRequestException(
          `Requested partial refund of $${dto.amount.toFixed(
            2,
          )} exceeds available refundable balance of $${availableToRefund.toFixed(
            2,
          )}.`,
        );
      }
      refundAmount = Number(dto.amount.toFixed(2));
    }

    const newTotalRefunded = Number(
      (alreadyRefunded + refundAmount).toFixed(2),
    );
    const newStatus: PaymentStatus =
      newTotalRefunded >= currentTotal
        ? PaymentStatus.refunded
        : PaymentStatus.partially_refunded;

    const now = new Date();

    await this.prisma.unscoped.$transaction(async (tx: any) => {
      // 1. Create PaymentRefund record
      await tx.paymentRefund.create({
        data: {
          tenantId: payment.tenantId,
          paymentId: payment.id,
          amount: new Prisma.Decimal(refundAmount.toFixed(2)),
          currency: payment.currency,
          reason: trimmedReason,
          refundedBy: actor.email || actor.id,
          status: 'succeeded',
          providerRefundId: `re_${Date.now()}_${Math.random()
            .toString(36)
            .substring(2, 7)}`,
        },
      });

      // 2. Update Payment
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          amountRefunded: new Prisma.Decimal(newTotalRefunded.toFixed(2)),
          status: newStatus,
          refundReason: trimmedReason,
          refundedAt: now,
        },
      });

      // 3. If invoice exists, adjust balance/notes
      if (payment.invoiceId) {
        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: {
            pdfKey: null, // invalidate cached PDF
          },
        });
      }
    });

    // 4. Audit Log
    await this.auditService.log({
      userId: actor.id,
      action: 'payment_refund_issued',
      module: 'billing',
      recordId: payment.id,
      reason: trimmedReason,
      newValue: {
        refundType: dto.refundType,
        refundAmount,
        currency: payment.currency,
        newTotalRefunded,
        paymentStatus: newStatus,
        actor: actor.email,
      },
    });

    return this.getPaymentDetail(payment.id);
  }

  /**
   * View all tenants currently in dunning with their stage and outstanding balance.
   */
  async listDunningTenants(): Promise<DunningTenantView[]> {
    const subscriptions = await this.prisma.unscoped.subscription.findMany({
      where: {
        OR: [
          { status: 'past_due' },
          { dunningStep: { gt: 0 } },
          {
            tenant: {
              status: 'suspended',
              suspensionMode: 'read_only',
            },
          },
        ],
      },
      include: {
        tenant: true,
        plan: true,
        invoices: {
          where: {
            status: { in: ['open', 'past_due'] },
          },
          orderBy: { dueDate: 'asc' },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return subscriptions.map((sub: any) => {
      const step = sub.dunningStep || 1;
      const isSuspended =
        sub.tenant.status === 'suspended' &&
        sub.tenant.suspensionMode === 'read_only';

      let stage: DunningTenantView['dunningStage'] = 'stage_1';
      let stageLabel = 'Stage 1 (Day 0) - Initial Failure & 24h Retry Scheduled';
      let stageDescription =
        'First charge attempt failed. Initial notice sent to billing admin; automated retry queued for Day 1.';

      if (isSuspended || step >= 5) {
        stage = 'suspended';
        stageLabel = 'Stage 5 (Day 10+) - Read-Only Suspension Active';
        stageDescription =
          'Grace period expired with outstanding balance. Tenant access restricted to read-only mode.';
      } else if (step === 4) {
        stage = 'stage_4';
        stageLabel = 'Stage 4 (Day 7-10) - Final Attempt Failed, Grace Period Active';
        stageDescription =
          'Final automated charge failed. 3-day grace period is running before read-only suspension.';
      } else if (step === 3) {
        stage = 'stage_3';
        stageLabel = 'Stage 3 (Day 3-7) - Urgent Notice & Final Retry Scheduled';
        stageDescription =
          'Second retry failed. Urgent notice issued to company owner; final retry scheduled.';
      } else if (step === 2) {
        stage = 'stage_2';
        stageLabel = 'Stage 2 (Day 1-3) - Past Due & 48h Retry Scheduled';
        stageDescription =
          'Subscription marked past due. Second automated retry scheduled in 48 hours.';
      }

      // Calculate total outstanding amount
      const totalOutstanding = sub.invoices.reduce(
        (sum: number, inv: any) => sum + Number(inv.amountDue || inv.total),
        0,
      );

      // Days overdue calculated from earliest unpaid invoice dueDate
      let daysOverdue = 0;
      if (sub.invoices.length > 0 && sub.invoices[0].dueDate) {
        const diff = Date.now() - new Date(sub.invoices[0].dueDate).getTime();
        daysOverdue = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
      } else if (sub.lastDunningAt) {
        const diff = Date.now() - new Date(sub.lastDunningAt).getTime();
        daysOverdue = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
      }

      // Next retry estimation
      let nextRetryAt: string | null = null;
      if (!isSuspended && stage !== 'stage_4') {
        const base = sub.lastDunningAt
          ? new Date(sub.lastDunningAt)
          : new Date();
        const hoursToAdd = step === 1 ? 24 : step === 2 ? 48 : 96;
        nextRetryAt = new Date(
          base.getTime() + hoursToAdd * 60 * 60 * 1000,
        ).toISOString();
      }

      // Grace period ends estimation
      let gracePeriodEndsAt: string | null = null;
      if (stage === 'stage_4' && sub.lastDunningAt) {
        gracePeriodEndsAt = new Date(
          new Date(sub.lastDunningAt).getTime() + 3 * 24 * 60 * 60 * 1000,
        ).toISOString();
      }

      const latestPayment = sub.payments[0];

      return {
        tenantId: sub.tenantId,
        tenantName: sub.tenant.name,
        subdomain: sub.tenant.subdomain,
        subscriptionId: sub.id,
        planId: sub.planId,
        planName: sub.plan?.name || 'Unknown Plan',
        planTier: sub.plan?.code || 'starter',
        billingCycle: sub.billingCycle,
        subscriptionStatus: sub.status,
        dunningStep: step,
        dunningStage: stage,
        dunningStageLabel: stageLabel,
        dunningDescription: stageDescription,
        lastDunningAt: sub.lastDunningAt
          ? sub.lastDunningAt.toISOString()
          : null,
        nextRetryAt,
        daysOverdue,
        gracePeriodEndsAt,
        isSuspended,
        suspensionMode: sub.tenant.suspensionMode,
        totalOutstandingAmount: Number(totalOutstanding.toFixed(2)),
        currency: sub.currency,
        unpaidInvoicesCount: sub.invoices.length,
        latestFailedPayment:
          latestPayment && latestPayment.status === PaymentStatus.failed
            ? {
                id: latestPayment.id,
                amount: Number(latestPayment.amount),
                currency: latestPayment.currency,
                errorCode: latestPayment.errorCode,
                errorMessage: latestPayment.errorMessage,
                failedAt: latestPayment.createdAt.toISOString(),
              }
            : null,
      };
    });
  }

  /**
   * Retry payment recovery for a specific tenant in dunning.
   */
  async retryDunningTenant(
    tenantId: string,
    actor: PlatformActor,
    dto?: RetryPaymentDto,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const failedPayment = await this.prisma.unscoped.payment.findFirst({
      where: {
        tenantId,
        status: PaymentStatus.failed,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (failedPayment) {
      const result = await this.retryPayment(failedPayment.id, actor, dto);
      return {
        success: result.success,
        message: result.message,
      };
    }

    const openInvoice = await this.prisma.unscoped.invoice.findFirst({
      where: {
        tenantId,
        status: { in: ['open', 'past_due'] },
      },
      orderBy: { dueDate: 'asc' },
    });

    if (!openInvoice) {
      throw new NotFoundException(
        `No failed payment or open invoice found for tenant ${tenantId}.`,
      );
    }

    const payment = await this.prisma.unscoped.payment.create({
      data: {
        tenantId,
        invoiceId: openInvoice.id,
        subscriptionId: openInvoice.subscriptionId,
        provider: 'stripe',
        amount: openInvoice.amountDue,
        currency: openInvoice.currency,
        status: PaymentStatus.pending,
      },
    });

    const result = await this.retryPayment(payment.id, actor, dto);
    return {
      success: result.success,
      message: result.message,
    };
  }

  private mapToListItem(r: any): PlatformPaymentListItem {
    return {
      id: r.id,
      tenantId: r.tenantId,
      tenantName: r.tenant?.name || 'Unknown Tenant',
      tenantSubdomain: r.tenant?.subdomain || '',
      invoiceId: r.invoiceId,
      invoiceNumber: r.invoice?.invoiceNumber || null,
      subscriptionId: r.subscriptionId,
      provider: r.provider,
      providerPaymentId: r.providerPaymentId,
      idempotencyKey: r.idempotencyKey,
      amount: Number(r.amount),
      amountRefunded: Number(r.amountRefunded || 0),
      currency: r.currency,
      status: r.status as any,
      errorCode: r.errorCode,
      errorMessage: r.errorMessage,
      paymentMethod: r.paymentMethod,
      refundReason: r.refundReason,
      refundedAt: r.refundedAt ? r.refundedAt.toISOString() : null,
      retryCount: r.retryCount || 0,
      lastRetryAt: r.lastRetryAt ? r.lastRetryAt.toISOString() : null,
      paidAt: r.paidAt ? r.paidAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      refundsCount: r._count?.refunds || 0,
    };
  }
}
