import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

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
