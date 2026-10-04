import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  WorkflowAssigneeType,
  WorkflowEntityType,
  WorkflowInstanceStatus,
} from '@prisma/client';
import { WORKFLOW_MAX_STEPS } from '@hrm/shared-types';

const MONEY = { maxDecimalPlaces: 2 };
const MONEY_MESSAGE = { message: '$property must be an amount with at most 2 decimal places' };
const MAX_AMOUNT = 999_999_999_999.99;

export class WorkflowStepConditionDto {
  @IsIn(['amount_threshold'])
  type!: 'amount_threshold';

  @IsIn(['gt', 'gte'])
  operator!: 'gt' | 'gte';

  @IsNumber(MONEY, MONEY_MESSAGE)
  @Min(0.01)
  @Max(MAX_AMOUNT)
  value!: number;
}

export class WorkflowDefinitionStepDto {
  @IsInt()
  @Min(1)
  order!: number;

  @IsEnum(WorkflowAssigneeType)
  assigneeType!: WorkflowAssigneeType;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  roleName!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowStepConditionDto)
  condition?: WorkflowStepConditionDto | null;
}

export class WorkflowTriggerConfigDto {
  @IsIn(['always', 'amount_threshold'])
  type!: 'always' | 'amount_threshold';

  @IsOptional()
  @IsIn(['gt', 'gte'])
  operator?: 'gt' | 'gte';

  @IsOptional()
  @IsNumber(MONEY, MONEY_MESSAGE)
  @Min(0.01)
  @Max(MAX_AMOUNT)
  value?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;
}

export class CreateWorkflowDefinitionDto {
  @IsEnum(WorkflowEntityType)
  entityType!: WorkflowEntityType;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowTriggerConfigDto)
  triggerConfig?: WorkflowTriggerConfigDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(WORKFLOW_MAX_STEPS)
  @ValidateNested({ each: true })
  @Type(() => WorkflowDefinitionStepDto)
  steps!: WorkflowDefinitionStepDto[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;
}

export class UpdateWorkflowDefinitionDto {
  @IsOptional()
  @IsEnum(WorkflowEntityType)
  entityType?: WorkflowEntityType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowTriggerConfigDto)
  triggerConfig?: WorkflowTriggerConfigDto | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(WORKFLOW_MAX_STEPS)
  @ValidateNested({ each: true })
  @Type(() => WorkflowDefinitionStepDto)
  steps?: WorkflowDefinitionStepDto[];

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;
}

export class ListWorkflowDefinitionsQueryDto {
  @IsOptional()
  @IsEnum(WorkflowEntityType)
  entityType?: WorkflowEntityType;

  @IsOptional()
  @IsBoolean()
  activeOnly?: boolean;
}

export class ListWorkflowInstancesQueryDto {
  @IsOptional()
  @IsEnum(WorkflowEntityType)
  entityType?: WorkflowEntityType;

  @IsOptional()
  @IsEnum(WorkflowInstanceStatus)
  status?: WorkflowInstanceStatus;

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}

export class WorkflowActionDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
