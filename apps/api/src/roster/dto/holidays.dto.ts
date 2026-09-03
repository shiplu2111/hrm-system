import { HolidayScope } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateHolidayDto {
  @IsEnum(HolidayScope)
  scope!: HolidayScope;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  /** Required when scope is branch */
  @IsOptional()
  @IsUUID()
  locationId?: string;

  /** Required when scope is employee */
  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class UpdateHolidayDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  recurring?: boolean;

  @IsOptional()
  @IsUUID()
  locationId?: string | null;

  @IsOptional()
  @IsUUID()
  employeeId?: string | null;
}

export class ResolveHolidayCalendarQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  /** State/province code for state-level public holidays (e.g. NSW) */
  @IsOptional()
  @IsString()
  stateCode?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}

export class ListHolidaysQueryDto {
  @IsOptional()
  @IsEnum(HolidayScope)
  scope?: HolidayScope;

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
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pageSize?: number;
}
