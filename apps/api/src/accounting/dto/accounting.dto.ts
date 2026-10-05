import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
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
  @MaxLength(30)
  code!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
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
  @MaxLength(30)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
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

export class GlPayrollMappingRefDto {
  @IsOptional()
  @IsUUID()
  payComponentId?: string;

  @IsOptional()
  @IsIn([...SYSTEM_KEYS])
  systemKey?: (typeof SYSTEM_KEYS)[number];
}

export class BulkUpsertGlPayrollMappingsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => UpsertGlPayrollMappingDto)
  mappings!: UpsertGlPayrollMappingDto[];

  /** Mappings to clear, so the source shows as unmapped again. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => GlPayrollMappingRefDto)
  remove?: GlPayrollMappingRefDto[];
}

export const GL_COST_CENTRE_SOURCE_PATTERN =
  /^(default|component:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|system:employer_superannuation_expense)$/i;

export class GlCostCentreOverrideDto {
  @IsString()
  @Matches(GL_COST_CENTRE_SOURCE_PATTERN, {
    message:
      'sourceKey must be "default", "component:" followed by a pay component ID, or "system:employer_superannuation_expense"',
  })
  sourceKey!: string;

  @IsUUID()
  glAccountId!: string;
}

export class ReplaceGlCostCentreMappingsDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GlCostCentreOverrideDto)
  overrides!: GlCostCentreOverrideDto[];
}

const GL_EXPORT_OUTCOME_FILTERS = [
  'succeeded',
  'failed',
  'in_progress',
  'needs_attention',
] as const;

export class ListGlExportsQueryDto {
  @IsOptional()
  @IsIn([...GL_EXPORT_OUTCOME_FILTERS])
  outcome?: (typeof GL_EXPORT_OUTCOME_FILTERS)[number];

  @IsOptional()
  @IsIn(['payroll', 'contractor'])
  kind?: 'payroll' | 'contractor';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ListGlAccountsQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  includeInactive?: 'true' | 'false';
}

const CONTRACTOR_SYSTEM_KEYS = ['contractor_expense', 'contractor_payable'] as const;

export class UpsertGlContractorMappingDto {
  @IsIn([...CONTRACTOR_SYSTEM_KEYS])
  systemKey!: (typeof CONTRACTOR_SYSTEM_KEYS)[number];

  @IsIn([...POSTING_SIDES])
  postingSide!: (typeof POSTING_SIDES)[number];

  @IsUUID()
  glAccountId!: string;
}

export class BulkUpsertGlContractorMappingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertGlContractorMappingDto)
  mappings!: UpsertGlContractorMappingDto[];
}
