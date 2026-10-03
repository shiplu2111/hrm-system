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
import {
  ROLE_DATA_SCOPES,
  type PermissionAction,
  type RoleDataScope,
} from '@hrm/shared-types';
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

  @ApiProperty({ enum: ROLE_DATA_SCOPES, required: false, default: 'all' })
  @IsOptional()
  @IsIn([...ROLE_DATA_SCOPES])
  dataScope?: RoleDataScope;

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

  @ApiProperty({ enum: ROLE_DATA_SCOPES, required: false })
  @IsOptional()
  @IsIn([...ROLE_DATA_SCOPES])
  dataScope?: RoleDataScope;

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

  @ApiProperty({ enum: ROLE_DATA_SCOPES })
  dataScope!: RoleDataScope;

  @ApiProperty()
  isSystem!: boolean;

  @ApiProperty({ description: 'Users currently assigned this role' })
  userCount!: number;

  @ApiProperty({ type: [RolePermissionResponseDto] })
  permissions!: RolePermissionResponseDto[];
}

export class PermissionModuleDefinitionDto {
  @ApiProperty({ example: 'payroll' })
  key!: string;

  @ApiProperty({ type: [String], enum: PERMISSION_ACTIONS })
  actions!: string[];

  @ApiProperty({ description: 'False for platform-level modules that company roles cannot hold' })
  grantable!: boolean;
}

export class PermissionCatalogDto {
  @ApiProperty({ type: [String] })
  modules!: string[];

  @ApiProperty({ type: [String] })
  actions!: string[];

  @ApiProperty({ type: [PermissionModuleDefinitionDto] })
  moduleDefinitions!: PermissionModuleDefinitionDto[];
}
