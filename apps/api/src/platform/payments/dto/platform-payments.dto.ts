import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export enum PaymentStatusEnum {
  pending = 'pending',
  succeeded = 'succeeded',
  failed = 'failed',
  refunded = 'refunded',
  partially_refunded = 'partially_refunded',
}

export enum RefundTypeEnum {
  full = 'full',
  partial = 'partial',
}

export class QueryPlatformPaymentsDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(PaymentStatusEnum)
  status?: PaymentStatusEnum;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class RefundPaymentDto {
  @IsEnum(RefundTypeEnum)
  refundType!: RefundTypeEnum;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsNotEmpty()
  @IsString()
  reason!: string;
}

export class RetryPaymentDto {
  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;

  @IsOptional()
  @IsString()
  failureReason?: string;
}
