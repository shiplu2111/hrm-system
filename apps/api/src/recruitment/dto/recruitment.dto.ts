import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  ApplicationStage,
  CandidateSource,
  InterviewRecommendation,
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

export class HireApplicationDto {
  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;
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

  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  headcount?: number;
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
  location?: string;

  @IsOptional()
  @IsString()
  meetingUrl?: string;

  @IsOptional()
  @IsUUID()
  interviewerEmployeeId?: string;
}

export class CompleteInterviewRoundDto {
  @Type(() => Number)
  @Min(0)
  @Max(5)
  score!: number;

  @IsEnum(InterviewRecommendation)
  recommendation!: InterviewRecommendation;

  @IsOptional()
  @IsString()
  feedback?: string;
}

export class SkipInterviewRoundDto {
  @IsOptional()
  @IsString()
  feedback?: string;
}

export class OfferLetterActionDto {
  @IsOptional()
  @IsString()
  comment?: string;
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
