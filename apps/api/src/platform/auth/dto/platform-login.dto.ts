import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class PlatformLoginDto {
  @ApiProperty({ example: 'platform.owner@cmsnbd.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({ example: 'password' })
  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;

  @ApiPropertyOptional({
    description: '6-digit TOTP code. Can be provided in the initial login or via /platform/auth/verify-2fa.',
    example: '123456',
  })
  @IsOptional()
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  totpCode?: string;
}
