import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { INTERVIEW_RATING_MAX, INTERVIEW_RATING_MIN } from '@hrm/shared-types';
import {
  ApplicationStage,
  CandidateSource,
  EmploymentStatus,
  InterviewRecommendation,
  InterviewRoundStatus,
  JobPostingStatus,
  JobRequisitionStatus,
  OfferLetterStatus,
  OfferLetterTemplate,
} from '@prisma/client';

export class RequisitionActionDto {
  @IsOptional()
  @IsString()
  comment?: string;
}

/** Add Employee form values; anything omitted falls back to the accepted offer and candidate. */
export class HireApplicationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  employeeNumber?: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsEnum(EmploymentStatus)
  employmentStatus?: EmploymentStatus;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  designationId?: string | null;

  @IsOptional()
  @IsUUID()
  employmentTypeId?: string | null;

  @IsOptional()
  @IsUUID()
  workLocationId?: string | null;

  @IsOptional()
  @IsUUID()
  managerId?: string | null;

  @IsOptional()
  @IsUUID()
  costCentreId?: string | null;

  @IsOptional()
  @IsDateString()
  probationEndDate?: string | null;

  @IsOptional()
  @IsDateString()
  confirmationDate?: string | null;

  @IsOptional()
  @IsObject()
  personalInfo?: Record<string, unknown>;
}

export class CreateJobRequisitionDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  designationId?: string;

  @IsOptional()
  @IsUUID()
  jobLevelId?: string;

  @IsOptional()
  @IsUUID()
  employmentTypeId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsString()
  @MinLength(1)
  description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  headcount?: number;

  @IsOptional()
  @IsUUID()
  requestedByEmployeeId?: string;
}

export class UpdateJobRequisitionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  designationId?: string | null;

  @IsOptional()
  @IsUUID()
  jobLevelId?: string | null;

  @IsOptional()
  @IsUUID()
  employmentTypeId?: string | null;

  @IsOptional()
  @IsUUID()
  locationId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  headcount?: number;

  @IsOptional()
  @IsUUID()
  requestedByEmployeeId?: string | null;
}

export class ListJobRequisitionsQueryDto {
  @IsOptional()
  @IsEnum(JobRequisitionStatus)
  status?: JobRequisitionStatus;
}

export class CreateJobPostingDto {
  @IsUUID()
  requisitionId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;
}

export class UpdateJobPostingDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @IsEnum(JobPostingStatus)
  status?: JobPostingStatus;
}

export class ListJobPostingsQueryDto {
  @IsOptional()
  @IsEnum(JobPostingStatus)
  status?: JobPostingStatus;
}

export class CreateCandidateDto {
  @IsString()
  @MinLength(1)
  firstName!: string;

  @IsString()
  @MinLength(1)
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(CandidateSource)
  source?: CandidateSource;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearsExperience?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCandidateDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string | null;

  @IsOptional()
  @IsEnum(CandidateSource)
  source?: CandidateSource;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  yearsExperience?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class CreateCandidateNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body!: string;

  @IsOptional()
  @IsUUID()
  applicationId?: string;
}

export class UploadCandidateDocumentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class ListCandidatesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateJobApplicationDto {
  @IsUUID()
  candidateId!: string;

  @IsUUID()
  requisitionId!: string;

  @IsOptional()
  @IsUUID()
  postingId?: string;

  @IsOptional()
  @IsEnum(ApplicationStage)
  stage?: ApplicationStage;

  @IsOptional()
  @IsString()
  coverLetter?: string;
}

export class UpdateApplicationStageDto {
  @IsEnum(ApplicationStage)
  stage!: ApplicationStage;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  rating?: number;
}

export class ListJobApplicationsQueryDto {
  @IsOptional()
  @IsUUID()
  requisitionId?: string;

  @IsOptional()
  @IsUUID()
  candidateId?: string;

  @IsOptional()
  @IsEnum(ApplicationStage)
  stage?: ApplicationStage;
}

export class ScheduleInterviewRoundDto {
  @IsDateString()
  scheduledStartAt!: string;

  @IsOptional()
  @IsDateString()
  scheduledEndAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingUrl?: string;

  @IsOptional()
  @IsUUID()
  interviewerEmployeeId?: string;

  @IsOptional()
  @IsBoolean()
  allowConflict?: boolean;
}

export class InterviewScorecardRatingDto {
  @IsString()
  @MaxLength(64)
  key!: string;

  @Type(() => Number)
  @IsInt()
  @Min(INTERVIEW_RATING_MIN)
  @Max(INTERVIEW_RATING_MAX)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class CompleteInterviewRoundDto {
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  score?: number;

  @IsEnum(InterviewRecommendation)
  recommendation!: InterviewRecommendation;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => InterviewScorecardRatingDto)
  ratings?: InterviewScorecardRatingDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  strengths?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  concerns?: string;
}

export class CancelInterviewRoundDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ListInterviewScheduleQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(InterviewRoundStatus)
  status?: InterviewRoundStatus;

  @IsOptional()
  @IsUUID()
  interviewerEmployeeId?: string;

  @IsOptional()
  @IsUUID()
  requisitionId?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  needsScheduling?: 'true' | 'false';
}

export class ListMyInterviewsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(InterviewRoundStatus)
  status?: InterviewRoundStatus;
}

export class SkipInterviewRoundDto {
  @IsOptional()
  @IsString()
  feedback?: string;
}

export class OfferLetterActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class SendOfferLetterDto {
  /** `manual` records the offer as sent when it was handed over outside the system. */
  @IsOptional()
  @IsIn(['email', 'manual'])
  deliveryMethod?: 'email' | 'manual';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class DeclineOfferLetterDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class UpsertOfferLetterDto {
  @IsOptional()
  @IsEnum(OfferLetterTemplate)
  template?: OfferLetterTemplate;

  @IsOptional()
  @IsString()
  @MinLength(1)
  jobTitle?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  designationId?: string | null;

  @IsOptional()
  @IsUUID()
  employmentTypeId?: string | null;

  @IsOptional()
  @IsUUID()
  workLocationId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  annualSalary?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsString()
  reportingTo?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  signingBonus?: number;

  @IsOptional()
  @IsString()
  equityNotes?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  probationMonths?: number;

  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;

  @IsOptional()
  @IsString()
  additionalTerms?: string;
}
