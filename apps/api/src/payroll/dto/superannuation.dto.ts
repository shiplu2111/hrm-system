import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, Matches } from 'class-validator';

export class SuperannuationSettingsQueryDto {
  @ApiPropertyOptional({
    description: 'Resolve the rules in effect on this date (YYYY-MM-DD). Defaults to today.',
    example: '2026-07-01',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'asOf must be a date in YYYY-MM-DD format' })
  @IsDateString({ strict: true }, { message: 'asOf must be a valid calendar date' })
  asOf?: string;
}
