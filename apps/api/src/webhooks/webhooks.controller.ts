import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { WebhookStatusView } from '@hrm/shared-types';
import {
  WEBHOOK_MAX_ATTEMPTS,
  WEBHOOK_RETRY_DELAYS_MS,
  WEBHOOK_SCHEMA_VERSION,
} from '@hrm/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PlanFeaturesService } from '../billing/plan-features.service';
import { RequireEnterpriseFeature } from '../billing/require-enterprise-feature.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreateTenantWebhookDto,
  ListWebhookDeliveriesQueryDto,
  UpdateTenantWebhookDto,
} from './dto/webhooks.dto';
import { TenantWebhooksService } from './tenant-webhooks.service';
import { WebhookDeliveryQueueService } from './webhook-delivery-queue.service';

/**
 * Viewing, disabling and deleting work on any plan so a tenant that downgrades
 * can still see and switch off its endpoints; everything that sends needs Enterprise.
 */
@ApiTags('webhooks')
@ApiBearerAuth('access-token')
@Controller()
export class WebhooksController {
  constructor(
    private readonly webhooksService: TenantWebhooksService,
    private readonly deliveryQueue: WebhookDeliveryQueueService,
    private readonly planFeatures: PlanFeaturesService,
  ) {}

  @Get('tenant/webhooks/status')
  @RequirePermission('settings', 'view')
  async status(@CurrentUser() user: AuthenticatedUser) {
    const [plan, activeEndpointCount] = await Promise.all([
      this.planFeatures.getTenantPlanInfo(user.tenantId!),
      this.webhooksService.countActive(user.tenantId!),
    ]);
    const data: WebhookStatusView = {
      planId: plan.planId,
      webhooksEnabled: plan.apiAccessEnabled,
      deliveryAvailable: this.deliveryQueue.isAvailable(),
      activeEndpointCount,
      maxAttempts: WEBHOOK_MAX_ATTEMPTS,
      retryDelaysMs: [...WEBHOOK_RETRY_DELAYS_MS],
      schemaVersion: WEBHOOK_SCHEMA_VERSION,
    };
    return { data };
  }

  @Get('tenant/webhooks')
  @RequirePermission('settings', 'view')
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

  @Patch('tenant/webhooks/:webhookId')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Edit an endpoint, or enable/disable it' })
  async updateWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId', ParseUUIDPipe) webhookId: string,
    @Body() dto: UpdateTenantWebhookDto,
  ) {
    return {
      data: await this.webhooksService.updateWebhook(
        user.tenantId!,
        webhookId,
        dto,
        user,
      ),
    };
  }

  @Delete('tenant/webhooks/:webhookId')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Delete an endpoint and its delivery log' })
  async deleteWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId', ParseUUIDPipe) webhookId: string,
  ) {
    return {
      data: await this.webhooksService.deleteWebhook(user.tenantId!, webhookId, user),
    };
  }

  @Post('tenant/webhooks/:webhookId/rotate-secret')
  @RequirePermission('settings', 'edit')
  @RequireEnterpriseFeature('api_access')
  @ApiOperation({ summary: 'Replace the signing secret (shown once)' })
  async rotateSecret(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId', ParseUUIDPipe) webhookId: string,
  ) {
    return {
      data: await this.webhooksService.rotateSecret(user.tenantId!, webhookId, user),
    };
  }

  @Post('tenant/webhooks/:webhookId/test')
  @RequirePermission('settings', 'edit')
  @RequireEnterpriseFeature('api_access')
  @ApiOperation({ summary: 'Send a webhook.test event to the endpoint' })
  async testWebhook(
    @CurrentUser() user: AuthenticatedUser,
    @Param('webhookId', ParseUUIDPipe) webhookId: string,
  ) {
    return {
      data: await this.deliveryQueue.sendTest(user.tenantId!, webhookId, user),
    };
  }

  @Get('tenant/webhook-deliveries')
  @RequirePermission('settings', 'view')
  async listDeliveries(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListWebhookDeliveriesQueryDto,
  ) {
    return {
      data: await this.webhooksService.listDeliveries(user.tenantId!, query),
    };
  }

  @Get('tenant/webhook-deliveries/:deliveryId')
  @RequirePermission('settings', 'view')
  async getDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
  ) {
    return {
      data: await this.webhooksService.getDelivery(user.tenantId!, deliveryId),
    };
  }

  @Post('tenant/webhook-deliveries/:deliveryId/retry')
  @RequirePermission('settings', 'edit')
  @RequireEnterpriseFeature('api_access')
  @ApiOperation({ summary: 'Send a failed delivery again' })
  async retryDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
  ) {
    return {
      data: await this.deliveryQueue.retryDelivery(user.tenantId!, deliveryId, user),
    };
  }
}
