import { DATE_FORMAT_OPTIONS, NUMBER_FORMAT_OPTIONS } from '@hrm/shared-types';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

const LANGUAGE_CODES = ['en', 'bn'];
const NUMBER_FORMAT_IDS = NUMBER_FORMAT_OPTIONS.map((option) => option.id);
const isSet = (_: unknown, value: unknown) => value !== null && value !== undefined;

/** Each field is optional; `null` clears the override so the value is inherited again. */
export class UpdateLocalizationDto {
  @ValidateIf(isSet)
  @IsIn(LANGUAGE_CODES)
  language?: 'en' | 'bn' | null;

  @ValidateIf(isSet)
  @IsString()
  @MaxLength(64)
  timezone?: string | null;

  @ValidateIf(isSet)
  @IsIn([...DATE_FORMAT_OPTIONS])
  dateFormat?: string | null;

  @ValidateIf(isSet)
  @IsIn(NUMBER_FORMAT_IDS)
  numberFormat?: string | null;
}

export class UpdateMyLocalizationDto {
  @ValidateIf(isSet)
  @IsIn(LANGUAGE_CODES)
  language!: 'en' | 'bn' | null;
}

export class MyLocalizationQueryDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
