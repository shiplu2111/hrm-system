import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
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
  name!: string;

  @IsOptional()
  @IsString()
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
  name?: string;

  @IsOptional()
  @IsString()
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
  title!: string;

  @IsOptional()
  @IsString()
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
  policyDocumentUrl?: string;

  @IsOptional()
  @IsString()
  assigneeLabel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
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
  title?: string;

  @IsOptional()
  @IsString()
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
  policyDocumentUrl?: string | null;

  @IsOptional()
  @IsString()
  assigneeLabel?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  dueDaysOffset?: number | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
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
  note?: string;
}

export class SkipOnboardingTaskDto {
  @IsOptional()
  @IsString()
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
