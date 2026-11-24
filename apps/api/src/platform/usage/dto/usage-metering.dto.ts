// usage-metering.dto.ts
// DTOs for Platform Usage Metering endpoints

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class UsageMeteringFilterDto {
  @ApiPropertyOptional({ description: 'Filter by specific tenant UUID' })
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Start date in YYYY-MM-DD format' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date in YYYY-MM-DD format' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by tenant name or subdomain' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class TriggerUsageMeteringDto {
  @ApiPropertyOptional({
    description: 'Target metering date in YYYY-MM-DD format (defaults to yesterday)',
    example: '2026-11-23',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Optional single tenant UUID to meter (defaults to all active tenants)',
  })
  @IsOptional()
  @IsUUID('4')
  tenantId?: string;
}
