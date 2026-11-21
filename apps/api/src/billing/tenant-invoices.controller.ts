import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope, InvoiceView } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { PrismaService } from '../database/prisma.service';
import { BillingInvoicingService } from './billing-invoicing.service';
import { DunningService } from './dunning.service';

@ApiTags('billing-invoices')
@ApiBearerAuth('access-token')
@Controller('tenant')
export class TenantInvoicesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicingService: BillingInvoicingService,
    private readonly dunningService: DunningService,
  ) {}

  @Get('invoices')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'List all subscription invoices for the current tenant' })
  async listInvoices(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<InvoiceView[]>> {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant ID missing from authenticated user session');
    }
    const tenantId = user.tenantId;

    const invoices = await this.prisma.unscoped.invoice.findMany({
      where: { tenantId },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });

    const views: InvoiceView[] = invoices.map((inv) => ({
      id: inv.id,
      tenantId: inv.tenantId,
      subscriptionId: inv.subscriptionId,
      invoiceNumber: inv.invoiceNumber,
      currency: inv.currency,
      subtotal: Number(inv.subtotal),
      tax: Number(inv.tax),
      total: Number(inv.total),
      amountPaid: Number(inv.amountPaid),
      amountDue: Number(inv.amountDue),
      status: inv.status as any,
      billingReason: inv.billingReason,
      periodStart: inv.periodStart.toISOString(),
      periodEnd: inv.periodEnd.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      createdAt: inv.createdAt.toISOString(),
      lines: (inv.lines ?? []).map((l: any) => ({
        id: l.id,
        tenantId: l.tenantId,
        invoiceId: l.invoiceId,
        description: l.description,
        quantity: l.quantity,
        unitAmount: Number(l.unitAmount),
        amount: Number(l.amount),
        createdAt: l.createdAt.toISOString(),
      })),
    }));

    return { data: views };
  }

  @Get('invoices/:id')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Get details of a single subscription invoice' })
  async getInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiEnvelope<InvoiceView>> {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant ID missing from authenticated user session');
    }
    const tenantId = user.tenantId;

    const inv = await this.prisma.unscoped.invoice.findFirst({
      where: { id, tenantId },
      include: { lines: true },
    });

    if (!inv) {
      throw new NotFoundException(`Invoice '${id}' not found`);
    }

    const view: InvoiceView = {
      id: inv.id,
      tenantId: inv.tenantId,
      subscriptionId: inv.subscriptionId,
      invoiceNumber: inv.invoiceNumber,
      currency: inv.currency,
      subtotal: Number(inv.subtotal),
      tax: Number(inv.tax),
      total: Number(inv.total),
      amountPaid: Number(inv.amountPaid),
      amountDue: Number(inv.amountDue),
      status: inv.status as any,
      billingReason: inv.billingReason,
      periodStart: inv.periodStart.toISOString(),
      periodEnd: inv.periodEnd.toISOString(),
      dueDate: inv.dueDate.toISOString(),
      paidAt: inv.paidAt ? inv.paidAt.toISOString() : null,
      createdAt: inv.createdAt.toISOString(),
      lines: (inv.lines ?? []).map((l: any) => ({
        id: l.id,
        tenantId: l.tenantId,
        invoiceId: l.invoiceId,
        description: l.description,
        quantity: l.quantity,
        unitAmount: Number(l.unitAmount),
        amount: Number(l.amount),
        createdAt: l.createdAt.toISOString(),
      })),
    };

    return { data: view };
  }

  @Post('invoices/:id/pay')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Retry or execute manual payment for an open invoice' })
  async payInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiEnvelope<{ success: boolean; status: string }>> {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant ID missing from authenticated user session');
    }
    const tenantId = user.tenantId;

    const invoice = await this.prisma.unscoped.invoice.findFirst({
      where: { id, tenantId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice '${id}' not found`);
    }

    const res = await this.invoicingService.chargeInvoice(id, 'manual_pay');

    if (res.success && invoice.subscriptionId) {
      await this.dunningService.handlePaymentSuccess(invoice.subscriptionId);
    }

    return {
      data: {
        success: res.success,
        status: res.success ? 'paid' : 'failed',
      },
    };
  }

  @Post('subscription/pause')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Pause subscription temporarily' })
  async pauseSubscription(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<{ status: string }>> {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant ID missing from authenticated user session');
    }
    const tenantId = user.tenantId;

    const sub = await this.prisma.unscoped.subscription.findFirst({
      where: { tenantId },
    });

    if (!sub) {
      throw new NotFoundException('No active subscription found for tenant');
    }

    await this.prisma.unscoped.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'paused',
        pausedAt: new Date(),
      },
    });

    return { data: { status: 'paused' } };
  }

  @Post('subscription/cancel')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Cancel subscription at period end' })
  async cancelSubscription(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body?: { immediate?: boolean; reason?: string },
  ): Promise<ApiEnvelope<{ status: string; cancelAtPeriodEnd: boolean }>> {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant ID missing from authenticated user session');
    }
    const tenantId = user.tenantId;

    const sub = await this.prisma.unscoped.subscription.findFirst({
      where: { tenantId },
    });

    if (!sub) {
      throw new NotFoundException('No active subscription found for tenant');
    }

    if (body?.immediate) {
      await this.prisma.unscoped.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'cancelled',
          canceledAt: new Date(),
          cancelAtPeriodEnd: false,
        },
      });
      return { data: { status: 'cancelled', cancelAtPeriodEnd: false } };
    }

    await this.prisma.unscoped.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: true,
      },
    });

    return { data: { status: sub.status, cancelAtPeriodEnd: true } };
  }
}
