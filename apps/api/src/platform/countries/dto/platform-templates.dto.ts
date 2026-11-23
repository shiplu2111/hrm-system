import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import type {
  CreatePlatformTemplateInput,
  PlatformTemplateCategory,
  PlatformTemplateStatus,
  PublishPlatformTemplateInput,
  UpdatePlatformTemplateInput,
} from '@hrm/shared-types';

export const PLATFORM_TEMPLATE_CATEGORIES: PlatformTemplateCategory[] = [
  'document_types',
  'leave_policies',
  'notification_templates',
  'default_roles',
  'onboarding_checklists',
];

export class CreatePlatformTemplateDto implements CreatePlatformTemplateInput {
  @ApiPropertyOptional({ description: 'Optional country ID (null for Global Default template)' })
  @IsOptional()
  @IsUUID()
  countryId?: string | null;

  @ApiProperty({
    description: 'Template category kind',
    enum: [
      'document_types',
      'leave_policies',
      'notification_templates',
      'default_roles',
      'onboarding_checklists',
    ],
  })
  @IsNotEmpty()
  @IsIn(PLATFORM_TEMPLATE_CATEGORIES)
  category: PlatformTemplateCategory;

  @ApiProperty({ description: 'Display name for the template' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Descriptive notes or statutory purpose' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'JSON template structure payload' })
  @IsNotEmpty()
  payload: any;

  @ApiPropertyOptional({ description: 'Effective start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveFrom must be in YYYY-MM-DD format',
  })
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Change summary describing modifications' })
  @IsOptional()
  @IsString()
  changeSummary?: string;

  @ApiPropertyOptional({ description: 'Statutory or platform source reference' })
  @IsOptional()
  @IsString()
  sourceReference?: string;

  @ApiPropertyOptional({ description: 'Initial status: draft or published', enum: ['draft', 'published'] })
  @IsOptional()
  @IsIn(['draft', 'published'])
  status?: PlatformTemplateStatus;
}

export class UpdatePlatformTemplateDto implements UpdatePlatformTemplateInput {
  @ApiPropertyOptional({ description: 'Display name for the template' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Descriptive notes' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'JSON template payload' })
  @IsOptional()
  payload?: any;

  @ApiPropertyOptional({ description: 'Effective start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveFrom must be in YYYY-MM-DD format',
  })
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Change summary' })
  @IsOptional()
  @IsString()
  changeSummary?: string;

  @ApiPropertyOptional({ description: 'Statutory or platform source reference' })
  @IsOptional()
  @IsString()
  sourceReference?: string;
}

export class PublishPlatformTemplateDto implements PublishPlatformTemplateInput {
  @ApiPropertyOptional({ description: 'Effective start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveFrom must be in YYYY-MM-DD format',
  })
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Publish summary/audit reason' })
  @IsOptional()
  @IsString()
  changeSummary?: string;
}

export class QueryPlatformTemplatesDto {
  @ApiPropertyOptional({ description: 'Filter by country ID (or "global" for global templates)' })
  @IsOptional()
  @IsString()
  countryId?: string;

  @ApiPropertyOptional({
    description: 'Filter by template category',
    enum: [
      'document_types',
      'leave_policies',
      'notification_templates',
      'default_roles',
      'onboarding_checklists',
    ],
  })
  @IsOptional()
  @IsIn(PLATFORM_TEMPLATE_CATEGORIES)
  category?: PlatformTemplateCategory;

  @ApiPropertyOptional({ description: 'Filter by status', enum: ['draft', 'published', 'archived', 'all'] })
  @IsOptional()
  @IsString()
  status?: string;
}
