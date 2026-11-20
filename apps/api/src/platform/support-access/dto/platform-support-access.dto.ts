import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import type { SupportAccessMode } from '@hrm/shared-types';

export class CreateSupportAccessRequestDto {
  @ApiProperty({
    description: 'Mandatory justification for requesting support access (min 10 characters)',
    example: 'Investigating payroll calculation discrepancy reported in ticket #1049',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  reason: string;

  @ApiProperty({
    description: 'Requested duration in minutes (max 240 minutes / 4 hours)',
    example: 60,
    minimum: 15,
    maximum: 240,
  })
  @IsInt()
  @Min(15)
  @Max(240)
  durationMinutes: number;

  @ApiPropertyOptional({
    description: 'Access mode: read_only (default) or read_write',
    enum: ['read_only', 'read_write'],
    default: 'read_only',
  })
  @IsOptional()
  @IsIn(['read_only', 'read_write'])
  accessMode?: SupportAccessMode = 'read_only';
}

export class RevokeSupportAccessSessionDto {
  @ApiProperty({
    description: 'Reason for terminating the active support access session',
    example: 'Support investigation completed successfully',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
}
