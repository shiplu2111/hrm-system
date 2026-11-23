import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import type {
  ComplianceDueDateRule,
  ComplianceEventCategory,
  ComplianceEventStatus,
  ComplianceNoticeJobRunInput,
  ComplianceRecurrence,
  CreateComplianceEventInput,
  UpdateComplianceEventInput,
} from '@hrm/shared-types';

export class ComplianceDueDateRuleDto implements ComplianceDueDateRule {
  @ApiPropertyOptional({ description: 'Day of the month for monthly/quarterly recurrence (1-31)', example: 21 })
  @IsOptional()
  @IsInt()
  @Min(1)
  dayOfMonth?: number;

  @ApiPropertyOptional({ description: 'Month of the year for yearly recurrence (1-12)', example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  month?: number;

  @ApiPropertyOptional({
    description: 'Quarterly months when obligation is due (e.g. [1, 4, 7, 10])',
    example: [1, 4, 7, 10],
  })
  @IsOptional()
  @IsArray()
  quarterMonthOffsets?: number[];

  @ApiPropertyOptional({ description: 'Fixed date (YYYY-MM-DD) for fixed_date recurrence', example: '2026-12-31' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'specificDate must be in YYYY-MM-DD format' })
  specificDate?: string;

  @ApiPropertyOptional({ description: 'Whether the due date is strictly the last day of the target month', default: false })
  @IsOptional()
  lastDayOfMonth?: boolean;

  @ApiPropertyOptional({ description: 'Business days adjustment (+/-)', default: 0 })
  @IsOptional()
  @IsInt()
  businessDaysOffset?: number;
}

export class CreateComplianceEventDto implements CreateComplianceEventInput {
  @ApiProperty({ description: 'Country jurisdiction UUID', example: '10000000-0000-4000-8000-000000000002' })
  @IsNotEmpty()
  @IsUUID()
  countryId: string;

  @ApiPropertyOptional({ description: 'State / Province UUID if state-specific obligation', nullable: true })
  @IsOptional()
  @IsUUID()
  stateProvinceId?: string | null;

  @ApiProperty({ description: 'Compliance event title', example: 'Monthly PAYG Withholding Return' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiPropertyOptional({ description: 'Detailed statutory description of the compliance obligation' })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Statutory compliance category',
    enum: ['tax_filing', 'statutory_reporting', 'social_security_remittance', 'license_renewal', 'labor_audit', 'general'],
    default: 'tax_filing',
  })
  @IsOptional()
  @IsEnum(['tax_filing', 'statutory_reporting', 'social_security_remittance', 'license_renewal', 'labor_audit', 'general'])
  category?: ComplianceEventCategory;

  @ApiProperty({
    description: 'Recurrence frequency',
    enum: ['monthly', 'quarterly', 'yearly', 'fixed_date'],
    example: 'monthly',
  })
  @IsNotEmpty()
  @IsEnum(['monthly', 'quarterly', 'yearly', 'fixed_date'])
  recurrence: ComplianceRecurrence;

  @ApiProperty({ description: 'Structured due-date rule JSON', type: ComplianceDueDateRuleDto })
  @IsNotEmpty()
  @IsObject()
  dueDateRule: ComplianceDueDateRule;

  @ApiPropertyOptional({ description: 'Applicable subscription plans (empty = all plans)', example: ['growth', 'enterprise'] })
  @IsOptional()
  @IsArray()
  applicablePlans?: string[];

  @ApiPropertyOptional({ description: 'Applicable company type (e.g. pty_ltd, public, non_profit; null = all)', example: 'pty_ltd' })
  @IsOptional()
  @IsString()
  companyType?: string | null;

  @ApiPropertyOptional({ description: 'Statutory citation or legal source reference', example: 'Taxation Administration Act 1953 §16-150' })
  @IsOptional()
  @IsString()
  sourceReference?: string | null;

  @ApiPropertyOptional({ description: 'Advance notice period in days before due date', default: 7, example: 7 })
  @IsOptional()
  @IsInt()
  @Min(1)
  noticeDaysBefore?: number;

  @ApiPropertyOptional({ description: 'Statutory penalty summary for late lodgement' })
  @IsOptional()
  @IsString()
  penaltiesSummary?: string | null;

  @ApiPropertyOptional({ description: 'Government or tax authority portal link for submission' })
  @IsOptional()
  @IsString()
  filingPortalUrl?: string | null;

  @ApiPropertyOptional({ description: 'Specific action required by payroll/HR team' })
  @IsOptional()
  @IsString()
  actionRequired?: string | null;

  @ApiPropertyOptional({ description: 'Event active status', enum: ['active', 'inactive', 'archived'], default: 'active' })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'archived'])
  status?: ComplianceEventStatus;
}

export class UpdateComplianceEventDto implements UpdateComplianceEventInput {
  @ApiPropertyOptional({ description: 'Country jurisdiction UUID' })
  @IsOptional()
  @IsUUID()
  countryId?: string;

  @ApiPropertyOptional({ description: 'State / Province UUID' })
  @IsOptional()
  @IsUUID()
  stateProvinceId?: string | null;

  @ApiPropertyOptional({ description: 'Compliance event title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Detailed statutory description' })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Statutory category',
    enum: ['tax_filing', 'statutory_reporting', 'social_security_remittance', 'license_renewal', 'labor_audit', 'general'],
  })
  @IsOptional()
  @IsEnum(['tax_filing', 'statutory_reporting', 'social_security_remittance', 'license_renewal', 'labor_audit', 'general'])
  category?: ComplianceEventCategory;

  @ApiPropertyOptional({
    description: 'Recurrence frequency',
    enum: ['monthly', 'quarterly', 'yearly', 'fixed_date'],
  })
  @IsOptional()
  @IsEnum(['monthly', 'quarterly', 'yearly', 'fixed_date'])
  recurrence?: ComplianceRecurrence;

  @ApiPropertyOptional({ description: 'Structured due-date rule JSON', type: ComplianceDueDateRuleDto })
  @IsOptional()
  @IsObject()
  dueDateRule?: ComplianceDueDateRule;

  @ApiPropertyOptional({ description: 'Applicable subscription plans' })
  @IsOptional()
  @IsArray()
  applicablePlans?: string[];

  @ApiPropertyOptional({ description: 'Applicable company type' })
  @IsOptional()
  @IsString()
  companyType?: string | null;

  @ApiPropertyOptional({ description: 'Statutory citation or legal source reference' })
  @IsOptional()
  @IsString()
  sourceReference?: string | null;

  @ApiPropertyOptional({ description: 'Advance notice period in days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  noticeDaysBefore?: number;

  @ApiPropertyOptional({ description: 'Statutory penalty summary' })
  @IsOptional()
  @IsString()
  penaltiesSummary?: string | null;

  @ApiPropertyOptional({ description: 'Government portal link' })
  @IsOptional()
  @IsString()
  filingPortalUrl?: string | null;

  @ApiPropertyOptional({ description: 'Action required' })
  @IsOptional()
  @IsString()
  actionRequired?: string | null;

  @ApiPropertyOptional({ description: 'Event active status', enum: ['active', 'inactive', 'archived'] })
  @IsOptional()
  @IsEnum(['active', 'inactive', 'archived'])
  status?: ComplianceEventStatus;
}

export class RunComplianceNoticeJobDto implements ComplianceNoticeJobRunInput {
  @ApiPropertyOptional({ description: 'Authoritative evaluation date (YYYY-MM-DD). Defaults to current date.', example: '2026-11-22' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'asOfDate must be in YYYY-MM-DD format' })
  asOfDate?: string;

  @ApiPropertyOptional({ description: 'Optional country UUID filter' })
  @IsOptional()
  @IsUUID()
  countryId?: string;
}

export class UpdateNoticeStatusDto {
  @ApiProperty({
    description: 'Notice review status',
    enum: ['acknowledged', 'completed', 'dismissed'],
    example: 'completed',
  })
  @IsNotEmpty()
  @IsIn(['acknowledged', 'completed', 'dismissed'])
  status!: 'acknowledged' | 'completed' | 'dismissed';
}

export class PreviewComplianceNoticeTenantsDto {
  @ApiPropertyOptional({ description: 'Optional state/province UUID filter' })
  @IsOptional()
  @IsUUID()
  stateProvinceId?: string | null;

  @ApiPropertyOptional({ description: 'Compliance category' })
  @IsOptional()
  @IsString()
  category?: ComplianceEventCategory;

  @ApiPropertyOptional({ description: 'Recurrence type', enum: ['monthly', 'quarterly', 'yearly', 'fixed_date'] })
  @IsOptional()
  @IsEnum(['monthly', 'quarterly', 'yearly', 'fixed_date'])
  recurrence?: ComplianceRecurrence;

  @ApiPropertyOptional({ description: 'Structured due date rule', type: () => ComplianceDueDateRuleDto })
  @IsOptional()
  @IsObject()
  dueDateRule?: ComplianceDueDateRuleDto;

  @ApiPropertyOptional({ description: 'Applicable subscription plans' })
  @IsOptional()
  @IsArray()
  applicablePlans?: string[];

  @ApiPropertyOptional({ description: 'Company legal type filter' })
  @IsOptional()
  @IsString()
  companyType?: string | null;

  @ApiPropertyOptional({ description: 'Advance notice days before due' })
  @IsOptional()
  @IsInt()
  @Min(1)
  noticeDaysBefore?: number;

  @ApiPropertyOptional({ description: 'As of evaluation date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  asOfDate?: string;
}

export class RetireComplianceEventDto {
  @ApiProperty({ description: 'Whether to retire (true) or reactivate (false) the event', example: true })
  @IsNotEmpty()
  @IsBoolean()
  retire!: boolean;
}


