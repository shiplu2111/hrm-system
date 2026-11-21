import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ApiResponse as ApiEnvelope,
  DunningTenantView,
  PlatformPaymentDetailView,
  PlatformPaymentListItem,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import {
  QueryPlatformPaymentsDto,
  RefundPaymentDto,
  RetryPaymentDto,
} from './dto/platform-payments.dto';
import { PlatformPaymentsService } from './platform-payments.service';

@ApiTags('platform-payments')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform')
export class PlatformPaymentsController {
  constructor(
    private readonly platformPaymentsService: PlatformPaymentsService,
  ) {}

  @Get('payments')
  @RequirePlatformPermission('billing', 'view')
  @ApiOperation({
    summary:
      'List all platform payments (success, failed, refunded) with filters and failure reasons',
  })
  async listPayments(
    @Query() query: QueryPlatformPaymentsDto,
  ): Promise<ApiEnvelope<PlatformPaymentListItem[]>> {
    const list = await this.platformPaymentsService.listPayments(query);
    return { data: list };
  }

  @Get('payments/:id')
  @RequirePlatformPermission('billing', 'view')
  @ApiOperation({
    summary:
      'Get payment detail with line items, error code explanations, and full refund ledger',
  })
  async getPayment(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiEnvelope<PlatformPaymentDetailView>> {
    const detail = await this.platformPaymentsService.getPaymentDetail(id);
    return { data: detail };
  }

  @Post('payments/:id/retry')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({
    summary: 'Retry a failed payment immediately against provider or card on file',
  })
  async retryPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RetryPaymentDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<{ success: boolean; message: string; payment: PlatformPaymentDetailView }>> {
    const actor = {
      id: req.user?.id || 'platform-admin',
      email: req.user?.email || 'admin@cmsnbd.com',
      role: req.user?.role || 'Platform Owner',
    };
    const result = await this.platformPaymentsService.retryPayment(id, actor, dto);
    return { data: result };
  }

  @Post('payments/:id/refund')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({
    summary: 'Issue a full or partial refund on a payment with mandatory audit reason',
  })
  async refundPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundPaymentDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformPaymentDetailView>> {
    const actor = {
      id: req.user?.id || 'platform-admin',
      email: req.user?.email || 'admin@cmsnbd.com',
      role: req.user?.role || 'Platform Owner',
    };
    const detail = await this.platformPaymentsService.refundPayment(id, actor, dto);
    return { data: detail };
  }

  @Get('dunning/tenants')
  @RequirePlatformPermission('billing', 'view')
  @ApiOperation({
    summary:
      'List all tenants currently in automated dunning with their lifecycle stage, overdue balance, and retry status',
  })
  async listDunningTenants(): Promise<ApiEnvelope<DunningTenantView[]>> {
    const list = await this.platformPaymentsService.listDunningTenants();
    return { data: list };
  }

  @Post('dunning/tenants/:tenantId/retry')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({
    summary: 'Trigger immediate payment retry for an overdue tenant in dunning',
  })
  async retryDunningTenant(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: RetryPaymentDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<{ success: boolean; message: string }>> {
    const actor = {
      id: req.user?.id || 'platform-admin',
      email: req.user?.email || 'admin@cmsnbd.com',
      role: req.user?.role || 'Platform Owner',
    };
    const result = await this.platformPaymentsService.retryDunningTenant(tenantId, actor, dto);
    return { data: result };
  }
}
