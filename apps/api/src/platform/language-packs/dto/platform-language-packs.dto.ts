import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';
import type {
  CreateLanguagePackInput,
  ImportTranslationsInput,
  PlatformLanguageDirection,
  SetLanguageAvailabilityInput,
  UpdateLanguagePackInput,
} from '@hrm/shared-types';

export class CreateLanguagePackDto implements CreateLanguagePackInput {
  @ApiProperty({ description: 'Language code (e.g. en, bn, es, fr-CA)', example: 'es' })
  @IsString()
  @Length(2, 10)
  @Matches(/^[a-z]{2,3}(-[A-Za-z0-9]+)?$/, {
    message: 'Language code must be standard BCP 47 format (e.g. en, bn, es, pt-BR)',
  })
  code: string;

  @ApiProperty({ description: 'English name of the language', example: 'Spanish' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ description: 'Native display name of the language', example: 'Español' })
  @IsString()
  @MinLength(2)
  nativeName: string;

  @ApiPropertyOptional({ description: 'Text direction', enum: ['ltr', 'rtl'], default: 'ltr' })
  @IsOptional()
  @IsIn(['ltr', 'rtl'])
  direction?: PlatformLanguageDirection;

  @ApiPropertyOptional({ description: 'Whether this pack is available for tenant selection', default: false })
  @IsOptional()
  @IsBoolean()
  isAvailableToTenants?: boolean;

  @ApiPropertyOptional({ description: 'Internal notes or release descriptions' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Initial nested or flat translations dictionary' })
  @IsOptional()
  @IsObject()
  translations?: Record<string, any>;
}

export class UpdateLanguagePackDto implements UpdateLanguagePackInput {
  @ApiPropertyOptional({ description: 'English name of the language', example: 'Spanish' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({ description: 'Native display name of the language', example: 'Español' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  nativeName?: string;

  @ApiPropertyOptional({ description: 'Text direction', enum: ['ltr', 'rtl'] })
  @IsOptional()
  @IsIn(['ltr', 'rtl'])
  direction?: PlatformLanguageDirection;

  @ApiPropertyOptional({ description: 'Whether this pack is available for tenant selection' })
  @IsOptional()
  @IsBoolean()
  isAvailableToTenants?: boolean;

  @ApiPropertyOptional({ description: 'Internal notes or release descriptions' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Semantic version tag', example: '1.1.0' })
  @IsOptional()
  @IsString()
  version?: string;
}

export class SetLanguageAvailabilityDto implements SetLanguageAvailabilityInput {
  @ApiProperty({ description: 'Whether the language pack is active and selectable by tenants', example: true })
  @IsBoolean()
  isAvailableToTenants: boolean;

  @ApiPropertyOptional({ description: 'Administrative reason for enabling/disabling availability' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ImportTranslationsDto implements ImportTranslationsInput {
  @ApiProperty({ description: 'JSON translation object (nested or flat key-value map)' })
  @IsNotEmpty()
  @IsObject()
  translations: Record<string, any>;

  @ApiPropertyOptional({ description: 'Import mode: merge with existing or replace', enum: ['merge', 'replace'], default: 'merge' })
  @IsOptional()
  @IsIn(['merge', 'replace'])
  mode?: 'merge' | 'replace';

  @ApiPropertyOptional({ description: 'Automatically mark available to tenants if completeness is 100%', default: false })
  @IsOptional()
  @IsBoolean()
  markAvailableIfComplete?: boolean;

  @ApiPropertyOptional({ description: 'Import notes or changelog entry' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class QueryLanguagePacksDto {
  @ApiPropertyOptional({ description: 'Filter only languages available to tenants' })
  @IsOptional()
  @IsBoolean()
  availableOnly?: boolean;

  @ApiPropertyOptional({ description: 'Search term by language code or name' })
  @IsOptional()
  @IsString()
  search?: string;
}
