import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PayComponentCalculationType, PayComponentType } from '@prisma/client';

export class PayComponentFormulaDto {
  @IsOptional()
  @IsEnum(['basic', 'gross'])
  base?: 'basic' | 'gross';

  @IsOptional()
  @Type(() => Number)
  percentage?: number;
}

export class CreatePayComponentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(PayComponentType)
  type!: PayComponentType;

  @IsEnum(PayComponentCalculationType)
  calculationType!: PayComponentCalculationType;

  /** Percentage defaults or structured formula rule (version: 1) — validated in service */
  @IsOptional()
  @IsObject()
  formula?: Record<string, unknown>;
}

export class UpdatePayComponentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(PayComponentCalculationType)
  calculationType?: PayComponentCalculationType;

  @IsOptional()
  @IsObject()
  formula?: Record<string, unknown> | null;
}
