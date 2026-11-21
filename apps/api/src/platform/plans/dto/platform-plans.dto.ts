import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePlatformPlanDto {
  @ApiProperty({ description: 'Unique code slug for the plan (e.g. starter, business)', example: 'starter' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Display name for the plan', example: 'Starter' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ description: 'Plan marketing description', example: 'Essential features for small teams' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Ranking order (0 = Free, 1 = Starter, etc.)', example: 1 })
  @IsInt()
  @IsOptional()
  rank?: number;

  @ApiPropertyOptional({ description: 'Whether the plan is public or hidden', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdatePlatformPlanDto {
  @ApiPropertyOptional({ description: 'Display name for the plan' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Unique code slug for the plan' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: 'Plan marketing description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Ranking order' })
  @IsInt()
  @IsOptional()
  rank?: number;

  @ApiPropertyOptional({ description: 'Whether the plan is public or hidden (isActive)' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class PlanLimitItemDto {
  @ApiProperty({ description: 'Limit key (e.g. employees, storage_gb, api_calls, companies)' })
  @IsString()
  @IsNotEmpty()
  limitKey!: string;

  @ApiPropertyOptional({ description: 'Limit value or null for unlimited' })
  @IsInt()
  @IsOptional()
  value!: number | null;
}

export class UpdatePlanLimitsDto {
  @ApiProperty({ type: [PlanLimitItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanLimitItemDto)
  limits!: PlanLimitItemDto[];
}

export class PlanFeatureItemDto {
  @ApiProperty({ description: 'Feature key (e.g. roster, attendance, api_access)' })
  @IsString()
  @IsNotEmpty()
  featureKey!: string;

  @ApiProperty({ description: 'Whether this feature is enabled for the plan' })
  @IsBoolean()
  enabled!: boolean;
}

export class UpdatePlanFeaturesDto {
  @ApiProperty({ type: [PlanFeatureItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanFeatureItemDto)
  features!: PlanFeatureItemDto[];
}

export class TogglePlanFeatureDto {
  @ApiProperty({ description: 'Plan UUID' })
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @ApiProperty({ description: 'Feature key (e.g. roster, attendance, api_access)' })
  @IsString()
  @IsNotEmpty()
  featureKey!: string;

  @ApiProperty({ description: 'Enabled state' })
  @IsBoolean()
  enabled!: boolean;
}

export class CreatePlanPriceDto {
  @ApiProperty({ description: 'ISO 4217 currency code (USD, AUD, EUR, GBP, BDT)', example: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency!: string;

  @ApiProperty({ description: 'Billing cycle (monthly or annual)', enum: ['monthly', 'annual'] })
  @IsIn(['monthly', 'annual'])
  billingCycle!: 'monthly' | 'annual';

  @ApiProperty({ description: 'Base subscription price', example: 99.0 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ description: 'Per-seat price (if applicable)', example: 4.5 })
  @IsNumber()
  @IsOptional()
  @Min(0)
  perSeatAmount?: number | null;

  @ApiProperty({ description: 'Effective from date (ISO string)', example: '2026-12-01T00:00:00.000Z' })
  @IsDateString()
  effectiveFrom!: string;
}
