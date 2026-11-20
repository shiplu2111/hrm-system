import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import type {
  ProfileUpdateFieldKey,
  ProfileUpdateRequestStatus,
} from '@hrm/shared-types';

export const PROFILE_UPDATE_FIELD_KEYS: readonly ProfileUpdateFieldKey[] = [
  'first_name',
  'last_name',
  'work_location',
  'department',
  'designation',
  'manager',
  'dependents',
  'bank_or_tax',
  'other',
] as const;

export const PROFILE_UPDATE_REQUEST_STATUSES: readonly ProfileUpdateRequestStatus[] = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
] as const;

export class SelfContactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  mobile?: string;
}

export class SelfEmergencyContactDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  relationship?: string;
}

export class SelfAddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}

export class UpdateSelfProfileDto {
  @ApiPropertyOptional({ type: SelfContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SelfContactDto)
  contact?: SelfContactDto;

  @ApiPropertyOptional({ type: SelfEmergencyContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SelfEmergencyContactDto)
  emergencyContact?: SelfEmergencyContactDto;

  @ApiPropertyOptional({ type: SelfAddressDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SelfAddressDto)
  address?: SelfAddressDto;
}

export class CreateProfileUpdateRequestDto {
  @ApiProperty({ enum: PROFILE_UPDATE_FIELD_KEYS })
  @IsIn([...PROFILE_UPDATE_FIELD_KEYS])
  fieldKey!: ProfileUpdateFieldKey;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  requestedValue!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsDateString()
  effectiveDate?: string;
}

export class DecideProfileUpdateRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class ListProfileUpdateRequestsQueryDto {
  @ApiPropertyOptional({ enum: PROFILE_UPDATE_REQUEST_STATUSES })
  @IsOptional()
  @IsIn([...PROFILE_UPDATE_REQUEST_STATUSES])
  status?: ProfileUpdateRequestStatus;
}

