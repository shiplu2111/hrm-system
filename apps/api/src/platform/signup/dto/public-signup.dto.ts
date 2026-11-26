import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type { PublicSignupAuthMethod } from '@hrm/shared-types';
import { NoScriptInjection } from '../../../common/validators/no-script.validator';

export class PublicSignupDto {
  @ApiProperty({ description: 'Organization / company name', example: 'Acme Logistics Pty Ltd' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @NoScriptInjection()
  companyName!: string;

  @ApiProperty({ description: 'Country ISO code or slug (e.g. AU, BD, australia)', example: 'AU' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  country!: string;

  @ApiProperty({ description: 'Owner work email address', example: 'alex@acme-logistics.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(160)
  workEmail!: string;

  @ApiProperty({ description: 'Full name of workspace owner', example: 'Alex Morgan' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @NoScriptInjection()
  ownerName!: string;

  @ApiPropertyOptional({
    description: 'Preferred owner login setup mode',
    enum: ['password', 'magic_link'],
    default: 'password',
  })
  @IsOptional()
  @IsIn(['password', 'magic_link'])
  authMethod?: PublicSignupAuthMethod;

  @ApiPropertyOptional({
    description: 'Account password (required unless authMethod is magic_link)',
    minLength: 8,
  })
  @ValidateIf((o) => o.authMethod !== 'magic_link')
  @IsString()
  @IsNotEmpty({ message: 'Password is required unless using magic link setup' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128)
  password?: string;

  @ApiProperty({
    description: 'Desired unique workspace subdomain (lowercase alphanumeric + hyphens)',
    example: 'acme-logistics',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, {
    message:
      'Subdomain must be 3-63 lowercase letters, numbers, or hyphens, starting and ending with a letter or number.',
  })
  desiredSubdomain!: string;

  @ApiProperty({ description: 'Explicit acceptance of Terms & Privacy Policy', example: true })
  @IsBoolean()
  acceptedTerms!: boolean;

  @ApiProperty({ description: 'Version identifier of accepted legal terms', example: '2026-11' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  termsVersion!: string;

  @ApiProperty({ description: 'Verified CAPTCHA response token' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1024)
  captchaToken!: string;

  @ApiPropertyOptional({
    description: 'Explicit consent to associate UTM/referrer marketing attribution',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @ApiPropertyOptional({
    description: 'Cookie banner attribution consent to associate UTM/referrer without email marketing opt-in',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  attributionConsent?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmMedium?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmCampaign?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmTerm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  utmContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  referrer?: string;
}

export class VerifySignupDto {
  @ApiProperty({ description: 'Verification token sent to work email' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  token!: string;

  @ApiPropertyOptional({
    description: 'When true, returns immediately with status=provisioning so the UI can poll status.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  async?: boolean;
}

export class CheckSubdomainQueryDto {
  @ApiProperty({ description: 'Desired workspace subdomain', example: 'acme-logistics' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  subdomain!: string;
}
