import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import type {
  CreateRuleVersionInput,
  PublishRuleVersionInput,
  RejectRuleVersionInput,
  RuleVersionStatus,
  SubmitRuleVersionInput,
  UpdateRuleVersionInput,
} from '@hrm/shared-types';

export class CreateRuleVersionDto implements CreateRuleVersionInput {
  @ApiProperty({ description: 'Rule category kind, e.g. tax, leave, ot, public_holiday' })
  @IsString()
  @IsNotEmpty()
  ruleType: string;

  @ApiPropertyOptional({ description: 'Optional State/Province subdivision ID for regional scope' })
  @IsOptional()
  @IsUUID()
  stateProvinceId?: string | null;

  @ApiProperty({ description: 'Effective start date (YYYY-MM-DD)' })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveFrom must be in YYYY-MM-DD format',
  })
  effectiveFrom: string;

  @ApiPropertyOptional({ description: 'Effective end date (YYYY-MM-DD) or null for open-ended' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveTo must be in YYYY-MM-DD format',
  })
  effectiveTo?: string | null;

  @ApiProperty({ description: 'Mandatory source legislation / statutory document URL or document name + date' })
  @IsString()
  @IsNotEmpty({ message: 'sourceReference is mandatory (URL or statutory document name and date)' })
  sourceReference: string;

  @ApiProperty({ description: 'Mandatory change note detailing why this version was authored' })
  @IsString()
  @IsNotEmpty({ message: 'changeNote is mandatory' })
  changeNote: string;

  @ApiProperty({ description: 'JSON rule configuration payload' })
  @IsObject()
  payload: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Initial status',
    enum: ['draft', 'pending_approval', 'published'],
    default: 'draft',
  })
  @IsOptional()
  @IsEnum(['draft', 'pending_approval', 'published'])
  status?: RuleVersionStatus;
}

export class UpdateRuleVersionDto implements UpdateRuleVersionInput {
  @ApiPropertyOptional({ description: 'Effective start date (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'effectiveFrom must be in YYYY-MM-DD format',
  })
  effectiveFrom?: string;

  @ApiPropertyOptional({ description: 'Effective end date (YYYY-MM-DD) or null' })
  @IsOptional()
  @IsString()
  effectiveTo?: string | null;

  @ApiPropertyOptional({ description: 'Source reference document or URL' })
  @IsOptional()
  @IsString()
  sourceReference?: string;

  @ApiPropertyOptional({ description: 'Change note for this modification' })
  @IsOptional()
  @IsString()
  changeNote?: string;

  @ApiPropertyOptional({ description: 'JSON rule configuration payload' })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Target status transition',
    enum: ['draft', 'pending_approval', 'published', 'superseded'],
  })
  @IsOptional()
  @IsEnum(['draft', 'pending_approval', 'published', 'superseded'])
  status?: RuleVersionStatus;
}

export class QueryRuleVersionsDto {
  @ApiPropertyOptional({ description: 'Filter by rule category' })
  @IsOptional()
  @IsString()
  ruleType?: string;

  @ApiPropertyOptional({ description: 'Filter by state/province subdivision ID' })
  @IsOptional()
  @IsString()
  stateProvinceId?: string;

  @ApiPropertyOptional({
    description: 'Filter by version status',
    enum: ['draft', 'pending_approval', 'published', 'superseded', 'rejected'],
  })
  @IsOptional()
  @IsEnum(['draft', 'pending_approval', 'published', 'superseded', 'rejected'])
  status?: RuleVersionStatus;
}

export class SubmitRuleVersionDto implements SubmitRuleVersionInput {
  @ApiPropertyOptional({ description: 'Optional submission note explaining the change for reviewer' })
  @IsOptional()
  @IsString()
  submissionNote?: string;
}

export class PublishRuleVersionDto implements PublishRuleVersionInput {
  @ApiPropertyOptional({ description: 'Explicit acknowledgment that backdated changes apply and flag payroll for review' })
  @IsOptional()
  confirmBackdated?: boolean;

  @ApiPropertyOptional({ description: 'Reason for retroactive statutory publication' })
  @IsOptional()
  @IsString()
  backdatedReason?: string;

  @ApiPropertyOptional({ description: 'Approval note from Platform Owner / Admin' })
  @IsOptional()
  @IsString()
  approvalNote?: string;
}

export class RejectRuleVersionDto implements RejectRuleVersionInput {
  @ApiProperty({ description: 'Mandatory reason for rejecting the rule version' })
  @IsString()
  @IsNotEmpty({ message: 'A rejection reason is mandatory' })
  reason: string;
}

export class QueryPendingApprovalsDto {
  @ApiPropertyOptional({ description: 'Filter pending versions by country ID' })
  @IsOptional()
  @IsUUID()
  countryId?: string;

  @ApiPropertyOptional({ description: 'Filter pending versions by rule category' })
  @IsOptional()
  @IsString()
  ruleType?: string;
}

export class QueryRuleVersionTimelineDto {
  @ApiProperty({ description: 'Rule category to generate timeline for (e.g. tax, leave, public_holiday)' })
  @IsString()
  @IsNotEmpty()
  ruleType: string;

  @ApiPropertyOptional({ description: 'Optional State/Province subdivision ID' })
  @IsOptional()
  @IsString()
  stateProvinceId?: string;
}
