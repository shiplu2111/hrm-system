import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type {
  KbArticleStatusFilter,
  SupportQueueAssigneeFilter,
  SupportTicketPriority,
  SupportWorkflowStatus,
} from '@hrm/shared-types';

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const WORKFLOW_STATUSES = ['open', 'in_progress', 'resolved'];

export class CreateKbCategoryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class UpdateKbCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  sortOrder?: number;
}

export class CreateKbArticleDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  summary!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(50_000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class UpdateKbArticleDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  summary?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(50_000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}

export class ListKbArticlesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsIn(['all', 'published', 'draft'])
  status?: KbArticleStatusFilter;
}

export class CreateSupportTicketDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description!: string;

  @IsOptional()
  @IsEnum(PRIORITIES)
  priority?: SupportTicketPriority;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsIn(WORKFLOW_STATUSES)
  status?: SupportWorkflowStatus;

  @IsOptional()
  @IsEnum(PRIORITIES)
  priority?: SupportTicketPriority;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  assignedToUserId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}

export class SupportQueueQueryDto {
  @IsOptional()
  @IsIn([...WORKFLOW_STATUSES, 'all'])
  status?: SupportWorkflowStatus | 'all';

  @IsOptional()
  @IsEnum(PRIORITIES)
  priority?: SupportTicketPriority;

  @IsOptional()
  @IsIn(['all', 'me', 'unassigned'])
  assignee?: SupportQueueAssigneeFilter;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class CreateSupportTicketMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
