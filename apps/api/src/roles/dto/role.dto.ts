import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { PermissionAction } from '@hrm/shared-types';
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
} from '../../rbac/rbac.constants';

export class PermissionEntryDto {
  @ApiProperty({ example: 'employee', enum: PERMISSION_MODULES })
  @IsString()
  @IsIn([...PERMISSION_MODULES])
  module!: string;

  @ApiProperty({ example: 'view', enum: PERMISSION_ACTIONS })
  @IsIn([...PERMISSION_ACTIONS])
  action!: PermissionAction;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'Branch Manager', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ type: [PermissionEntryDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PermissionEntryDto)
  permissions!: PermissionEntryDto[];
}

export class UpdateRoleDto {
  @ApiProperty({ example: 'Branch Manager', required: false })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiProperty({ type: [PermissionEntryDto], required: false })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PermissionEntryDto)
  permissions?: PermissionEntryDto[];
}

export class RolePermissionResponseDto {
  @ApiProperty()
  module!: string;

  @ApiProperty()
  action!: string;
}

export class RoleResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ nullable: true })
  tenantId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isSystem!: boolean;

  @ApiProperty({ type: [RolePermissionResponseDto] })
  permissions!: RolePermissionResponseDto[];
}

export class PermissionCatalogDto {
  @ApiProperty({ type: [String] })
  modules!: string[];

  @ApiProperty({ type: [String] })
  actions!: string[];
}
