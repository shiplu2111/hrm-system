import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import type {
  SupportAccessMode,
  SupportAccessStatus,
  SupportSessionsQueryDto,
} from '@hrm/shared-types';

export class QuerySupportSessionsDto implements SupportSessionsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Search filter across staff name, email, tenant name, or reason',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by session status',
    enum: ['all', 'pending', 'approved', 'rejected', 'expired', 'revoked'],
  })
  @IsOptional()
  @IsIn(['all', 'pending', 'approved', 'rejected', 'expired', 'revoked'])
  status?: SupportAccessStatus | 'all';

  @ApiPropertyOptional({
    description: 'Filter by access mode',
    enum: ['all', 'read_only', 'read_write'],
  })
  @IsOptional()
  @IsIn(['all', 'read_only', 'read_write'])
  accessMode?: SupportAccessMode | 'all';

  @ApiPropertyOptional({ description: 'Filter by specific tenant UUID' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['createdAt', 'expiresAt', 'durationMinutes', 'actionsCount'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(['createdAt', 'expiresAt', 'durationMinutes', 'actionsCount'])
  sortBy?: 'createdAt' | 'expiresAt' | 'durationMinutes' | 'actionsCount' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc' = 'desc';
}
