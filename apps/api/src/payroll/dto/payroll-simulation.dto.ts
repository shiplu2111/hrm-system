import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PayrollSalaryStructureOverrideDto {
  @IsOptional()
  @IsUUID()
  salaryStructureId?: string;

  @IsOptional()
  @IsUUID()
  componentId?: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  percentage?: number;

  @IsOptional()
  @IsString()
  hourly_rate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ot_multiplier?: number;
}

export class PayrollSimulateDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayrollSalaryStructureOverrideDto)
  structureOverrides?: PayrollSalaryStructureOverrideDto[];
}
