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
  PlatformSubscriptionDetailView,
  PlatformSubscriptionListItem,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import {
  PlatformApplyDiscountDto,
  PlatformCancelSubscriptionDto,
  PlatformChangePlanDto,
  PlatformExtendTrialDto,
  PlatformPauseSubscriptionDto,
  PlatformResumeSubscriptionDto,
  QueryPlatformSubscriptionsDto,
} from './dto/platform-subscriptions.dto';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';

@ApiTags('platform-subscriptions')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/subscriptions')
export class PlatformSubscriptionsController {
  constructor(
    private readonly platformSubscriptionsService: PlatformSubscriptionsService,
  ) {}

  @Get()
  @RequirePlatformPermission('billing', 'view')
  @ApiOperation({
    summary:
      'List all tenant subscriptions with pricing, cycle, and renewal dates',
  })
  async listSubscriptions(
    @Query() query: QueryPlatformSubscriptionsDto,
  ): Promise<ApiEnvelope<PlatformSubscriptionListItem[]>> {
    const list =
      await this.platformSubscriptionsService.listSubscriptions(query);
    return { data: list };
  }

  @Get(':id')
  @RequirePlatformPermission('billing', 'view')
  @ApiOperation({
    summary:
      'Get subscription detail, timeline, limits, and plan change history',
  })
  async getSubscription(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiEnvelope<PlatformSubscriptionDetailView>> {
    const detail =
      await this.platformSubscriptionsService.getSubscriptionDetail(id);
    return { data: detail };
  }

  @Post(':id/change-plan')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({
    summary:
      'Change tenant plan (immediate upgrade or renewal transition) with change history logging',
  })
  async changePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlatformChangePlanDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformSubscriptionDetailView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const updated = await this.platformSubscriptionsService.changePlan(
      id,
      dto,
      actor,
      ipAddress,
      userAgent,
    );
    return { data: updated };
  }

  @Post(':id/extend-trial')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({
    summary:
      'Extend tenant trial end date with mandatory justification reason',
  })
  async extendTrial(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlatformExtendTrialDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformSubscriptionDetailView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const updated = await this.platformSubscriptionsService.extendTrial(
      id,
      dto,
      actor,
      ipAddress,
      userAgent,
    );
    return { data: updated };
  }

  @Post(':id/discount')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({
    summary:
      'Apply a percentage discount or dollar credit balance with mandatory justification reason',
  })
  async applyDiscountOrCredit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlatformApplyDiscountDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformSubscriptionDetailView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const updated =
      await this.platformSubscriptionsService.applyDiscountOrCredit(
        id,
        dto,
        actor,
        ipAddress,
        userAgent,
      );
    return { data: updated };
  }

  @Post(':id/pause')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({
    summary: 'Pause an active subscription with justification reason',
  })
  async pauseSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlatformPauseSubscriptionDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformSubscriptionDetailView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const updated =
      await this.platformSubscriptionsService.pauseSubscription(
        id,
        dto,
        actor,
        ipAddress,
        userAgent,
      );
    return { data: updated };
  }

  @Post(':id/resume')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({ summary: 'Resume a paused subscription' })
  async resumeSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlatformResumeSubscriptionDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformSubscriptionDetailView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const updated =
      await this.platformSubscriptionsService.resumeSubscription(
        id,
        dto,
        actor,
        ipAddress,
        userAgent,
      );
    return { data: updated };
  }

  @Post(':id/cancel')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({
    summary:
      'Cancel subscription immediately or at period end with mandatory reason',
  })
  async cancelSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PlatformCancelSubscriptionDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformSubscriptionDetailView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const updated =
      await this.platformSubscriptionsService.cancelSubscription(
        id,
        dto,
        actor,
        ipAddress,
        userAgent,
      );
    return { data: updated };
  }
}
