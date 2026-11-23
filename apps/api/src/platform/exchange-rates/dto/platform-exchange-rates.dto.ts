import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import type {
  CreatePlatformExchangeRateInput,
  ManualOverridePlatformRateInput,
  PlatformRateSource,
  SyncProviderRatesInput,
} from '@hrm/shared-types';

export class CreatePlatformExchangeRateDto implements CreatePlatformExchangeRateInput {
  @ApiProperty({ description: '3-letter ISO code for base currency (e.g. AUD, USD)', example: 'AUD' })
  @IsString()
  @Length(3, 3)
  baseCurrency: string;

  @ApiProperty({ description: '3-letter ISO code for quote currency (e.g. USD, BDT)', example: 'USD' })
  @IsString()
  @Length(3, 3)
  quoteCurrency: string;

  @ApiProperty({ description: 'Base currency units per 1 quote currency unit (e.g. 1.54)', example: '1.54200000' })
  @IsNotEmpty()
  rate: string | number;

  @ApiPropertyOptional({ description: 'Effective from date (YYYY-MM-DD)', example: '2026-01-01' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'effectiveFrom must be YYYY-MM-DD' })
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Effective to date (YYYY-MM-DD, null for open-ended)', example: '2026-12-31' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'effectiveTo must be YYYY-MM-DD' })
  effectiveTo?: string | null;

  @ApiPropertyOptional({ description: 'Rate source kind', enum: ['manual', 'provider', 'manual_override'] })
  @IsOptional()
  @IsIn(['manual', 'provider', 'manual_override'])
  source?: PlatformRateSource;

  @ApiPropertyOptional({ description: 'Name of the provider source', example: 'platform_fx_feed' })
  @IsOptional()
  @IsString()
  providerName?: string;

  @ApiPropertyOptional({ description: 'Internal administrative notes' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ManualOverridePlatformRateDto implements ManualOverridePlatformRateInput {
  @ApiProperty({ description: '3-letter ISO code for base currency', example: 'AUD' })
  @IsString()
  @Length(3, 3)
  baseCurrency: string;

  @ApiProperty({ description: '3-letter ISO code for quote currency', example: 'USD' })
  @IsString()
  @Length(3, 3)
  quoteCurrency: string;

  @ApiProperty({ description: 'Overridden rate (Base units per 1 Quote)', example: '1.55000000' })
  @IsNotEmpty()
  rate: string | number;

  @ApiProperty({ description: 'Effective from date (YYYY-MM-DD)', example: '2026-11-23' })
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'effectiveFrom must be YYYY-MM-DD' })
  effectiveFrom: string;

  @ApiPropertyOptional({ description: 'Effective to date (YYYY-MM-DD, null for open-ended)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'effectiveTo must be YYYY-MM-DD' })
  effectiveTo?: string | null;

  @ApiProperty({
    description: 'Mandatory reason for manual administrative override per platform audit policy',
    example: 'Central Bank official circular fixing statutory exchange rate for Q4',
  })
  @IsString()
  @MinLength(5, { message: 'Override reason must be at least 5 characters long' })
  reason: string;

  @ApiPropertyOptional({ description: 'Additional administrative context or references' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SyncProviderRatesDto implements SyncProviderRatesInput {
  @ApiPropertyOptional({ description: 'Target rate provider ID (defaults to active provider)', example: 'platform_fx_feed' })
  @IsOptional()
  @IsString()
  providerId?: string;

  @ApiPropertyOptional({ description: 'Base currency to fetch rates for (e.g. AUD, USD)', example: 'AUD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  baseCurrency?: string;

  @ApiPropertyOptional({ description: 'Target quote currencies to fetch', example: ['USD', 'EUR', 'GBP', 'BDT'] })
  @IsOptional()
  @IsArray()
  quoteCurrencies?: string[];
}

export class QueryPlatformExchangeRatesDto {
  @ApiPropertyOptional({ description: 'Filter by base currency' })
  @IsOptional()
  @IsString()
  baseCurrency?: string;

  @ApiPropertyOptional({ description: 'Filter by quote currency' })
  @IsOptional()
  @IsString()
  quoteCurrency?: string;

  @ApiPropertyOptional({ description: 'Filter by source (manual, provider, manual_override)' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ description: 'As of date for resolution (YYYY-MM-DD)' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'asOfDate must be YYYY-MM-DD' })
  asOfDate?: string;
}
