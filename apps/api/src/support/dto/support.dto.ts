import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import type {
  SupportTicketPriority,
  SupportTicketStatus,
} from '@hrm/shared-types';

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
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
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
  body?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
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
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: SupportTicketPriority;

  @IsOptional()
  @IsUUID()
  companyId?: string;
}

export class UpdateSupportTicketDto {
  @IsOptional()
  @IsEnum(['open', 'in_progress', 'waiting', 'resolved', 'closed'])
  status?: SupportTicketStatus;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high', 'urgent'])
  priority?: SupportTicketPriority;

  @IsOptional()
  @IsUUID()
  assignedToUserId?: string | null;
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
