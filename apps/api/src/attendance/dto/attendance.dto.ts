import { AttendanceRecordStatus, AttendanceSource } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class AttendanceCaptureDto {
  @IsOptional()
  @IsEnum(AttendanceSource)
  source?: AttendanceSource;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  gpsLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  gpsLng?: number;

  /** Optional override for test harnesses only */
  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class AttendanceDateQueryDto {
  @IsOptional()
  @IsString()
  date?: string;
}

export class BreakCorrectionItemDto {
  @IsString()
  startAt: string;

  @IsOptional()
  @IsString()
  endAt?: string | null;
}

export class CorrectAttendanceDto {
  @IsString()
  date: string;

  @IsOptional()
  @IsString()
  clockInAt?: string | null;

  @IsOptional()
  @IsString()
  clockOutAt?: string | null;

  @IsOptional()
  @IsEnum(AttendanceRecordStatus)
  status?: AttendanceRecordStatus;

  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BreakCorrectionItemDto)
  breaks?: BreakCorrectionItemDto[];
}
