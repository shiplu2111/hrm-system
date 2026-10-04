import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TimesheetEntryStatus, TimesheetSyncEventType } from '@prisma/client';

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
  @MaxLength(200)
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
  @MaxLength(1000)
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
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsEnum(TimesheetEntryStatus)
  status?: TimesheetEntryStatus;
}

export class ListTimesheetApprovalsQueryDto {
  /** `mine` (default): entries whose current step the user can act on; `all`: every pending entry in scope. */
  @IsOptional()
  @IsIn(['mine', 'all'])
  scope?: 'mine' | 'all';

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class TimesheetEntryActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class RejectTimesheetEntryDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'A reason is required to reject a timesheet entry' })
  @MaxLength(1000)
  comment!: string;
}

export class BulkTimesheetActionDto {
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  entryIds!: string[];

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
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
