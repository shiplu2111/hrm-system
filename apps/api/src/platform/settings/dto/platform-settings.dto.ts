import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type {
  PlatformEmailProviderKind,
  PlatformSmsProviderKind,
  PlatformStorageDriverKind,
  SendTestEmailInput,
  SendTestSmsInput,
  UpdatePlatformBillingSettingsInput,
  UpdatePlatformEmailSettingsInput,
  UpdatePlatformPushSettingsInput,
  UpdatePlatformSmsSettingsInput,
  UpdatePlatformStorageSettingsInput,
} from '@hrm/shared-types';

export class UpdatePlatformEmailSettingsDto implements UpdatePlatformEmailSettingsInput {
  @ApiProperty({ description: 'Email provider', enum: ['smtp', 'sendgrid', 'postmark', 'ses'] })
  @IsString()
  @IsIn(['smtp', 'sendgrid', 'postmark', 'ses'])
  provider: PlatformEmailProviderKind;

  @ApiProperty({ description: 'SMTP server host', example: 'smtp.sendgrid.net' })
  @IsString()
  @IsNotEmpty()
  host: string;

  @ApiProperty({ description: 'SMTP port', example: 587 })
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @ApiProperty({ description: 'Use TLS/SSL', example: true })
  @IsBoolean()
  secure: boolean;

  @ApiProperty({ description: 'SMTP username/API key', example: 'apikey' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiPropertyOptional({ description: 'New password or API secret (omit to keep unchanged)' })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({ description: 'Default sender email address', example: 'noreply@hrm-platform.io' })
  @IsEmail()
  fromAddress: string;

  @ApiProperty({ description: 'Default sender display name', example: 'CMSN HRM Platform' })
  @IsString()
  @IsNotEmpty()
  fromName: string;
}

export class SendTestEmailDto implements SendTestEmailInput {
  @ApiProperty({ description: 'Recipient email address', example: 'admin@company.com' })
  @IsEmail()
  to: string;

  @ApiPropertyOptional({ description: 'Custom test email subject', example: 'CMSN Platform SMTP Verification' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: 'Custom body preview text' })
  @IsOptional()
  @IsString()
  testBody?: string;
}

export class UpdatePlatformSmsSettingsDto implements UpdatePlatformSmsSettingsInput {
  @ApiProperty({ description: 'SMS provider', enum: ['twilio', 'messagebird', 'sns', 'custom'] })
  @IsString()
  @IsIn(['twilio', 'messagebird', 'sns', 'custom'])
  provider: PlatformSmsProviderKind;

  @ApiProperty({ description: 'Provider Account SID or Client Key', example: 'AC9876543210fedcba' })
  @IsString()
  @IsNotEmpty()
  accountSid: string;

  @ApiPropertyOptional({ description: 'Provider Auth Token / Secret (omit to keep unchanged)' })
  @IsOptional()
  @IsString()
  authToken?: string;

  @ApiProperty({ description: 'Sender phone number or shortcode', example: '+15550192837' })
  @IsString()
  @IsNotEmpty()
  fromNumber: string;
}

export class SendTestSmsDto implements SendTestSmsInput {
  @ApiProperty({ description: 'Recipient mobile phone number (E.164)', example: '+15559876543' })
  @IsString()
  @IsNotEmpty()
  to: string;

  @ApiPropertyOptional({ description: 'Test SMS message content' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class UpdatePlatformPushSettingsDto implements UpdatePlatformPushSettingsInput {
  @ApiPropertyOptional({ description: 'Push notification provider', example: 'firebase' })
  @IsOptional()
  @IsIn(['firebase'])
  provider?: 'firebase';

  @ApiProperty({ description: 'Firebase Project ID', example: 'hrm-cloud-prod' })
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @ApiProperty({ description: 'Service Account Client Email', example: 'firebase-adminsdk@hrm-cloud-prod.iam.gserviceaccount.com' })
  @IsString()
  @IsNotEmpty()
  clientEmail: string;

  @ApiPropertyOptional({ description: 'Service Account Private Key (omit to keep unchanged)' })
  @IsOptional()
  @IsString()
  privateKey?: string;

  @ApiPropertyOptional({ description: 'Web/Mobile Client App ID' })
  @IsOptional()
  @IsString()
  appId?: string;
}

export class UpdatePlatformStorageSettingsDto implements UpdatePlatformStorageSettingsInput {
  @ApiProperty({ description: 'Storage driver kind', enum: ['local', 's3'] })
  @IsString()
  @IsIn(['local', 's3'])
  storageDriver: PlatformStorageDriverKind;

  @ApiPropertyOptional({ description: 'Local filesystem base directory', example: './storage' })
  @IsOptional()
  @IsString()
  localPath?: string;

  @ApiPropertyOptional({ description: 'S3 Bucket name', example: 'hrm-documents-vault' })
  @IsOptional()
  @IsString()
  s3Bucket?: string;

  @ApiPropertyOptional({ description: 'S3 Region code', example: 'us-east-1' })
  @IsOptional()
  @IsString()
  s3Region?: string;

  @ApiPropertyOptional({ description: 'Custom S3 Endpoint (for MinIO or Cloudflare R2)' })
  @IsOptional()
  @IsString()
  s3Endpoint?: string;

  @ApiPropertyOptional({ description: 'Force S3 Path Style (true for MinIO/localstack)' })
  @IsOptional()
  @IsBoolean()
  s3ForcePathStyle?: boolean;

  @ApiPropertyOptional({ description: 'S3 Access Key ID' })
  @IsOptional()
  @IsString()
  s3AccessKeyId?: string;

  @ApiPropertyOptional({ description: 'S3 Secret Access Key (omit to keep unchanged)' })
  @IsOptional()
  @IsString()
  s3SecretKey?: string;
}

export class UpdatePlatformBillingSettingsDto implements UpdatePlatformBillingSettingsInput {
  @ApiPropertyOptional({ description: 'Billing provider', example: 'stripe' })
  @IsOptional()
  @IsIn(['stripe'])
  provider?: 'stripe';

  @ApiProperty({ description: 'Stripe Publishable Key (pk_test_... or pk_live_...)', example: 'pk_test_51Mz0000000000000' })
  @IsString()
  @IsNotEmpty()
  publishableKey: string;

  @ApiPropertyOptional({ description: 'Stripe Secret Key (sk_test_... or sk_live_... omit to keep unchanged)' })
  @IsOptional()
  @IsString()
  secretKey?: string;

  @ApiPropertyOptional({ description: 'Stripe Webhook Signing Secret (whsec_... omit to keep unchanged)' })
  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @ApiProperty({ description: 'Default billing currency (ISO 3-letter)', example: 'USD' })
  @IsString()
  @IsNotEmpty()
  currency: string;
}
