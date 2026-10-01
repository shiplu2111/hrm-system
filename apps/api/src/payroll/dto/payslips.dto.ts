import { IsOptional, IsUUID } from 'class-validator';

export class ListPayslipsQueryDto {
  @IsOptional()
  @IsUUID()
  payrollPeriodId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;
}
