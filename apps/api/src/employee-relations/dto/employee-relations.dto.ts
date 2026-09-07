import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const CASE_TYPES = ['grievance', 'complaint', 'disciplinary', 'investigation'] as const;
const CASE_STATUSES = ['open', 'investigating', 'resolved', 'closed'] as const;
const CASE_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
const CASE_OUTCOMES = [
  'not_determined',
  'substantiated',
  'partially_substantiated',
  'unsubstantiated',
  'resolved_informally',
] as const;
const PARTY_ROLES = [
  'reporting_employee',
  'subject_employee',
  'witness',
  'investigator',
  'other',
] as const;
const ACTION_TYPES = [
  'verbal_warning',
  'written_warning',
  'final_warning',
  'suspension',
  'termination',
  'other',
] as const;
const REVEAL_FIELDS = [
  'details',
  'resolutionNotes',
  'noteContent',
  'actionDetails',
  'investigationContent',
] as const;
const INVESTIGATION_RECORD_TYPES = [
  'interview',
  'evidence_review',
  'finding',
  'legal_review',
  'other',
] as const;

export class ListHrCasesQueryDto {
  @IsOptional()
  @IsIn([...CASE_TYPES])
  caseType?: (typeof CASE_TYPES)[number];

  @IsOptional()
  @IsIn([...CASE_STATUSES])
  status?: (typeof CASE_STATUSES)[number];

  @IsOptional()
  @IsIn([...CASE_PRIORITIES])
  priority?: (typeof CASE_PRIORITIES)[number];

  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateHrCasePartyDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsIn([...PARTY_ROLES])
  partyRole!: (typeof PARTY_ROLES)[number];

  @IsOptional()
  @IsString()
  anonymizedLabel?: string;

  @IsOptional()
  @IsBoolean()
  isAnonymized?: boolean;
}

export class CreateHrCaseDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsIn([...CASE_TYPES])
  caseType!: (typeof CASE_TYPES)[number];

  @IsOptional()
  @IsIn([...CASE_PRIORITIES])
  priority?: (typeof CASE_PRIORITIES)[number];

  @IsOptional()
  @IsUUID()
  subjectEmployeeId?: string;

  @IsOptional()
  @IsUUID()
  reportingEmployeeId?: string;

  @IsOptional()
  @IsUUID()
  assignedOfficerEmployeeId?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsBoolean()
  isRestricted?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateHrCasePartyDto)
  parties?: CreateHrCasePartyDto[];
}

export class UpdateHrCaseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsIn([...CASE_PRIORITIES])
  priority?: (typeof CASE_PRIORITIES)[number];

  @IsOptional()
  @IsIn([...CASE_OUTCOMES])
  outcome?: (typeof CASE_OUTCOMES)[number];

  @IsOptional()
  @IsUUID()
  assignedOfficerEmployeeId?: string | null;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @IsOptional()
  @IsBoolean()
  isRestricted?: boolean;
}

export class CreateHrCaseNoteDto {
  @IsString()
  @MinLength(1)
  content!: string;
}

export class CreateDisciplinaryActionDto {
  @IsIn([...ACTION_TYPES])
  actionType!: (typeof ACTION_TYPES)[number];

  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsString()
  letterReference?: string;

  @IsOptional()
  @IsString()
  details?: string;
}

export class TransitionHrCaseStatusDto {
  @IsIn([...CASE_STATUSES])
  status!: (typeof CASE_STATUSES)[number];

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateInvestigationRecordDto {
  @IsIn([...INVESTIGATION_RECORD_TYPES])
  recordType!: (typeof INVESTIGATION_RECORD_TYPES)[number];

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  content!: string;

  @IsOptional()
  @IsDateString()
  recordedAt?: string;
}

export class RevealHrCaseFieldDto {
  @IsIn([...REVEAL_FIELDS])
  field!: (typeof REVEAL_FIELDS)[number];

  @IsOptional()
  @IsUUID()
  noteId?: string;

  @IsOptional()
  @IsUUID()
  actionId?: string;

  @IsOptional()
  @IsUUID()
  investigationRecordId?: string;
}

export class UpsertHrCasePartiesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateHrCasePartyDto)
  parties!: CreateHrCasePartyDto[];
}
