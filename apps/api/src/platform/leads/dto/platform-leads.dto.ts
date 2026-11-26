import { ApiPropertyOptional } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePlatformLeadDto {
  @ApiPropertyOptional({ enum: LeadStatus, description: 'New pipeline status' })
  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Platform staff user UUID assigned to this inquiry (null or empty to unassign)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  assigneeUserId?: string | null;

  @ApiPropertyOptional({ description: 'Full replacement for internal staff notes' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Append a timestamped follow-up note entry' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  noteAppend?: string;

  @ApiPropertyOptional({ description: 'Optional audit reason for status or assignment change' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
