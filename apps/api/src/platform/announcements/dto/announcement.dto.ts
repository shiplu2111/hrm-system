import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  PlatformAnnouncementAudienceType,
  PlatformAnnouncementSeverity,
  PlatformAnnouncementStatus,
} from '@prisma/client';
import type {
  CreatePlatformAnnouncementInput,
  AudiencePreviewQuery,
  UpdatePlatformAnnouncementInput,
} from '@hrm/shared-types';

export class CreatePlatformAnnouncementDto implements CreatePlatformAnnouncementInput {
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  title!: string;

  @IsString()
  @IsNotEmpty({ message: 'Body is required' })
  @MinLength(5, { message: 'Body must be at least 5 characters' })
  body!: string;

  @IsEnum(PlatformAnnouncementSeverity, {
    message: 'Severity must be one of: info, warning, critical',
  })
  severity!: PlatformAnnouncementSeverity;

  @IsEnum(PlatformAnnouncementAudienceType, {
    message: 'Audience type must be one of: all, by_plan, by_country, specific_tenants',
  })
  audienceType!: PlatformAnnouncementAudienceType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetPlans?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetCountries?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetTenantIds?: string[];

  @IsBoolean()
  @IsOptional()
  rolesOnly?: boolean;

  @IsISO8601({}, { message: 'Start time must be a valid ISO 8601 date string' })
  startTime!: string;

  @ValidateIf((o) => !!o.endTime)
  @IsISO8601({}, { message: 'End time must be a valid ISO 8601 date string' })
  @IsOptional()
  endTime?: string | null;

  @IsBoolean()
  @IsOptional()
  dismissible?: boolean;

  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean;

  @IsEnum(PlatformAnnouncementStatus)
  @IsOptional()
  status?: PlatformAnnouncementStatus;
}

export class UpdatePlatformAnnouncementDto implements UpdatePlatformAnnouncementInput {
  @IsString()
  @IsOptional()
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  title?: string;

  @IsString()
  @IsOptional()
  @MinLength(5, { message: 'Body must be at least 5 characters' })
  body?: string;

  @IsEnum(PlatformAnnouncementSeverity, {
    message: 'Severity must be one of: info, warning, critical',
  })
  @IsOptional()
  severity?: PlatformAnnouncementSeverity;

  @IsEnum(PlatformAnnouncementAudienceType, {
    message: 'Audience type must be one of: all, by_plan, by_country, specific_tenants',
  })
  @IsOptional()
  audienceType?: PlatformAnnouncementAudienceType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetPlans?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetCountries?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetTenantIds?: string[];

  @IsBoolean()
  @IsOptional()
  rolesOnly?: boolean;

  @IsISO8601({}, { message: 'Start time must be a valid ISO 8601 date string' })
  @IsOptional()
  startTime?: string;

  @ValidateIf((o) => !!o.endTime)
  @IsISO8601({}, { message: 'End time must be a valid ISO 8601 date string' })
  @IsOptional()
  endTime?: string | null;

  @IsBoolean()
  @IsOptional()
  dismissible?: boolean;

  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean;

  @IsEnum(PlatformAnnouncementStatus)
  @IsOptional()
  status?: PlatformAnnouncementStatus;
}

export class AudiencePreviewDto implements AudiencePreviewQuery {
  @IsEnum(PlatformAnnouncementAudienceType, {
    message: 'Audience type must be one of: all, by_plan, by_country, specific_tenants',
  })
  audienceType!: PlatformAnnouncementAudienceType;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetPlans?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetCountries?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetTenantIds?: string[];

  @IsBoolean()
  @IsOptional()
  rolesOnly?: boolean;
}
