import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PayrollAdjustmentStatus } from '@prisma/client';
import { PayrollSalaryStructureOverrideDto } from './payroll-simulation.dto';

export class CreatePayrollAdjustmentDto {
  @IsUUID()
  originalPayrollRunId!: string;

  @IsOptional()
  @IsUUID()
  applyToPayrollPeriodId?: string;

  @IsOptional()
  @IsDateString()
  retroactiveFrom?: string;

  @IsOptional()
  @IsDateString()
  retroactiveTo?: string;

  @IsString()
  @MinLength(1)
  reason!: string;

  /** Optional overrides to model the retroactive salary change before committing structures */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollSalaryStructureOverrideDto)
  structureOverrides?: PayrollSalaryStructureOverrideDto[];
}

export class ListPayrollAdjustmentsQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsEnum(PayrollAdjustmentStatus)
  status?: PayrollAdjustmentStatus;
}
