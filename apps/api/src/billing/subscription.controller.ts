import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope, TenantSubscriptionView } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { SubscriptionService } from './subscription.service';

@ApiTags('billing')
@ApiBearerAuth('access-token')
@Controller('tenant/subscription')
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Current plan, included features and usage against plan limits' })
  async get(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<TenantSubscriptionView | null>> {
    if (!user.tenantId) return { data: null };
    return { data: await this.subscriptions.getSubscription(user.tenantId) };
  }
}
