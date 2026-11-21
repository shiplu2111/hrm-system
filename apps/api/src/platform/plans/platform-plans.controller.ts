import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope, PlatformPlanDetailView, PlatformPlanFeatureView, PlatformPlanPriceView } from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import {
  CreatePlanPriceDto,
  CreatePlatformPlanDto,
  TogglePlanFeatureDto,
  UpdatePlanFeaturesDto,
  UpdatePlanLimitsDto,
  UpdatePlatformPlanDto,
} from './dto/platform-plans.dto';
import { PlatformPlansService } from './platform-plans.service';

@ApiTags('platform-plans')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/plans')
export class PlatformPlansController {
  constructor(private readonly platformPlansService: PlatformPlansService) {}

  @Get()
  @RequirePlatformPermission('billing', 'view')
  @ApiOperation({ summary: 'List all subscription plans with features, limits, and prices' })
  async listPlans(): Promise<ApiEnvelope<PlatformPlanDetailView[]>> {
    const plans = await this.platformPlansService.listPlans();
    return { data: plans };
  }

  @Get(':id')
  @RequirePlatformPermission('billing', 'view')
  @ApiOperation({ summary: 'Get details of a single plan' })
  async getPlan(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiEnvelope<PlatformPlanDetailView>> {
    const plan = await this.platformPlansService.getPlan(id);
    return { data: plan };
  }

  @Post()
  @RequirePlatformPermission('billing', 'create')
  @ApiOperation({ summary: 'Create a new subscription plan' })
  async createPlan(
    @Body() dto: CreatePlatformPlanDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformPlanDetailView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const plan = await this.platformPlansService.createPlan(dto, actor, ipAddress, userAgent);
    return { data: plan };
  }

  @Patch(':id')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({ summary: 'Update plan general settings (name, description, rank, public/hidden isActive)' })
  async updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlatformPlanDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformPlanDetailView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const plan = await this.platformPlansService.updatePlan(id, dto, actor, ipAddress, userAgent);
    return { data: plan };
  }

  @Put(':id/limits')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({ summary: 'Update plan limit caps (employees, storage, API calls, companies)' })
  async updateLimits(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanLimitsDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformPlanDetailView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const plan = await this.platformPlansService.updateLimits(id, dto, actor, ipAddress, userAgent);
    return { data: plan };
  }

  @Put(':id/features')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({ summary: 'Batch update plan features' })
  async updateFeatures(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanFeaturesDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformPlanDetailView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const plan = await this.platformPlansService.updateFeatures(id, dto, actor, ipAddress, userAgent);
    return { data: plan };
  }

  @Patch('features/toggle')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({ summary: 'Toggle a single feature for a plan in the Feature Matrix Grid' })
  async toggleFeature(
    @Body() dto: TogglePlanFeatureDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformPlanFeatureView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const feature = await this.platformPlansService.toggleFeature(dto, actor, ipAddress, userAgent);
    return { data: feature };
  }

  @Post(':id/prices')
  @RequirePlatformPermission('billing', 'edit')
  @ApiOperation({
    summary: 'Add an effective-dated price point for a plan (grandfathering existing subscriptions)',
  })
  async createPrice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePlanPriceDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformPlanPriceView>> {
    const actor = req.platformUser ?? req.user;
    const ipAddress = req.ip || req.headers['x-forwarded-for'];
    const userAgent = req.headers['user-agent'];
    const price = await this.platformPlansService.createPrice(id, dto, actor, ipAddress, userAgent);
    return { data: price };
  }
}
