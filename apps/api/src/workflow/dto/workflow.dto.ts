import { Type } from 'class-transformer';
import {
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
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  WorkflowAssigneeType,
  WorkflowEntityType,
  WorkflowInstanceStatus,
} from '@prisma/client';

export class WorkflowDefinitionStepDto {
  @IsInt()
  @Min(1)
  order!: number;

  @IsEnum(WorkflowAssigneeType)
  assigneeType!: WorkflowAssigneeType;

  @IsString()
  @MinLength(1)
  roleName!: string;
}

export class WorkflowTriggerConfigDto {
  @IsIn(['always', 'amount_threshold'])
  type!: 'always' | 'amount_threshold';

  @IsOptional()
  @IsIn(['gt', 'gte'])
  operator?: 'gt' | 'gte';

  @IsOptional()
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}

export class CreateWorkflowDefinitionDto {
  @IsEnum(WorkflowEntityType)
  entityType!: WorkflowEntityType;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowTriggerConfigDto)
  triggerConfig?: WorkflowTriggerConfigDto;

  @IsArray()
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
  effectiveTo?: string;
}

export class UpdateWorkflowDefinitionDto {
  @IsOptional()
  @IsEnum(WorkflowEntityType)
  entityType?: WorkflowEntityType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowTriggerConfigDto)
  triggerConfig?: WorkflowTriggerConfigDto | null;

  @IsOptional()
  @IsArray()
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
  effectiveTo?: string;
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
