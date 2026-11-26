import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { ApiResponse as ApiEnvelope, PublicPlanView } from '@hrm/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PublicPlansService } from './public-plans.service';

@ApiTags('public-plans')
@SkipTenantScope()
@Public()
@Controller('public/plans')
export class PublicPlansController {
  constructor(private readonly publicPlansService: PublicPlansService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=10, s-maxage=10, stale-while-revalidate=30')
  @ApiOperation({
    summary: 'List publicly visible subscription plans and active prices',
    description:
      'Unauthenticated, rate-limited, cacheable endpoint returning only public non-custom plans with customer-friendly feature/limit labels and active effective-dated pricing per currency and billing cycle. Never exposes hidden plans, internal notes, cost data, or tenant information.',
  })
  @ApiResponse({ status: 200, description: 'Public subscription plans retrieved successfully' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async listPublicPlans(): Promise<ApiEnvelope<PublicPlanView[]>> {
    const data = await this.publicPlansService.listPublicPlans();
    return { data };
  }
}
