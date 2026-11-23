import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type {
  ToggleKillSwitchInput,
  UpdateMaintenanceInput,
} from '@hrm/shared-types';

export class UpdateMaintenanceDto implements UpdateMaintenanceInput {
  @ApiProperty({ description: 'Enable immediate maintenance mode override', example: false })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ description: 'Scheduled maintenance start time (ISO 8601)', example: '2026-11-25T02:00:00Z' })
  @IsOptional()
  @IsString()
  scheduledStart?: string | null;

  @ApiPropertyOptional({ description: 'Scheduled maintenance end time (ISO 8601)', example: '2026-11-25T04:00:00Z' })
  @IsOptional()
  @IsString()
  scheduledEnd?: string | null;

  @ApiProperty({
    description: 'Custom maintenance message displayed to tenants and mobile users',
    example: 'CMSN-HR is undergoing scheduled database maintenance and infrastructure upgrades.',
  })
  @IsString()
  @IsNotEmpty()
  customMessage: string;

  @ApiProperty({
    description: 'Mandatory typed reason for updating the maintenance window or toggling state',
    example: 'Scheduled bi-weekly PostgreSQL vacuum and partition index maintenance',
  })
  @IsString()
  @MinLength(3, { message: 'A typed reason of at least 3 characters is required' })
  reason: string;
}

export class ToggleKillSwitchDto implements ToggleKillSwitchInput {
  @ApiProperty({ description: 'Kill switch state: true = feature enabled, false = feature killed/disabled', example: false })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({
    description: 'Mandatory typed reason for toggling this emergency kill switch',
    example: 'Twilio provider degradation detected on North American SMS gateway',
  })
  @IsString()
  @MinLength(3, { message: 'A typed reason of at least 3 characters is required to toggle a kill switch' })
  reason: string;
}
