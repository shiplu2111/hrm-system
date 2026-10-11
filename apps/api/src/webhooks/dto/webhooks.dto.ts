import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import type {
  TenantWebhookStatus,
  WebhookDeliveryStateFilter,
} from '@hrm/shared-types';
import { WEBHOOK_URL_MAX_LENGTH } from '../webhook-url.util';

const DELIVERY_STATE_FILTERS: WebhookDeliveryStateFilter[] = [
  'all',
  'pending',
  'sending',
  'retrying',
  'delivered',
  'failed',
];

export class CreateTenantWebhookDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(WEBHOOK_URL_MAX_LENGTH)
  url!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  events!: string[];

  @IsOptional()
  @IsUUID()
  companyId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateTenantWebhookDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(WEBHOOK_URL_MAX_LENGTH)
  url?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  events?: string[];

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsUUID()
  companyId?: string | null;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: TenantWebhookStatus;
}

export class ListWebhookDeliveriesQueryDto {
  @IsOptional()
  @IsUUID()
  webhookId?: string;

  @IsOptional()
  @IsIn(DELIVERY_STATE_FILTERS)
  state?: WebhookDeliveryStateFilter;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
