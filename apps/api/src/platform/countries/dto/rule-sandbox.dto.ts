import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type {
  RuleSandboxEmployeeProfile,
  RuleSandboxLeaveInput,
  RuleSandboxOvertimeInput,
  RuleSandboxSimulationInput,
} from '@hrm/shared-types';

export class RuleSandboxOvertimeDto implements RuleSandboxOvertimeInput {
  @ApiPropertyOptional({ description: 'Standard weekday overtime hours' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weekdayHours?: number;

  @ApiPropertyOptional({ description: 'Weekend overtime hours' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weekendHours?: number;

  @ApiPropertyOptional({ description: 'Public / gazetted holiday overtime hours' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  holidayHours?: number;

  @ApiPropertyOptional({ description: 'Night shift hours' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  nightHours?: number;
}

export class RuleSandboxLeaveDto implements RuleSandboxLeaveInput {
  @ApiPropertyOptional({ description: 'Paid annual/statutory leave days taken' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paidLeaveDays?: number;

  @ApiPropertyOptional({ description: 'Unpaid leave days taken' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unpaidLeaveDays?: number;

  @ApiPropertyOptional({ description: 'Unpaid leave hours taken (overrides days * dailyHours)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  unpaidLeaveHours?: number;

  @ApiPropertyOptional({ description: 'Sick / personal leave days taken' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sickLeaveDays?: number;
}

export class RuleSandboxEmployeeProfileDto implements RuleSandboxEmployeeProfile {
  @ApiProperty({ description: 'Base salary in country currency (monthly by default)' })
  @IsNumber()
  @Min(0)
  baseSalary: number;

  @ApiPropertyOptional({
    description: 'Pay frequency',
    enum: ['monthly', 'biweekly', 'weekly', 'annual'],
    default: 'monthly',
  })
  @IsOptional()
  @IsEnum(['monthly', 'biweekly', 'weekly', 'annual'])
  payFrequency?: 'monthly' | 'biweekly' | 'weekly' | 'annual';

  @ApiPropertyOptional({ description: 'Standard contracted hours worked in period' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  standardHoursWorked?: number;

  @ApiPropertyOptional({ description: 'Overtime breakdown hours' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RuleSandboxOvertimeDto)
  overtime?: RuleSandboxOvertimeDto;

  @ApiPropertyOptional({ description: 'Leave taken breakdown' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RuleSandboxLeaveDto)
  leave?: RuleSandboxLeaveDto;

  @ApiPropertyOptional({ description: 'Tax filing status (e.g. single, married)' })
  @IsOptional()
  @IsString()
  filingStatus?: string | null;

  @ApiPropertyOptional({ description: 'Voluntary employee pension/superannuation contribution rate (%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  voluntaryPensionRate?: number | null;

  @ApiPropertyOptional({ description: 'Whether the employee is non-resident for tax purposes' })
  @IsOptional()
  @IsBoolean()
  isNonResident?: boolean;
}

export class RuleSandboxSimulationDto implements RuleSandboxSimulationInput {
  @ApiProperty({ description: 'Country jurisdiction UUID' })
  @IsUUID()
  @IsNotEmpty()
  countryId: string;

  @ApiPropertyOptional({ description: 'Optional State / Province subdivision UUID for regional scope' })
  @IsOptional()
  @IsUUID()
  stateProvinceId?: string | null;

  @ApiProperty({ description: 'Authoritative calculation / effective date (YYYY-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'calculationDate must be in YYYY-MM-DD format',
  })
  calculationDate: string;

  @ApiPropertyOptional({
    description: 'Optional draft or pending_approval version UUID to test before publishing',
  })
  @IsOptional()
  @IsUUID()
  draftRuleVersionId?: string | null;

  @ApiProperty({ description: 'Sample employee profile for sandbox simulation' })
  @ValidateNested()
  @Type(() => RuleSandboxEmployeeProfileDto)
  @IsNotEmpty()
  employeeProfile: RuleSandboxEmployeeProfileDto;
}
