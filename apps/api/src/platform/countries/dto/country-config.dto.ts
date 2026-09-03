import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import type { CountryRuleKind } from '@hrm/shared-types';

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
}

export class UpsertTaxBracketDto {
  @IsInt()
  @Min(1900)
  @Max(2200)
  taxYear!: number;

  @IsObject()
  bracketJson!: Record<string, unknown>;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpsertCountryRuleDto {
  @IsString()
  @IsIn(['leave', 'ot', 'social_security', 'public_holiday'])
  ruleType!: CountryRuleKind;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class UpdateTaxBracketDto extends UpsertTaxBracketDto {}

export class UpdateCountryRuleDto {
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;
}
