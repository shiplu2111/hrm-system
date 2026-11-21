import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import type {
  CountryRuleKind,
  CountryStatus,
  RuleVersionStatus,
} from '@hrm/shared-types';

export class CreateCountryDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Length(2, 3)
  isoCode!: string;

  @IsString()
  @Length(3, 3)
  currency!: string;

  @IsString()
  @IsNotEmpty()
  timezone!: string;

  @IsString()
  @IsNotEmpty()
  dateFormat!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  numberFormat?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}-\d{2}$/, {
    message: 'defaultFinancialYearStart must be MM-DD format, e.g. 01-01 or 07-01',
  })
  defaultFinancialYearStart?: string;

  @IsOptional()
  @IsString()
  @IsIn(['weekly', 'bi-weekly', 'semi-monthly', 'monthly', 'four-weekly'])
  defaultPayFrequency?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'retired'])
  status?: CountryStatus;
}

export class UpdateCountryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  dateFormat?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  numberFormat?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}-\d{2}$/, {
    message: 'defaultFinancialYearStart must be MM-DD format, e.g. 01-01 or 07-01',
  })
  defaultFinancialYearStart?: string;

  @IsOptional()
  @IsString()
  @IsIn(['weekly', 'bi-weekly', 'semi-monthly', 'monthly', 'four-weekly'])
  defaultPayFrequency?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'retired'])
  status?: CountryStatus;
}

export class CreateStateProvinceDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @Length(1, 16)
  code!: string;
}

export class UpdateStateProvinceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @Length(1, 16)
  code?: string;
}

export class UpsertTaxBracketDto {
  @IsInt()
  @Min(1900)
  @Max(2200)
  taxYear!: number;

  bracketJson!: Record<string, unknown>;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: RuleVersionStatus;
}

export class UpsertCountryRuleDto {
  @IsString()
  @IsIn([
    'tax',
    'leave',
    'ot',
    'social_security',
    'public_holiday',
    'health_safety',
    'employment_rules',
  ])
  ruleType!: CountryRuleKind;

  payload!: Record<string, unknown>;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: RuleVersionStatus;
}

export class UpdateTaxBracketDto extends UpsertTaxBracketDto {}

export class UpdateCountryRuleDto {
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: RuleVersionStatus;
}
