import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TimesheetSyncEventType } from '@prisma/client';

export class CreateTimesheetProjectDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateTimesheetEntryDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  projectId!: string;

  @IsDateString()
  entryDate!: string;

  @IsString()
  @MinLength(1)
  taskName!: string;

  @IsISO8601()
  startTime!: string;

  @IsISO8601()
  endTime!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  breakMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

export class ListTimesheetEntriesQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class TimesheetEntryActionDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

export class TimesheetSyncEventDto {
  @IsUUID()
  local_id!: string;

  @IsUUID()
  employee_id!: string;

  @IsEnum(TimesheetSyncEventType)
  type!: TimesheetSyncEventType;

  @IsISO8601()
  timestamp_device!: string;

  @IsOptional()
  @IsDateString()
  entry_date?: string;

  @IsOptional()
  @IsUUID()
  project_id?: string;

  @IsOptional()
  @IsString()
  task_name?: string;

  @IsOptional()
  @IsISO8601()
  start_time?: string;

  @IsOptional()
  @IsISO8601()
  end_time?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  break_minutes?: number;

  @IsOptional()
  @IsBoolean()
  is_billable?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offline_duration_seconds?: number;

  @IsOptional()
  @IsUUID()
  entry_local_id?: string;
}

export class TimesheetSyncBatchDto {
  @IsString()
  deviceId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TimesheetSyncEventDto)
  events!: TimesheetSyncEventDto[];
}
