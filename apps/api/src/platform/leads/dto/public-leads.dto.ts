import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { NoScriptInjection } from '../../../common/validators/no-script.validator';

export class BaseLeadSubmissionDto {
  @ApiProperty({ description: 'Full name of contact', example: 'Jordan Taylor' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @NoScriptInjection()
  name!: string;

  @ApiProperty({ description: 'Work email address', example: 'jordan@acme-corp.com' })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(160)
  workEmail!: string;

  @ApiPropertyOptional({ description: 'Organization / company name', example: 'Acme Logistics' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @NoScriptInjection()
  company?: string;

  @ApiPropertyOptional({ description: 'Country ISO code or name', example: 'AU' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  country?: string;

  @ApiPropertyOptional({ description: 'Employee count band', example: '51-250' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  employeeCountBand?: string;

  @ApiPropertyOptional({ description: 'Inquiry notes or questions' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @NoScriptInjection()
  message?: string;

  @ApiPropertyOptional({ description: 'Originating marketing page path', example: '/pricing' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  sourcePage?: string;

  @ApiPropertyOptional({ description: 'Consent to process personal details to answer request', default: true })
  @IsBoolean()
  privacyConsent!: boolean;

  @ApiPropertyOptional({ description: 'Explicit consent to retain marketing UTM attribution', default: false })
  @IsOptional()
  @IsBoolean()
  marketingConsent?: boolean;

  @ApiPropertyOptional({ description: 'Cookie banner attribution consent to retain UTM attribution', default: false })
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

  @ApiPropertyOptional({ description: 'CAPTCHA verification token (required unless honeypot is filled)' })
  @IsOptional()
  @IsString()
  @MaxLength(1024)
  captchaToken?: string;

  @ApiPropertyOptional({ description: 'Honeypot anti-bot field; must stay empty' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class PublicDemoRequestDto extends BaseLeadSubmissionDto {
  @ApiProperty({ description: 'Company name requesting demo', example: 'Acme Logistics' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  @NoScriptInjection()
  declare company: string;
}

export class PublicContactMessageDto extends BaseLeadSubmissionDto {
  @ApiPropertyOptional({ description: 'Inquiry topic (sales, partnership, other)', example: 'sales' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @NoScriptInjection()
  topic?: string;

  @ApiProperty({ description: 'Message content', example: 'Looking for multi-country payroll details.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @NoScriptInjection()
  declare message: string;
}

export class EraseLeadDataDto {
  @ApiProperty({ description: 'Email address to erase across lead capture tables' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ description: 'Deletion / GDPR erasure request reason' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason!: string;
}
