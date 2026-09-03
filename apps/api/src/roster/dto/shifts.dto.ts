import { ShiftType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class ShiftRuleDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  graceMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  halfDayAfterMinutes?: number;

  @IsOptional()
  appliesOnWeekend?: boolean;
}

export class CreateShiftDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsEnum(ShiftType)
  shiftType?: ShiftType;

  @IsString()
  @Matches(/^\d{1,2}:\d{2}$/)
  startTime!: string;

  @IsString()
  @Matches(/^\d{1,2}:\d{2}$/)
  endTime!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(480)
  breakMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  graceMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumMinutes?: number;

  @IsOptional()
  @IsObject()
  lateRule?: ShiftRuleDto;

  @IsOptional()
  @IsObject()
  earlyLeaveRule?: ShiftRuleDto;

  @IsOptional()
  @IsObject()
  weekendRule?: ShiftRuleDto;

  @IsOptional()
  @IsUUID()
  otRuleId?: string;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(ShiftType)
  shiftType?: ShiftType;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}:\d{2}$/)
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,2}:\d{2}$/)
  endTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(480)
  breakMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(120)
  graceMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumMinutes?: number | null;

  @IsOptional()
  @IsObject()
  lateRule?: ShiftRuleDto | null;

  @IsOptional()
  @IsObject()
  earlyLeaveRule?: ShiftRuleDto | null;

  @IsOptional()
  @IsObject()
  weekendRule?: ShiftRuleDto | null;

  @IsOptional()
  @IsUUID()
  otRuleId?: string | null;
}
