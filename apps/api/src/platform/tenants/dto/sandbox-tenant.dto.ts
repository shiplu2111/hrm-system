import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type {
  CreateSandboxTenantDto as ICreateSandboxTenantDto,
  DeleteSandboxTenantDto as IDeleteSandboxTenantDto,
  ResetSandboxTenantDto as IResetSandboxTenantDto,
  SandboxDemoTemplate,
} from '@hrm/shared-types';

export class CreateSandboxTenantDto implements ICreateSandboxTenantDto {
  @ApiProperty({ description: 'Organization name for the sales demo sandbox' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Subdomain prefix, e.g. "apex-demo"' })
  @IsString()
  @IsNotEmpty()
  subdomain!: string;

  @ApiPropertyOptional({ description: 'ISO 3-letter country code for statutory compliance baseline' })
  @IsString()
  @IsOptional()
  countryCode?: string;

  @ApiProperty({
    description: 'Industry demo template seeded with representative sample data',
    enum: ['tech_saas', 'retail_hospitality', 'enterprise_healthcare', 'manufacturing_logistics'],
  })
  @IsEnum(['tech_saas', 'retail_hospitality', 'enterprise_healthcare', 'manufacturing_logistics'])
  template!: SandboxDemoTemplate;

  @ApiProperty({ description: 'Account Executive or Sales Engineer leading the demo' })
  @IsString()
  @IsNotEmpty()
  demoLeadName!: string;

  @ApiProperty({ description: 'Contact email of the sales demo lead' })
  @IsString()
  @IsNotEmpty()
  demoLeadEmail!: string;

  @ApiPropertyOptional({ description: 'Retention lifetime in days (e.g. 14, 30, or 0 for permanent demo)' })
  @IsNumber()
  @IsOptional()
  durationDays?: number;

  @ApiPropertyOptional({ description: 'Internal staff notes regarding the prospect or opportunity' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ description: 'Mandatory reason for audit logging' })
  @IsString()
  @MinLength(5)
  reason!: string;
}

export class ResetSandboxTenantDto implements IResetSandboxTenantDto {
  @ApiProperty({ description: 'Mandatory reason for resetting sandbox to baseline sample data' })
  @IsString()
  @MinLength(5)
  reason!: string;

  @ApiPropertyOptional({ description: 'Reseed strategy option' })
  @IsString()
  @IsOptional()
  reseedOption?: 'full_clean_slate' | 'preserve_custom_roles';
}

export class DeleteSandboxTenantDto implements IDeleteSandboxTenantDto {
  @ApiProperty({ description: 'Mandatory reason for deleting the sandbox workspace' })
  @IsString()
  @MinLength(5)
  reason!: string;
}
