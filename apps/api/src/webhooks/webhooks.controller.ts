import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequireEnterpriseFeature } from '../billing/require-enterprise-feature.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreateTenantWebhookDto,
} from './dto/webhooks.dto';
import { TenantWebhooksService } from './tenant-webhooks.service';
import { WebhookDeliveryQueueService } from './webhook-delivery-queue.service';

@ApiTags('webhooks')
@ApiBearerAuth('access-token')
@Controller()
export class WebhooksController {
  constructor(
    private readonly webhooksService: TenantWebhooksService,
    private readonly deliveryQueue: WebhookDeliveryQueueService,
  ) {}

  @Get('tenant/webhooks')
  @RequirePermission('settings', 'view')
  @RequireEnterpriseFeature('api_access')
  async listWebhooks(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.webhooksService.listWebhooks(user.tenantId!),
    };
  }

  @Post('tenant/webhooks')
  @RequirePermission('settings', 'edit')
  @RequireEnterpriseFeature('api_access')
  async createWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTenantWebhookDto,
  ) {
    return {
      data: await this.webhooksService.createWebhook(user.tenantId!, dto, user),
    };
  }

  @Delete('tenant/webhooks/:webhookId')
  @RequirePermission('settings', 'edit')
  @RequireEnterpriseFeature('api_access')
  async disableWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId', ParseUUIDPipe) webhookId: string,
  ) {
    return {
      data: await this.webhooksService.disableWebhook(
        user.tenantId!,
        webhookId,
        user,
      ),
    };
  }

  @Get('tenant/webhook-deliveries')
  @RequirePermission('settings', 'view')
  @RequireEnterpriseFeature('api_access')
  async listDeliveries(
    @CurrentUser() user: AuthenticatedUser,
    @Query('webhookId') webhookId?: string,
  ) {
    return {
      data: await this.webhooksService.listDeliveries(
        user.tenantId!,
        webhookId,
      ),
    };
  }

  @Post('tenant/webhooks/:webhookId/test')
  @RequirePermission('settings', 'edit')
  @RequireEnterpriseFeature('api_access')
  @ApiOperation({ summary: 'Send a test webhook ping' })
  async testWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId', ParseUUIDPipe) webhookId: string,
  ) {
    const webhooks = await this.webhooksService.listWebhooks(user.tenantId!);
    const target = webhooks.find((row) => row.id === webhookId);
    if (!target) {
      return { data: { queued: false, webhookId } };
    }

    await this.deliveryQueue.enqueue({
      tenantId: user.tenantId!,
      companyId: target.companyId ?? user.tenantId!,
      eventType: 'employee.created',
      eventId: `test-${webhookId}-${Date.now()}`,
      webhookId,
      data: {
        test: true,
        message: 'Webhook connectivity test from HRM',
        triggeredByUserId: user.id,
      },
    });
    return { data: { queued: true, webhookId } };
  }
}
