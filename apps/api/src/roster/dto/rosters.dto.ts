import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class BulkAssignRosterDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  employeeIds!: string[];

  @IsUUID()
  shiftId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(62)
  @ArrayUnique()
  @IsDateString({}, { each: true })
  dates!: string[];

  @IsOptional()
  @IsUUID()
  locationId?: string | null;

  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}

export class BulkClearRosterDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  employeeIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(62)
  @ArrayUnique()
  @IsDateString({}, { each: true })
  dates!: string[];
}

export class CreateRosterDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  shiftId!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class UpdateRosterDto {
  @IsOptional()
  @IsUUID()
  shiftId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string | null;
}

export class ListRostersQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  pageSize?: number;
}
