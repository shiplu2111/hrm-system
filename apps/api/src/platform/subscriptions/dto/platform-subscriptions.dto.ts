import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type {
  PlatformApplyDiscountRequest,
  PlatformCancelSubscriptionRequest,
  PlatformChangePlanRequest,
  PlatformExtendTrialRequest,
  PlatformPauseSubscriptionRequest,
} from '@hrm/shared-types';

export class QueryPlatformSubscriptionsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  planId?: string;
}

export class PlatformChangePlanDto implements PlatformChangePlanRequest {
  @ApiProperty({ description: 'Target plan ID or code' })
  @IsString()
  @IsNotEmpty()
  targetPlanId!: string;

  @ApiPropertyOptional({ description: 'Whether change takes effect immediately or on renewal' })
  @IsOptional()
  @IsBoolean()
  effectiveImmediately?: boolean;

  @ApiPropertyOptional({ description: 'Reason for plan change' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PlatformExtendTrialDto implements PlatformExtendTrialRequest {
  @ApiPropertyOptional({ description: 'Number of days to extend' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  days?: number;

  @ApiPropertyOptional({ description: 'Explicit new trial end date ISO string' })
  @IsOptional()
  @IsString()
  newTrialEndsAt?: string;

  @ApiProperty({ description: 'Mandatory reason for trial extension' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class PlatformApplyDiscountDto implements PlatformApplyDiscountRequest {
  @ApiPropertyOptional({ description: 'Percentage discount (1 - 100)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ description: 'Fixed dollar credit amount to add to credit balance' })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  creditAmount?: number;

  @ApiProperty({ description: 'Mandatory reason for applying discount or credit' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class PlatformPauseSubscriptionDto implements PlatformPauseSubscriptionRequest {
  @ApiProperty({ description: 'Mandatory reason for pausing subscription' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class PlatformResumeSubscriptionDto {
  @ApiPropertyOptional({ description: 'Optional reason for resuming subscription' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class PlatformCancelSubscriptionDto implements PlatformCancelSubscriptionRequest {
  @ApiProperty({ description: 'Whether to cancel immediately or at period end' })
  @IsBoolean()
  cancelImmediately!: boolean;

  @ApiProperty({ description: 'Mandatory reason for cancellation' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
