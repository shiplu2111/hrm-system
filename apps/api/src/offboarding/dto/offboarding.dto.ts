import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  AssetCategory,
  OffboardingStatus,
  OffboardingTaskCategory,
  OffboardingTaskType,
} from '@prisma/client';
import { EXIT_REASON_CATEGORIES, type ExitReasonCategory } from '@hrm/shared-types';
import { PayrollSalaryStructureOverrideDto } from '../../payroll/dto/payroll-simulation.dto';

export class ListOffboardingTemplatesQueryDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  activeOnly?: boolean;
}

export class CreateOffboardingTemplateDto {
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

export class UpdateOffboardingTemplateDto {
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

export class CreateOffboardingTemplateItemDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(OffboardingTaskCategory)
  category!: OffboardingTaskCategory;

  @IsEnum(OffboardingTaskType)
  taskType!: OffboardingTaskType;

  @IsOptional()
  @IsEnum(AssetCategory)
  assetCategory?: AssetCategory;

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

export class UpdateOffboardingTemplateItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(OffboardingTaskCategory)
  category?: OffboardingTaskCategory;

  @IsOptional()
  @IsEnum(OffboardingTaskType)
  taskType?: OffboardingTaskType;

  @IsOptional()
  @IsEnum(AssetCategory)
  assetCategory?: AssetCategory | null;

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

export class ListEmployeeOffboardingsQueryDto {
  @IsOptional()
  @IsEnum(OffboardingStatus)
  status?: OffboardingStatus;
}

export class StartEmployeeOffboardingDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsDateString()
  lastWorkingDate?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class ReturnOffboardingAssetsDto {
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  assetIds?: string[];

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  returnAll?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  conditionOnReturn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ReturnOffboardingAssetDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  conditionOnReturn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CompleteOffboardingTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SkipOffboardingTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  reason!: string;
}

export class ReopenOffboardingTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class SaveExitInterviewDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  scheduledAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  conductedAt?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  interviewerEmployeeId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(EXIT_REASON_CATEGORIES)
  reasonCategory?: ExitReasonCategory | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  reasonForLeaving?: string | null;

  @IsOptional()
  @IsObject()
  ratings?: Record<string, number>;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  likedMost?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  improvementSuggestions?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  feedback?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  wouldRecommend?: boolean | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsBoolean()
  wouldRehire?: boolean | null;

  @IsOptional()
  @IsBoolean()
  complete?: boolean;
}

export class SettlementLineDto {
  @IsUUID()
  componentId!: string;

  @IsString()
  @MaxLength(20)
  amount!: string;
}

export class TriggerFinalSettlementDto {
  @IsOptional()
  @IsUUID()
  originalPayrollRunId?: string;

  @IsOptional()
  @IsUUID()
  applyToPayrollPeriodId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SettlementLineDto)
  lines?: SettlementLineDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollSalaryStructureOverrideDto)
  structureOverrides?: PayrollSalaryStructureOverrideDto[];
}

export class CancelFinalSettlementDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
