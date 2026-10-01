import { ShiftType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ShiftRuleDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(240)
  graceMinutes?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1440)
  halfDayAfterMinutes?: number;

  @IsOptional()
  @IsBoolean()
  appliesOnWeekend?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekendDays?: number[];
}

export class CreateShiftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
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
  @Max(1440)
  minimumMinutes?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftRuleDto)
  lateRule?: ShiftRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftRuleDto)
  earlyLeaveRule?: ShiftRuleDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftRuleDto)
  weekendRule?: ShiftRuleDto;

  @IsOptional()
  @IsUUID()
  otRuleId?: string;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
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
  @Max(1440)
  minimumMinutes?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftRuleDto)
  lateRule?: ShiftRuleDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftRuleDto)
  earlyLeaveRule?: ShiftRuleDto | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ShiftRuleDto)
  weekendRule?: ShiftRuleDto | null;

  @IsOptional()
  @IsUUID()
  otRuleId?: string | null;
}
