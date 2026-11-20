import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import type { SupportAccessMode } from '@hrm/shared-types';

export class UpdateSupportAccessPreauthorizationDto {
  @ApiProperty({
    description: 'Whether platform support engineers may access workspace without manual approval per request',
    example: true,
  })
  @IsBoolean()
  preauthorized: boolean;
}

export class ApproveSupportAccessRequestDto {
  @ApiPropertyOptional({
    description: 'Granted access mode: read_only (default) or read_write',
    enum: ['read_only', 'read_write'],
    default: 'read_only',
  })
  @IsOptional()
  @IsIn(['read_only', 'read_write'])
  accessMode?: SupportAccessMode;
}

export class RejectSupportAccessRequestDto {
  @ApiPropertyOptional({
    description: 'Optional reason for rejecting the support access request',
    example: 'Support access not required at this time',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class RevokeSupportAccessRequestDto {
  @ApiProperty({
    description: 'Mandatory reason for terminating the active support session',
    example: 'Maintenance window completed early',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
