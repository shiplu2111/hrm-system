import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { AttendanceSyncEventType } from '@prisma/client';

export class AttendanceSyncGpsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;
}

export class AttendanceSyncEventDto {
  @IsUUID()
  local_id!: string;

  @IsUUID()
  employee_id!: string;

  @IsEnum(AttendanceSyncEventType)
  type!: AttendanceSyncEventType;

  @IsISO8601()
  timestamp_device!: string;

  /** Device geofence verdict at capture time (OFFLINE_SYNC.md §6) */
  @IsOptional()
  @IsBoolean()
  geofence_ok?: boolean;

  /** Known offline queue duration in seconds for timestamp trust adjustment (§5) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offline_duration_seconds?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => AttendanceSyncGpsDto)
  gps?: AttendanceSyncGpsDto;
}

export class AttendanceSyncBatchDto {
  @IsString()
  deviceId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AttendanceSyncEventDto)
  events!: AttendanceSyncEventDto[];
}
