import {
  IsDateString,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class CreateExchangeRateDto {
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/i)
  baseCurrency!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/i)
  quoteCurrency!: string;

  @IsString()
  rate!: string;

  @IsDateString()
  effectiveFrom!: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  effectiveTo?: string | null;
}

export class UpdateExchangeRateDto {
  @IsOptional()
  @IsString()
  rate?: string;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  effectiveTo?: string | null;
}

export class ResolveExchangeRateQueryDto {
  @IsString()
  @Matches(/^[A-Z]{3}$/i)
  base!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/i)
  quote!: string;

  @IsDateString()
  date!: string;
}

export class UpdateCompanyPayrollCurrencyDto {
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MinLength(3)
  @MaxLength(3)
  @Matches(/^[A-Z]{3}$/i)
  payrollBaseCurrency?: string | null;
}
