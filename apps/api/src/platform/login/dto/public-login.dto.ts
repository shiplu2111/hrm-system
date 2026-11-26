import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { NoScriptInjection } from '../../../common/validators/no-script.validator';

export class PublicLoginDiscoverDto {
  @ApiProperty({
    description: 'Company subdomain / workspace address or work email address',
    example: 'acme',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  @NoScriptInjection()
  identifier!: string;

  @ApiPropertyOptional({
    enum: ['portal', 'employee'],
    default: 'portal',
    description: 'Preferred destination application',
  })
  @IsOptional()
  @IsIn(['portal', 'employee'])
  portal?: 'portal' | 'employee';
}

export class PublicForgotCompanyDto {
  @ApiProperty({
    description: 'Work email address to look up associated workspaces',
    example: 'alex@acme-corp.com',
  })
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(160)
  workEmail!: string;

  @ApiPropertyOptional({ description: 'Honeypot anti-bot field; must stay empty' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
