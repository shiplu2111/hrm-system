import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PayrollRunStatus } from '@prisma/client';

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
