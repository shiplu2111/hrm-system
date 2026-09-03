import { IsDateString, IsOptional } from 'class-validator';

export class PayrollPreviewQueryDto {
  @IsOptional()
  @IsDateString()
  asOf?: string;
}
