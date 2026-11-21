import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type {
  CreatePlatformFeatureFlagRequest,
  SetTenantFeatureOverrideRequest,
  UpdatePlatformFeatureFlagRequest,
} from '@hrm/shared-types';

export class CreatePlatformFeatureFlagDto implements CreatePlatformFeatureFlagRequest {
  @ApiProperty({ description: 'Unique feature flag key/slug', example: 'beta_ai_scheduling' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiPropertyOptional({ description: 'Description of the feature flag purpose' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Default fallback state when not targeted by rollout', default: false })
  @IsOptional()
  @IsBoolean()
  defaultState?: boolean;

  @ApiPropertyOptional({ description: 'Gradual rollout percentage (0 to 100)', default: 0, minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @ApiPropertyOptional({ description: 'Arbitrary metadata object' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdatePlatformFeatureFlagDto implements UpdatePlatformFeatureFlagRequest {
  @ApiPropertyOptional({ description: 'Updated description of the feature flag' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Default fallback state when not targeted by rollout' })
  @IsOptional()
  @IsBoolean()
  defaultState?: boolean;

  @ApiPropertyOptional({ description: 'Gradual rollout percentage (0 to 100)', minimum: 0, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  rolloutPercentage?: number;

  @ApiPropertyOptional({ description: 'Arbitrary metadata object' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class SetTenantFeatureOverrideDto implements SetTenantFeatureOverrideRequest {
  @ApiProperty({ description: 'Feature key to override for this tenant', example: 'roster' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ description: 'Explicit override value: true enables, false blocks', example: true })
  @IsBoolean()
  value!: boolean;

  @ApiProperty({ description: 'Justification for granting or restricting this override (required for audit)', example: 'VIP Beta customer' })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiPropertyOptional({ description: 'Optional ISO timestamp when this override expires', example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}
