import {
  IsBoolean,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class LiveBroadcastDto {
  @IsOptional()
  @IsBoolean()
  'leave.approved'?: boolean;

  @IsOptional()
  @IsBoolean()
  'leave.rejected'?: boolean;

  @IsOptional()
  @IsBoolean()
  'payroll.finalized'?: boolean;

  @IsOptional()
  @IsBoolean()
  'attendance.late'?: boolean;
}

export class UpdateRealtimeNotificationSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsObject()
  @ValidateNested()
  @Type(() => LiveBroadcastDto)
  liveBroadcast!: LiveBroadcastDto;
}
