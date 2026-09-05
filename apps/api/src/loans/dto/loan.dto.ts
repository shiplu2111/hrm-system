import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { EmployeeLoanKind } from '@prisma/client';

export class CreateEmployeeLoanDto {
  @IsUUID()
  employeeId!: string;

  @IsEnum(EmployeeLoanKind)
  loanKind!: EmployeeLoanKind;

  @IsOptional()
  @IsString()
  @MinLength(1)
  purposeLabel?: string;

  @IsNumber()
  @Min(0.01)
  principalAmount!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  interestRatePercent?: number;

  @IsInt()
  @Min(1)
  tenorMonths!: number;

  @IsOptional()
  @IsDateString()
  firstDueDate?: string;

  @IsOptional()
  @IsBoolean()
  deductFromPayroll?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  /** When true, approves immediately and generates the installment schedule. */
  @IsOptional()
  @IsBoolean()
  approve?: boolean;
}

export class ListEmployeeLoansQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class RejectEmployeeLoanDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
