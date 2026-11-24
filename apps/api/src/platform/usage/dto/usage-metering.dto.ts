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

export class TenantUsageOverviewFilterDto {
  @ApiPropertyOptional({ description: 'Search tenant by name or subdomain' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by plan code (free, starter, business, enterprise)' })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional({
    description: 'Filter by limit utilization status',
    enum: ['all', 'near_limit', 'over_limit', 'normal'],
  })
  @IsOptional()
  @IsString()
  status?: 'all' | 'near_limit' | 'over_limit' | 'normal';

  @ApiPropertyOptional({
    description: 'Filter by specific resource bottleneck',
    enum: ['all', 'employees', 'storage', 'api_calls'],
  })
  @IsOptional()
  @IsString()
  resource?: 'all' | 'employees' | 'storage' | 'api_calls';

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: [
      'tenantName',
      'maxUsagePercent',
      'employeePercent',
      'storagePercent',
      'apiPercent',
      'activeEmployees',
      'storageUsedBytes',
      'apiCalls',
    ],
  })
  @IsOptional()
  @IsString()
  sortBy?:
    | 'tenantName'
    | 'maxUsagePercent'
    | 'employeePercent'
    | 'storagePercent'
    | 'apiPercent'
    | 'activeEmployees'
    | 'storageUsedBytes'
    | 'apiCalls';

  @ApiPropertyOptional({ description: 'Sort order', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

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

export class TenantUsageTrendsQueryDto {
  @ApiPropertyOptional({ description: 'Optional specific tenant ID to drilldown' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional({ description: 'Number of past days of trend history (default 30)', default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(90)
  days?: number;
}

export class TenantUsageExportQueryDto {
  @ApiPropertyOptional({ description: 'Export format', enum: ['csv', 'json'], default: 'csv' })
  @IsOptional()
  @IsString()
  format?: 'csv' | 'json';

  @ApiPropertyOptional({ description: 'Search tenant by name or subdomain' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by plan code' })
  @IsOptional()
  @IsString()
  plan?: string;

  @ApiPropertyOptional({ description: 'Filter by limit utilization status' })
  @IsOptional()
  @IsString()
  status?: 'all' | 'near_limit' | 'over_limit' | 'normal';

  @ApiPropertyOptional({ description: 'Filter by bottleneck resource' })
  @IsOptional()
  @IsString()
  resource?: 'all' | 'employees' | 'storage' | 'api_calls';
}

