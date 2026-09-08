import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

const INCIDENT_TYPES = [
  'near_miss',
  'injury',
  'first_aid',
  'slip_trip',
  'equipment_damage',
  'environmental',
  'other',
] as const;

const INCIDENT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

const INCIDENT_STATUSES = [
  'reported',
  'under_investigation',
  'resolved',
  'closed',
] as const;

const PARTY_ROLES = ['involved', 'witness', 'injured'] as const;

const MEDICAL_ATTENTION = ['none', 'first_aid', 'clinic', 'hospital'] as const;

const COMPLIANCE_STATUSES = ['pending', 'compliant', 'overdue', 'waived'] as const;

const COMPLIANCE_TYPES = [
  'training',
  'inspection',
  'certification',
  'reporting',
] as const;

const INSPECTION_STATUSES = ['draft', 'completed'] as const;

export class ListIncidentsQueryDto {
  @IsOptional()
  @IsIn([...INCIDENT_STATUSES])
  status?: (typeof INCIDENT_STATUSES)[number];

  @IsOptional()
  @IsIn([...INCIDENT_SEVERITIES])
  severity?: (typeof INCIDENT_SEVERITIES)[number];

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class IncidentPartyDto {
  @IsUUID()
  employeeId!: string;

  @IsIn([...PARTY_ROLES])
  partyRole!: (typeof PARTY_ROLES)[number];
}

export class CreateWorkplaceIncidentDto {
  @IsIn([...INCIDENT_TYPES])
  incidentType!: (typeof INCIDENT_TYPES)[number];

  @IsIn([...INCIDENT_SEVERITIES])
  severity!: (typeof INCIDENT_SEVERITIES)[number];

  @IsString()
  location!: string;

  @IsDateString()
  occurredAt!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsUUID()
  reportedByEmployeeId?: string;

  @IsOptional()
  @IsNumber()
  gpsLat?: number;

  @IsOptional()
  @IsNumber()
  gpsLng?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncidentPartyDto)
  parties?: IncidentPartyDto[];
}

export class CreateEmployeeIncidentDto {
  @IsIn([...INCIDENT_TYPES])
  incidentType!: (typeof INCIDENT_TYPES)[number];

  @IsIn([...INCIDENT_SEVERITIES])
  severity!: (typeof INCIDENT_SEVERITIES)[number];

  @IsString()
  location!: string;

  @IsDateString()
  occurredAt!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsNumber()
  gpsLat?: number;

  @IsOptional()
  @IsNumber()
  gpsLng?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IncidentPartyDto)
  parties?: IncidentPartyDto[];
}

export class UpdateWorkplaceIncidentDto {
  @IsOptional()
  @IsIn([...INCIDENT_STATUSES])
  status?: (typeof INCIDENT_STATUSES)[number];

  @IsOptional()
  @IsString()
  investigationNotes?: string;

  @IsOptional()
  @IsBoolean()
  regulatorReportSubmitted?: boolean;
}

export class ListInjuryLogQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  incidentId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CreateInjuryLogEntryDto {
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsUUID()
  incidentId?: string;

  @IsString()
  injuryType!: string;

  @IsOptional()
  @IsString()
  bodyPart?: string;

  @IsOptional()
  @IsString()
  treatmentSummary?: string;

  @IsOptional()
  @IsIn([...MEDICAL_ATTENTION])
  medicalAttention?: (typeof MEDICAL_ATTENTION)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  daysLost?: number;

  @IsDateString()
  recordedAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSafetyComplianceDto {
  @IsOptional()
  @IsIn([...COMPLIANCE_STATUSES])
  status?: (typeof COMPLIANCE_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;
}

export class SafetyInspectionItemDto {
  @IsString()
  area!: string;

  @IsString()
  item!: string;

  @IsBoolean()
  passed!: boolean;

  @IsOptional()
  @IsString()
  evidence?: string;
}

export class CreateSafetyInspectionDto {
  @IsString()
  title!: string;

  @IsDateString()
  inspectedAt!: string;

  @IsOptional()
  @IsUUID()
  inspectorEmployeeId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SafetyInspectionItemDto)
  checklistItems!: SafetyInspectionItemDto[];
}

export class CompleteSafetyInspectionDto {
  @IsIn([...INSPECTION_STATUSES])
  status!: (typeof INSPECTION_STATUSES)[number];
}
