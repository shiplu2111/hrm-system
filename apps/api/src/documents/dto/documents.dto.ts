import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import {
  CustomFieldEntityType,
  CustomFieldType,
  DocumentScope,
} from '@prisma/client';

export class CreateCustomFieldDto {
  @IsEnum(CustomFieldEntityType)
  entityType!: CustomFieldEntityType;

  @IsOptional()
  @IsUUID()
  contextId?: string | null;

  @IsOptional()
  @IsString()
  fieldKey?: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsEnum(CustomFieldType)
  fieldType!: CustomFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateCustomFieldDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  label?: string;

  @IsOptional()
  @IsEnum(CustomFieldType)
  fieldType?: CustomFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class DocumentTypeFieldDto {
  @IsOptional()
  @IsString()
  fieldKey?: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsEnum(CustomFieldType)
  fieldType!: CustomFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateDocumentTypeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(DocumentScope)
  scope?: DocumentScope;

  @IsOptional()
  @IsBoolean()
  requiresVerification?: boolean;

  @IsOptional()
  @IsBoolean()
  tracksExpiry?: boolean;

  @IsOptional()
  @IsArray()
  fields?: DocumentTypeFieldDto[];
}

export class UpdateDocumentTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsEnum(DocumentScope)
  scope?: DocumentScope;

  @IsOptional()
  @IsBoolean()
  requiresVerification?: boolean;

  @IsOptional()
  @IsBoolean()
  tracksExpiry?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateEmployeeDocumentDto {
  @IsUUID()
  documentTypeId!: string;

  @IsOptional()
  fields?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  fileKey?: string | null;

  @IsOptional()
  @IsString()
  expiryDate?: string | null;
}

export class UpdateEmployeeDocumentDto {
  @IsOptional()
  fields?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  fileKey?: string | null;

  @IsOptional()
  @IsString()
  expiryDate?: string | null;
}
