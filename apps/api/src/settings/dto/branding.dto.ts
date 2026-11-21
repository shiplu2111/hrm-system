import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateTenantBrandingDto {
  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/favicon.ico' })
  @IsOptional()
  @IsString()
  faviconUrl?: string | null;

  @ApiPropertyOptional({ example: '#2563EB', description: 'Primary brand color hex code' })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'primaryColor must be a valid 3- or 6-digit hex color code (e.g. #2563EB)',
  })
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#1E40AF' })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'secondaryColor must be a valid 3- or 6-digit hex color code',
  })
  secondaryColor?: string;

  @ApiPropertyOptional({ example: '#F59E0B' })
  @IsOptional()
  @IsString()
  accentColor?: string;

  @ApiPropertyOptional({ example: '#F8FAFC' })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiPropertyOptional({ example: 'Acme People Portal' })
  @IsOptional()
  @IsString()
  appTitle?: string;

  @ApiPropertyOptional({ example: 'Acme HR Team', description: 'White-labeled sender name for outbound emails' })
  @IsOptional()
  @IsString()
  emailSenderName?: string;

  @ApiPropertyOptional({ example: 'hr@acmepayroll.com', description: 'White-labeled sender email address' })
  @IsOptional()
  @IsEmail()
  emailSenderAddress?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  showPoweredBy?: boolean;

  @ApiPropertyOptional({ example: 'hr.acmepayroll.com' })
  @IsOptional()
  @IsString()
  customDomain?: string | null;
}
