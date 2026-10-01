import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { PayrollPeriodStatus } from '@prisma/client';

export class CreatePayrollPeriodDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsDateString()
  paymentDate!: string;
}

/** Status is not editable — it follows the period's payroll runs. */
export class UpdatePayrollPeriodDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;
}

export class ListPayrollPeriodsQueryDto {
  @IsOptional()
  @IsEnum(PayrollPeriodStatus)
  status?: PayrollPeriodStatus;
}
