import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateExpenseCategoryDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmountPerClaim?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmountPerMonth?: number;

  @IsOptional()
  @IsBoolean()
  receiptRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateExpenseCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmountPerClaim?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxAmountPerMonth?: number | null;

  @IsOptional()
  @IsBoolean()
  receiptRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListExpenseCategoriesQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean;
}

export class CreateExpenseClaimDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  categoryId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;

  @IsDateString()
  expenseDate!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** When true, submits for approval immediately (requires receipt if category mandates it). */
  @IsOptional()
  @IsBoolean()
  submit?: boolean;
}

export class ListExpenseClaimsQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class ExpenseClaimActionDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

export class RejectExpenseClaimDto extends ExpenseClaimActionDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
