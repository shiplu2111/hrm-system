import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type {
  ApiResponse as ApiEnvelope,
  PlanChangePreview,
  PlanChangeResult,
  TenantSubscriptionView,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { SubscriptionService } from './subscription.service';
import { PlanChangeService } from './plan-change.service';

@ApiTags('billing')
@ApiBearerAuth('access-token')
@Controller('tenant/subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly planChangeService: PlanChangeService,
  ) {}

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Current plan, included features and usage against plan limits' })
  async get(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<TenantSubscriptionView | null>> {
    if (!user.tenantId) return { data: null };
    return { data: await this.subscriptions.getSubscription(user.tenantId) };
  }

  @Get('plan-change-preview')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Preview plan upgrade (prorated charge) or downgrade (block check & next renewal)' })
  @ApiQuery({ name: 'targetPlanCode', required: true, type: String })
  async previewPlanChange(
    @CurrentUser() user: AuthenticatedUser,
    @Query('targetPlanCode') targetPlanCode: string,
  ): Promise<ApiEnvelope<PlanChangePreview>> {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant ID missing from authenticated user session');
    }
    if (!targetPlanCode) {
      throw new BadRequestException('targetPlanCode query parameter is required');
    }
    const preview = await this.planChangeService.previewPlanChange(user.tenantId, targetPlanCode);
    return { data: preview };
  }

  @Post('change-plan')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Execute plan change (immediate upgrade or scheduled downgrade)' })
  async changePlan(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { targetPlanCode: string },
  ): Promise<ApiEnvelope<PlanChangeResult>> {
    if (!user.tenantId) {
      throw new BadRequestException('Tenant ID missing from authenticated user session');
    }
    if (!body?.targetPlanCode) {
      throw new BadRequestException('targetPlanCode body property is required');
    }
    const result = await this.planChangeService.executePlanChange(user.tenantId, body.targetPlanCode);
    return { data: result };
  }
}

