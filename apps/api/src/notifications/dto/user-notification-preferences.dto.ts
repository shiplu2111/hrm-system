import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import {
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
  type UpdateUserNotificationPreferencesInput,
} from '@hrm/shared-types';

export class CategoryPreferenceItemDto {
  @IsNotEmpty()
  @IsIn(NOTIFICATION_CATEGORIES)
  category!: NotificationCategory;

  @IsOptional()
  @IsBoolean()
  inApp?: boolean;

  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @IsOptional()
  @IsBoolean()
  push?: boolean;
}

export class UpdateUserNotificationPreferencesDto
  implements UpdateUserNotificationPreferencesInput
{
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryPreferenceItemDto)
  preferences!: CategoryPreferenceItemDto[];
}
