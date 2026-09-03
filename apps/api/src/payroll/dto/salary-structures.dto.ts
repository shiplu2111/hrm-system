import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SalaryStructureComponentType } from '@prisma/client';

export class SalaryStructureAmountDto {
  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @Type(() => Number)
  percentage?: number;
}

export class CreateSalaryStructureDto {
  @IsUUID()
  componentId!: string;

  @IsEnum(SalaryStructureComponentType)
  componentType!: SalaryStructureComponentType;

  @ValidateNested()
  @Type(() => SalaryStructureAmountDto)
  amountOrFormula!: SalaryStructureAmountDto;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;
}

export class UpdateSalaryStructureDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => SalaryStructureAmountDto)
  amountOrFormula?: SalaryStructureAmountDto;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;
}

export class ListSalaryStructuresQueryDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;
}
