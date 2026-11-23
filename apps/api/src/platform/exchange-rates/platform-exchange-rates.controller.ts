import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import type {
  PlatformExchangeRatePairSummary,
  PlatformExchangeRateProviderDef,
  PlatformExchangeRateRecord,
  ResolvedPlatformExchangeRate,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformExchangeRatesService } from './platform-exchange-rates.service';
import {
  CreatePlatformExchangeRateDto,
  ManualOverridePlatformRateDto,
  QueryPlatformExchangeRatesDto,
  SyncProviderRatesDto,
} from './dto/platform-exchange-rates.dto';

@ApiTags('platform-exchange-rates')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/exchange-rates')
export class PlatformExchangeRatesController {
  constructor(
    private readonly exchangeRatesService: PlatformExchangeRatesService,
  ) {}

  @Get()
  @RequirePlatformPermission('country', 'view')
  @ApiOperation({ summary: 'List all platform currency pairs with current rate and status' })
  async listPairs(
    @Query() query: QueryPlatformExchangeRatesDto,
  ): Promise<ApiEnvelope<PlatformExchangeRatePairSummary[]>> {
    const data = await this.exchangeRatesService.listPairs(query);
    return { data };
  }

  @Get('history')
  @RequirePlatformPermission('country', 'view')
  @ApiOperation({ summary: 'Get complete historical rate table for a currency pair' })
  async getPairHistory(
    @Query('baseCurrency') baseCurrency: string,
    @Query('quoteCurrency') quoteCurrency: string,
  ): Promise<ApiEnvelope<PlatformExchangeRateRecord[]>> {
    const data = await this.exchangeRatesService.getPairHistory(
      baseCurrency || 'AUD',
      quoteCurrency || 'USD',
    );
    return { data };
  }

  @Get('resolve')
  @RequirePlatformPermission('country', 'view')
  @ApiOperation({ summary: 'Resolve platform default rate active on a specific date' })
  async resolveRate(
    @Query('baseCurrency') baseCurrency: string,
    @Query('quoteCurrency') quoteCurrency: string,
    @Query('asOfDate') asOfDate?: string,
  ): Promise<ApiEnvelope<ResolvedPlatformExchangeRate>> {
    const data = await this.exchangeRatesService.resolveRate(
      baseCurrency || 'AUD',
      quoteCurrency || 'USD',
      asOfDate,
    );
    return { data };
  }

  @Get('providers')
  @RequirePlatformPermission('country', 'view')
  @ApiOperation({ summary: 'List available exchange rate source providers' })
  async listProviders(): Promise<ApiEnvelope<PlatformExchangeRateProviderDef[]>> {
    const data = this.exchangeRatesService.listProviders();
    return { data };
  }

  @Post()
  @RequirePlatformPermission('country', 'edit')
  @ApiOperation({ summary: 'Create a new effective-dated platform rate version (never overwrites)' })
  async createRateVersion(
    @Body() dto: CreatePlatformExchangeRateDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<PlatformExchangeRateRecord>> {
    const actorId = (req as any).user?.id || (req as any).platformUser?.id || 'system';
    const data = await this.exchangeRatesService.createRateVersion(dto, actorId);
    return { data };
  }

  @Post('override')
  @RequirePlatformPermission('country', 'edit')
  @ApiOperation({ summary: 'Create a manual rate override with mandatory reason (never overwrites)' })
  async createManualOverride(
    @Body() dto: ManualOverridePlatformRateDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<PlatformExchangeRateRecord>> {
    const actorId = (req as any).user?.id || (req as any).platformUser?.id || 'system';
    const data = await this.exchangeRatesService.createManualOverride(dto, actorId);
    return { data };
  }

  @Post('sync')
  @RequirePlatformPermission('country', 'edit')
  @ApiOperation({ summary: 'Sync benchmark rates from provider behind standard interface' })
  async syncFromProvider(
    @Body() dto: SyncProviderRatesDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<{ syncedCount: number; rates: PlatformExchangeRateRecord[] }>> {
    const actorId = (req as any).user?.id || (req as any).platformUser?.id || 'system';
    const data = await this.exchangeRatesService.syncFromProvider(dto, actorId);
    return { data };
  }
}
