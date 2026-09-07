import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AssetCategory,
  OffboardingStatus,
  OffboardingTaskCategory,
  OffboardingTaskType,
} from '@prisma/client';
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
  conditionOnReturn?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordExitInterviewDto {
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsDateString()
  conductedAt?: string;

  @IsOptional()
  @IsUUID()
  interviewerEmployeeId?: string;

  @IsOptional()
  @IsString()
  feedback?: string;

  @IsOptional()
  @IsString()
  reasonForLeaving?: string;

  @IsOptional()
  @IsBoolean()
  wouldRehire?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
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
  reason?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollSalaryStructureOverrideDto)
  structureOverrides?: PayrollSalaryStructureOverrideDto[];
}
