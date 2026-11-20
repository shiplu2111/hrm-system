import {
  AttendanceCorrectionStatus,
  AttendanceRecordStatus,
  AttendanceSource,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
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

export class AttendanceHistoryQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from must be formatted as YYYY-MM-DD',
  })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to must be formatted as YYYY-MM-DD',
  })
  to?: string;
}

export class SubmitAttendanceCorrectionDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be formatted as YYYY-MM-DD',
  })
  date: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'clockIn must be formatted as HH:mm',
  })
  clockIn?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'clockOut must be formatted as HH:mm',
  })
  clockOut?: string;

  @IsOptional()
  @IsBoolean()
  clockOutNextDay?: boolean;

  @IsOptional()
  @IsString()
  clockInAt?: string | null;

  @IsOptional()
  @IsString()
  clockOutAt?: string | null;

  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class ListCompanyCorrectionsQueryDto {
  @IsOptional()
  @IsEnum(AttendanceCorrectionStatus)
  status?: AttendanceCorrectionStatus;
}

export class ReviewAttendanceCorrectionDto {
  @IsOptional()
  @IsString()
  comment?: string;
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
