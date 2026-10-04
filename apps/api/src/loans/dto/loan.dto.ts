import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EmployeeLoanKind, EmployeeLoanStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateEmployeeLoanDto {
  @IsUUID()
  employeeId!: string;

  @IsEnum(EmployeeLoanKind)
  loanKind!: EmployeeLoanKind;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  purposeLabel?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  principalAmount!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  interestRatePercent?: number;

  @IsInt()
  @Min(1)
  @Max(120)
  tenorMonths!: number;

  @IsOptional()
  @IsDateString()
  firstDueDate?: string;

  @IsOptional()
  @IsBoolean()
  deductFromPayroll?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
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
  @IsEnum(EmployeeLoanStatus)
  status?: EmployeeLoanStatus;

  @IsOptional()
  @IsEnum(EmployeeLoanKind)
  loanKind?: EmployeeLoanKind;
}

export class ApproveEmployeeLoanDto {
  /** First installment due date (`YYYY-MM-DD`); defaults to one month from today. */
  @IsOptional()
  @IsDateString()
  firstDueDate?: string;
}

export class RejectEmployeeLoanDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'A reason is required to reject a loan or advance request' })
  @MaxLength(1000)
  reason!: string;
}
