import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateSmtpSettingsDto {
  @IsString()
  @MinLength(1)
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsOptional()
  @IsString()
  username?: string;

  /** Omit or leave blank to keep the existing encrypted password. */
  @IsOptional()
  @IsString()
  password?: string;

  @IsEmail()
  fromAddress!: string;

  @IsString()
  @MinLength(1)
  fromName!: string;

  @IsBoolean()
  useTls!: boolean;
}

export class SendSmtpTestEmailDto {
  @IsEmail()
  toEmail!: string;

  @ValidateIf((dto: SendSmtpTestEmailDto) => dto.host !== undefined)
  @IsString()
  @MinLength(1)
  host?: string;

  @ValidateIf((dto: SendSmtpTestEmailDto) => dto.port !== undefined)
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @ValidateIf((dto: SendSmtpTestEmailDto) => dto.fromAddress !== undefined)
  @IsEmail()
  fromAddress?: string;

  @ValidateIf((dto: SendSmtpTestEmailDto) => dto.fromName !== undefined)
  @IsString()
  @MinLength(1)
  fromName?: string;

  @IsOptional()
  @IsBoolean()
  useTls?: boolean;
}
