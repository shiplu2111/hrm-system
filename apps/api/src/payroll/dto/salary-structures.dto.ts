import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
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
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;
}

export class ReviseSalaryStructureDto {
  @ValidateNested()
  @Type(() => SalaryStructureAmountDto)
  amountOrFormula!: SalaryStructureAmountDto;

  @IsDateString()
  effectiveFrom!: string;
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
