import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import type { OvertimeRateType } from '@hrm/shared-types';

const RATE_TYPES: readonly OvertimeRateType[] = ['weekday', 'weekend', 'holiday', 'night'];
const REQUEST_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const;

export class CreateShiftSwapRequestDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  targetEmployeeId!: string;

  @ApiProperty({ example: '2026-11-20' })
  @IsDateString()
  swapDate!: string;

  @ApiPropertyOptional({ example: '2026-11-20' })
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsDateString()
  targetDate?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsUUID('4')
  requesterRosterId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class CreateOvertimeRequestDto {
  @ApiProperty({ example: '2026-11-18' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional({ example: '17:30' })
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be HH:MM' })
  startTime?: string;

  @ApiPropertyOptional({ example: '19:30' })
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be HH:MM' })
  endTime?: string;

  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.5)
  @Max(24)
  hours!: number;

  @ApiProperty({ enum: RATE_TYPES })
  @IsIn([...RATE_TYPES])
  rateType!: OvertimeRateType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}

export class DecideEssRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class ListEssRequestsQueryDto {
  @ApiPropertyOptional({ enum: REQUEST_STATUSES })
  @IsOptional()
  @IsIn([...REQUEST_STATUSES])
  status?: (typeof REQUEST_STATUSES)[number];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;
}

