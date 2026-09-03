import {
  IsArray,
  IsBoolean,
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
import { Type } from 'class-transformer';
import { LeaveAccrualType, YearlyAccrualAnchor } from '@prisma/client';

export class CreateLeaveTypeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}

export class UpdateLeaveTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;
}

export class ApprovalStepTemplateDto {
  @IsString()
  @MinLength(1)
  roleName!: string;
}

export class CreateLeavePolicyDto {
  @IsUUID()
  leaveTypeId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  entitlementDays!: number;

  @IsEnum(LeaveAccrualType)
  accrualType!: LeaveAccrualType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  carryForwardMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expiryMonths?: number;

  @IsOptional()
  @IsBoolean()
  encashmentAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  probationRestricted?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  negativeBalanceCap?: number;

  @IsOptional()
  @IsBoolean()
  halfDayAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  deductPublicHolidays?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepTemplateDto)
  approvalSteps?: ApprovalStepTemplateDto[];

  @IsOptional()
  @IsEnum(YearlyAccrualAnchor)
  yearlyAccrualAnchor?: YearlyAccrualAnchor;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdateLeavePolicyDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  entitlementDays?: number;

  @IsOptional()
  @IsEnum(LeaveAccrualType)
  accrualType?: LeaveAccrualType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  carryForwardMax?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expiryMonths?: number | null;

  @IsOptional()
  @IsBoolean()
  encashmentAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  probationRestricted?: boolean;

  @IsOptional()
  @IsBoolean()
  allowNegativeBalance?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  negativeBalanceCap?: number | null;

  @IsOptional()
  @IsBoolean()
  halfDayAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  deductPublicHolidays?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepTemplateDto)
  approvalSteps?: ApprovalStepTemplateDto[];

  @IsOptional()
  @IsEnum(YearlyAccrualAnchor)
  yearlyAccrualAnchor?: YearlyAccrualAnchor;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;
}

export class CreateLeaveRequestDto {
  @IsUUID()
  leaveTypeId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsBoolean()
  halfDay?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsBoolean()
  submit?: boolean;

  @IsOptional()
  @IsUUID()
  localId?: string;
}

export class LeaveApprovalActionDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

export class ListLeaveRequestsQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}

export class RunYearEndDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  leaveYear!: number;
}

export class AccrueLeaveQueryDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;
}
