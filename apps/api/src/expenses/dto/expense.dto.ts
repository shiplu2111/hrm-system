import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
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
import { ExpenseClaimStatus } from '@prisma/client';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const MONEY = { maxDecimalPlaces: 2 } as const;
const MAX_LIMIT = 10_000_000;

export class CreateExpenseCategoryDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(MAX_LIMIT)
  maxAmountPerClaim?: number | null;

  @IsOptional()
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(MAX_LIMIT)
  maxAmountPerMonth?: number | null;

  @IsOptional()
  @IsBoolean()
  receiptRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateExpenseCategoryDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  /** `null` removes the limit. */
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(MAX_LIMIT)
  maxAmountPerClaim?: number | null;

  /** `null` removes the limit. */
  @IsOptional()
  @IsNumber(MONEY)
  @Min(0.01)
  @Max(MAX_LIMIT)
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
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  activeOnly?: boolean;
}

export class CreateExpenseClaimDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  categoryId!: string;

  @IsNumber(MONEY)
  @Min(0.01)
  @Max(MAX_LIMIT)
  amount!: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  currency?: string;

  @IsDateString()
  expenseDate!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
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
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(ExpenseClaimStatus)
  status?: ExpenseClaimStatus;
}

export class ExpenseClaimActionDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class RejectExpenseClaimDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'A reason is required to reject an expense claim' })
  @MaxLength(1000)
  reason!: string;
}
