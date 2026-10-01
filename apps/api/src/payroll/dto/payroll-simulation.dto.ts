import { Type } from 'class-transformer';
import { SalaryPayBasis } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength,
  ValidateBy,
  ValidateNested,
} from 'class-validator';

export class PayrollSalaryStructureOverrideDto {
  @IsOptional()
  @IsUUID()
  salaryStructureId?: string;

  @IsOptional()
  @IsUUID()
  componentId?: string;

  @IsOptional()
  @IsBoolean()
  remove?: boolean;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  percentage?: number;

  @IsOptional()
  @IsEnum(SalaryPayBasis)
  payBasis?: SalaryPayBasis;

  @IsOptional()
  @IsString()
  hourly_rate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ot_multiplier?: number;
}

const UNITS = /^\d{1,3}(\.\d{1,2})?$/;
const UNITS_MESSAGE = 'Use a number with up to 2 decimal places';

/** Days are capped at 31 and hours at 744 (a 31-day month), which is all one pay month can hold. */
export class PayrollAttendanceOverrideDto {
  @IsOptional()
  @Matches(UNITS, { message: UNITS_MESSAGE })
  @MaxNumeric(31)
  daysWorked?: string;

  @IsOptional()
  @Matches(UNITS, { message: UNITS_MESSAGE })
  @MaxNumeric(744)
  workedHours?: string;

  @IsOptional()
  @Matches(UNITS, { message: UNITS_MESSAGE })
  @MaxNumeric(31)
  unpaidDays?: string;
}

export class PayrollSimulateDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollSalaryStructureOverrideDto)
  structureOverrides?: PayrollSalaryStructureOverrideDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PayrollAttendanceOverrideDto)
  attendance?: PayrollAttendanceOverrideDto;
}

function MaxNumeric(max: number) {
  return ValidateBy({
    name: 'maxNumeric',
    validator: {
      validate: (value: unknown) => typeof value !== 'string' || Number(value) <= max,
      defaultMessage: () => `Must be ${max} or less`,
    },
  });
}
