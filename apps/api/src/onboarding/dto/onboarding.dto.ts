import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  AssetCategory,
  OnboardingStatus,
  OnboardingTaskCategory,
  OnboardingTaskType,
} from '@prisma/client';

export class ListOnboardingTemplatesQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean;
}

export class CreateOnboardingTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateOnboardingTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateOnboardingTemplateItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(OnboardingTaskCategory)
  category!: OnboardingTaskCategory;

  @IsEnum(OnboardingTaskType)
  taskType!: OnboardingTaskType;

  @IsOptional()
  @IsUUID()
  documentTypeId?: string;

  @IsOptional()
  @IsEnum(AssetCategory)
  assetCategory?: AssetCategory;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  policyDocumentUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assigneeLabel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  dueDaysOffset?: number;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class UpdateOnboardingTemplateItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsEnum(OnboardingTaskCategory)
  category?: OnboardingTaskCategory;

  @IsOptional()
  @IsEnum(OnboardingTaskType)
  taskType?: OnboardingTaskType;

  @IsOptional()
  @IsUUID()
  documentTypeId?: string | null;

  @IsOptional()
  @IsEnum(AssetCategory)
  assetCategory?: AssetCategory | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  policyDocumentUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  assigneeLabel?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  dueDaysOffset?: number | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class ReorderOnboardingTemplateItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  itemIds!: string[];
}

export class ListEmployeeOnboardingsQueryDto {
  @IsOptional()
  @IsEnum(OnboardingStatus)
  status?: OnboardingStatus;
}

export class StartEmployeeOnboardingDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsBoolean()
  sendWelcome?: boolean;
}

export class CompleteOnboardingTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SkipOnboardingTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ReopenOnboardingTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class AssignOnboardingAssetsDto {
  @IsUUID()
  assetId!: string;

  @IsOptional()
  @IsDateString()
  assignedAt?: string;

  @IsOptional()
  @IsString()
  conditionOnAssign?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
