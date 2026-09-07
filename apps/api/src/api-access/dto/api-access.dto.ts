import {
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateTenantApiKeyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scopes!: string[];

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class CreateTenantOAuthClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUrl({}, { each: true })
  redirectUris!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  scopes!: string[];
}

export class OAuthAuthorizeQueryDto {
  @IsString()
  client_id!: string;

  @IsUrl({ require_tld: false })
  redirect_uri!: string;

  @IsString()
  response_type!: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @IsString()
  state?: string;
}

export class OAuthTokenDto {
  @IsString()
  grant_type!: 'authorization_code' | 'client_credentials';

  @IsString()
  client_id!: string;

  @IsString()
  client_secret!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  redirect_uri?: string;

  @IsOptional()
  @IsString()
  scope?: string;
}
