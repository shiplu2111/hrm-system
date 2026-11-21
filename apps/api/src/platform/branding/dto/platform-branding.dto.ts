import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTenantBrandingDto {
  @ApiPropertyOptional({ description: 'Logo URL for header and login portal' })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Favicon URL' })
  @IsOptional()
  @IsString()
  faviconUrl?: string;

  @ApiPropertyOptional({ description: 'Primary brand color hex code', example: '#4F46E5' })
  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'Primary color must be a valid hex color code (e.g. #4F46E5)',
  })
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'Secondary brand color hex code', example: '#06B6D4' })
  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'Secondary color must be a valid hex color code (e.g. #06B6D4)',
  })
  secondaryColor?: string;

  @ApiPropertyOptional({ description: 'Accent brand color hex code', example: '#F59E0B' })
  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'Accent color must be a valid hex color code (e.g. #F59E0B)',
  })
  accentColor?: string;

  @ApiPropertyOptional({ description: 'Background color hex code', example: '#0F172A' })
  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'Background color must be a valid hex color code (e.g. #0F172A)',
  })
  backgroundColor?: string;

  @ApiPropertyOptional({ description: 'Custom portal title', example: 'Acme People Portal' })
  @IsOptional()
  @IsString()
  appTitle?: string;

  @ApiPropertyOptional({ description: 'Display name for outbound system emails' })
  @IsOptional()
  @IsString()
  emailSenderName?: string;

  @ApiPropertyOptional({ description: 'Outbound email address', example: 'hr@acme.com' })
  @IsOptional()
  @IsEmail({}, { message: 'emailSenderAddress must be a valid email' })
  emailSenderAddress?: string;

  @ApiPropertyOptional({ description: 'Whether to show Powered by CMSN HR badge' })
  @IsOptional()
  @IsBoolean()
  showPoweredBy?: boolean;

  @ApiPropertyOptional({ description: 'Custom FQDN domain', example: 'hr.acmecorp.com' })
  @IsOptional()
  @IsString()
  customDomain?: string;
}

export class DisableCustomDomainDto {
  @ApiProperty({
    description: 'Mandatory justification reason for disabling tenant custom domain',
    example: 'Security certificate expired / client requested revert to subdomain',
  })
  @IsNotEmpty({ message: 'A justification reason is required to disable custom domain' })
  @IsString()
  reason!: string;
}

export class VerifyCustomDomainDto {
  @ApiPropertyOptional({ description: 'Optional operator notes' })
  @IsOptional()
  @IsString()
  reason?: string;
}
