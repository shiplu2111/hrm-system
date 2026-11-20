import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class Verify2faDto {
  @ApiProperty({ description: 'Short-lived MFA challenge token issued during step 1 login' })
  @IsString()
  @IsNotEmpty({ message: 'MFA token is required' })
  mfaToken!: string;

  @ApiProperty({ description: '6-digit TOTP code from authenticator app', example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'TOTP code must be exactly 6 digits' })
  totpCode!: string;
}

export class PlatformRefreshTokenDto {
  @ApiProperty({ description: 'Platform refresh token' })
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refreshToken!: string;
}

export class PlatformChangePasswordDto {
  @ApiProperty({ description: 'Current password' })
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword!: string;

  @ApiProperty({ description: 'New password (min 8 characters)' })
  @IsString()
  @Length(8, 128, { message: 'New password must be at least 8 characters long' })
  newPassword!: string;
}

export class PlatformConfirm2faDto {
  @ApiProperty({ description: 'Base32 TOTP secret being enrolled' })
  @IsString()
  @IsNotEmpty({ message: 'Secret is required' })
  secret!: string;

  @ApiProperty({ description: '6-digit verification code' })
  @IsString()
  @Length(6, 6, { message: 'Verification code must be 6 digits' })
  totpCode!: string;
}

