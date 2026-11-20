import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

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
