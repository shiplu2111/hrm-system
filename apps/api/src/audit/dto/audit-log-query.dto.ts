import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuditAction } from '@prisma/client';

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  module?: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsUUID()
  recordId?: string;

  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  /** Inclusive lower bound. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  /** Exclusive upper bound. */
  @IsOptional()
  @IsISO8601()
  to?: string;

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
