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

  @IsOptional()
  @IsEnum(PayrollPeriodStatus)
  status?: PayrollPeriodStatus;
}

export class ListPayrollPeriodsQueryDto {
  @IsOptional()
  @IsEnum(PayrollPeriodStatus)
  status?: PayrollPeriodStatus;
}
