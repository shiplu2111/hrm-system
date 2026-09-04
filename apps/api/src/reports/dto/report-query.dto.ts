import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import type { ReportExportFormat } from '@hrm/shared-types';

export class ReportQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to must be YYYY-MM-DD' })
  to?: string;
}

export class ReportExportQueryDto extends ReportQueryDto {
  @IsOptional()
  @IsIn(['csv', 'xlsx'])
  format?: ReportExportFormat = 'csv';
}
