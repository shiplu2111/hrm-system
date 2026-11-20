import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type { PlatformTenantSuspensionMode } from '@hrm/shared-types';

export class ProvisionTenantDto {
  @ApiProperty({
    description: 'Full organization/tenant name',
    example: 'Acme Global Corp',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description:
      'Unique tenant subdomain identifier (lowercase alphanumeric and hyphens)',
    example: 'acme-corp',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, {
    message:
      'subdomain must be 3-63 lowercase alphanumeric characters or hyphens, starting and ending with an alphanumeric character',
  })
  subdomain!: string;

  @ApiPropertyOptional({
    description: 'Plan tier identifier',
    example: 'trial',
    default: 'trial',
  })
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({
    description: 'Billing cycle: monthly or annual',
    enum: ['monthly', 'annual'],
    default: 'monthly',
  })
  @IsOptional()
  @IsIn(['monthly', 'annual'])
  billingCycle?: 'monthly' | 'annual';

  @ApiPropertyOptional({
    description: 'Trial duration in days (e.g. 7, 14, 30)',
    example: 14,
    default: 14,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  trialDays?: number;

  @ApiPropertyOptional({
    description: 'Country ISO code (3 letters, e.g. BGD, USA, SGP)',
    example: 'BGD',
  })
  @IsOptional()
  @IsString()
  countryCode?: string;

  @ApiPropertyOptional({
    description: 'Storage driver for uploads',
    enum: ['local', 's3'],
    default: 'local',
  })
  @IsOptional()
  @IsIn(['local', 's3'])
  storageDriver?: 'local' | 's3';

  @ApiProperty({
    description: 'Email address of the initial Company Owner',
    example: 'owner@acme.com',
  })
  @IsEmail()
  @IsNotEmpty()
  ownerEmail!: string;

  @ApiProperty({
    description: 'First name of Company Owner',
    example: 'Jane',
  })
  @IsString()
  @IsNotEmpty()
  ownerFirstName!: string;

  @ApiProperty({
    description: 'Last name of Company Owner',
    example: 'Doe',
  })
  @IsString()
  @IsNotEmpty()
  ownerLastName!: string;

  @ApiProperty({
    description: 'Mandatory reason for provisioning the tenant workspace',
    example: 'New self-serve business signup approval',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class SuspendTenantDto {
  @ApiProperty({
    description:
      'Suspension mode: read_only allows read access but blocks mutations; fully_blocked cuts off all access',
    enum: ['read_only', 'fully_blocked'],
  })
  @IsIn(['read_only', 'fully_blocked'])
  mode!: PlatformTenantSuspensionMode;

  @ApiProperty({
    description: 'Mandatory reason for suspending tenant',
    example: 'Past due balance exceeding 60-day terms',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class RestoreTenantDto {
  @ApiProperty({
    description: 'Mandatory reason for restoring tenant',
    example: 'Payment cleared by finance team',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class CancelTenantDto {
  @ApiProperty({
    description: 'Mandatory reason for tenant cancellation',
    example: 'Customer churn requested by account contact',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class ScheduleDeletionDto {
  @ApiPropertyOptional({
    description:
      'Grace period in days before hard deletion can proceed (default: 30 days)',
    default: 30,
    minimum: 1,
    maximum: 365,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  gracePeriodDays?: number;

  @ApiProperty({
    description: 'Mandatory reason for scheduling tenant deletion',
    example: 'GDPR right-to-be-forgotten request',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class HardDeleteTenantDto {
  @ApiProperty({
    description: 'Mandatory reason for executing final hard deletion',
    example:
      '30-day grace period expired and confirmed by compliance officer',
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
