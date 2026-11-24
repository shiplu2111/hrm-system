import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreatePlatformUserDto {
  @ApiProperty({ example: 'staff@cmsnbd.com' })
  @IsEmail({}, { message: 'Valid email required' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'Platform' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Admin' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ description: 'Platform Role UUID' })
  @IsUUID('4', { message: 'Valid role UUID required' })
  @IsNotEmpty()
  roleId!: string;

  @ApiPropertyOptional({ example: 'password' })
  @IsOptional()
  @IsString()
  password?: string;
}

export class InvitePlatformUserDto {
  @ApiProperty({ example: 'sarah.connor@cmsnbd.com' })
  @IsEmail({}, { message: 'Valid email required' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'Sarah' })
  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @ApiProperty({ example: 'Connor' })
  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @ApiProperty({ description: 'Platform Role UUID' })
  @IsUUID('4', { message: 'Valid role UUID required' })
  @IsNotEmpty()
  roleId!: string;

  @ApiPropertyOptional({ example: 'TempPass123!' })
  @IsOptional()
  @IsString()
  temporaryPassword?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;
}

export class UpdatePlatformUserDto {
  @ApiPropertyOptional({ description: 'Platform Role UUID' })
  @IsOptional()
  @IsUUID('4')
  roleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lastName?: string;
}

export class Request2faResetDto {
  @ApiProperty({ example: 'Lost TOTP authenticator device on phone upgrade.' })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  reason!: string;
}

export class Review2faResetDto {
  @ApiProperty({ enum: ['approve', 'reject'], example: 'approve' })
  @IsString()
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @ApiPropertyOptional({ example: 'Verified identity via in-person or video check.' })
  @IsOptional()
  @IsString()
  reviewReason?: string;
}

export class PlatformPermissionClaimDto {
  @ApiProperty({ example: 'tenant' })
  @IsString()
  @IsNotEmpty()
  module!: string;

  @ApiProperty({ example: 'manage' })
  @IsString()
  @IsNotEmpty()
  action!: string;
}

export class CreatePlatformRoleDto {
  @ApiProperty({ example: 'DevOps Operator' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Infrastructure and maintenance operators.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [PlatformPermissionClaimDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlatformPermissionClaimDto)
  permissions!: PlatformPermissionClaimDto[];
}

export class UpdatePlatformRoleDto {
  @ApiPropertyOptional({ example: 'DevOps Operator' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [PlatformPermissionClaimDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlatformPermissionClaimDto)
  permissions?: PlatformPermissionClaimDto[];
}

export class PlatformSessionFilterDto {
  @ApiPropertyOptional({ description: 'Filter by user name, email, or IP address' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by specific staff user UUID' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({ enum: ['all', 'active', 'revoked', 'expired'] })
  @IsOptional()
  @IsIn(['all', 'active', 'revoked', 'expired'])
  status?: 'all' | 'active' | 'revoked' | 'expired';

  @ApiPropertyOptional({ description: 'Filter only sessions flagged with unusual locations' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unusualOnly?: boolean;
}

export class PlatformLoginHistoryFilterDto {
  @ApiPropertyOptional({ description: 'Filter by user name, email, or IP address' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by specific staff user UUID' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by status: success, failed, locked, 2fa_challenge, 2fa_failed' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter only login events flagged with unusual locations' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unusualOnly?: boolean;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  offset?: number;
}
