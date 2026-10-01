import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PayrollRunStatus } from '@prisma/client';

const MONEY = /^-?\d+\.\d{2}$/;
const MAX_BULK = 5000;

export class CreatePayrollRunDto {
  @IsUUID()
  employeeId!: string;
}

export class PayrollRunTransitionDto {
  @IsEnum(PayrollRunStatus)
  targetStatus!: PayrollRunStatus;
}

export class ListPayrollRunsQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsEnum(PayrollRunStatus)
  status?: PayrollRunStatus;
}

export class GeneratePayrollRunsDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK)
  @IsUUID('all', { each: true })
  employeeIds?: string[];
}

export class CalculatePayrollRunsDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK)
  @IsUUID('all', { each: true })
  runIds?: string[];
}

export class PayrollTotalsExpectationDto {
  @IsInt()
  @Min(1)
  runCount!: number;

  @Matches(MONEY, { message: 'grossPay must be a decimal string with 2 places' })
  grossPay!: string;

  @Matches(MONEY, { message: 'netPay must be a decimal string with 2 places' })
  netPay!: string;
}

export class BulkPayrollRunTransitionDto {
  @IsEnum(PayrollRunStatus)
  fromStatus!: PayrollRunStatus;

  @IsEnum(PayrollRunStatus)
  targetStatus!: PayrollRunStatus;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BULK)
  @IsUUID('all', { each: true })
  runIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => PayrollTotalsExpectationDto)
  expected?: PayrollTotalsExpectationDto;
}
