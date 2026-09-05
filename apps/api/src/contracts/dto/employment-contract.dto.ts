import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  EmploymentContractStatus,
  EmploymentContractType,
  PayFrequency,
} from '@prisma/client';

export class OvertimeRuleDto {
  @IsEnum(['none', 'multiplier_after_weekly_hours', 'multiplier_after_daily_hours'])
  type!: 'none' | 'multiplier_after_weekly_hours' | 'multiplier_after_daily_hours';

  @IsOptional()
  @IsNumber()
  thresholdHours?: number;

  @IsOptional()
  @IsNumber()
  multiplier?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateEmploymentContractDto {
  @IsUUID()
  employeeId!: string;

  @IsEnum(EmploymentContractType)
  contractType!: EmploymentContractType;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  probationEndDate?: string;

  @IsOptional()
  @IsNumber()
  workingHoursPerWeek?: number;

  @IsOptional()
  @IsNumber()
  payRate?: number;

  @IsOptional()
  @IsEnum(PayFrequency)
  payFrequency?: PayFrequency;

  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;

  @IsOptional()
  @IsNumber()
  leaveEntitlementDays?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => OvertimeRuleDto)
  overtimeRule?: OvertimeRuleDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  noticePeriodDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  employerNoticeDays?: number;

  @IsOptional()
  @IsString()
  terminationConditions?: string;

  @IsOptional()
  @IsDateString()
  signedAt?: string;

  @IsOptional()
  activate?: boolean;
}

export class UpdateEmploymentContractDto {
  @IsOptional()
  @IsEnum(EmploymentContractType)
  contractType?: EmploymentContractType;

  @IsOptional()
  @IsEnum(EmploymentContractStatus)
  status?: EmploymentContractStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsDateString()
  probationEndDate?: string | null;

  @IsOptional()
  @IsNumber()
  workingHoursPerWeek?: number | null;

  @IsOptional()
  @IsNumber()
  payRate?: number | null;

  @IsOptional()
  @IsEnum(PayFrequency)
  payFrequency?: PayFrequency | null;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  leaveEntitlementDays?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => OvertimeRuleDto)
  overtimeRule?: OvertimeRuleDto | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  noticePeriodDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  employerNoticeDays?: number | null;

  @IsOptional()
  @IsString()
  terminationConditions?: string | null;

  @IsOptional()
  @IsDateString()
  signedAt?: string | null;
}

export class RenewEmploymentContractDto {
  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  probationEndDate?: string;

  /** When true (default), starts the renewal approval workflow immediately. */
  @IsOptional()
  submit?: boolean;
}

export class ContractRenewalActionDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

export class UploadContractDocumentDto {
  @IsString()
  @MinLength(1)
  label!: string;
}

export class ListEmploymentContractsQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsEnum(EmploymentContractStatus)
  status?: EmploymentContractStatus;

  @IsOptional()
  @IsString()
  displayStatus?: string;
}
