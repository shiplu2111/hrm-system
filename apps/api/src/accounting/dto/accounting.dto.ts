import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';

const GL_ACCOUNT_TYPES = [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
] as const;

const POSTING_SIDES = ['debit', 'credit'] as const;

const SYSTEM_KEYS = [
  'net_pay_salary_payable',
  'employer_superannuation_expense',
  'employer_superannuation_liability',
] as const;

export class CreateGlAccountDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn([...GL_ACCOUNT_TYPES])
  accountType!: (typeof GL_ACCOUNT_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateGlAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn([...GL_ACCOUNT_TYPES])
  accountType?: (typeof GL_ACCOUNT_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertGlPayrollMappingDto {
  @IsOptional()
  @IsUUID()
  payComponentId?: string;

  @IsOptional()
  @IsIn([...SYSTEM_KEYS])
  systemKey?: (typeof SYSTEM_KEYS)[number];

  @IsIn([...POSTING_SIDES])
  postingSide!: (typeof POSTING_SIDES)[number];

  @IsUUID()
  glAccountId!: string;
}

export class BulkUpsertGlPayrollMappingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertGlPayrollMappingDto)
  mappings!: UpsertGlPayrollMappingDto[];
}
