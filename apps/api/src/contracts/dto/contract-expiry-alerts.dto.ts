import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  CONTRACT_EXPIRY_WINDOW_MAX_DAYS,
  CONTRACT_EXPIRY_WINDOW_MIN_DAYS,
} from '@hrm/shared-types';

export class ContractExpiryAlertsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  windowDays?: number;
}

export class UpdateContractExpiryAlertSettingsDto {
  @IsInt()
  @Min(CONTRACT_EXPIRY_WINDOW_MIN_DAYS)
  @Max(CONTRACT_EXPIRY_WINDOW_MAX_DAYS)
  windowDays!: number;
}
