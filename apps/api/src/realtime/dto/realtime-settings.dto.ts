import {
  IsBoolean,
  IsObject,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';
import type { RealtimeBroadcastMap } from '@hrm/shared-types';
import { DEFAULT_REALTIME_BROADCAST } from '../realtime.constants';

const KNOWN_EVENTS = new Set(Object.keys(DEFAULT_REALTIME_BROADCAST));

/** Every key must be a known event type and every value a boolean. */
function IsLiveBroadcastMap(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isLiveBroadcastMap',
      target: target.constructor,
      propertyName,
      options: {
        message: `liveBroadcast keys must be known event types (${[...KNOWN_EVENTS].join(', ')}) with boolean values`,
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          !!value &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          Object.entries(value).every(
            ([key, flag]) => KNOWN_EVENTS.has(key) && typeof flag === 'boolean',
          ),
      },
    });
}

export class UpdateRealtimeNotificationSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsObject()
  @IsLiveBroadcastMap()
  liveBroadcast!: Partial<RealtimeBroadcastMap>;
}
