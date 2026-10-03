import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  ValidateNested,
} from 'class-validator';
import type { NotificationEventType } from '@hrm/shared-types';
import { NOTIFICATION_EVENT_TYPES } from '../notification-settings.utils';

class NotificationChannelsDto {
  @IsBoolean()
  inApp!: boolean;

  @IsBoolean()
  email!: boolean;

  @IsBoolean()
  push!: boolean;
}

class NotificationEventUpdateDto {
  @IsIn(NOTIFICATION_EVENT_TYPES)
  eventType!: NotificationEventType;

  @IsBoolean()
  enabled!: boolean;

  @ValidateNested()
  @Type(() => NotificationChannelsDto)
  channels!: NotificationChannelsDto;

  @IsBoolean()
  live!: boolean;
}

export class UpdateNotificationEventSettingsDto {
  @IsBoolean()
  realtimeEnabled!: boolean;

  @IsArray()
  @ArrayMaxSize(NOTIFICATION_EVENT_TYPES.length)
  @ValidateNested({ each: true })
  @Type(() => NotificationEventUpdateDto)
  events!: NotificationEventUpdateDto[];
}
