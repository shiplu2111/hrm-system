import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

const CYCLE_STATUSES = ['draft', 'active', 'closed', 'archived'] as const;
const MEASUREMENT_PERIODS = [
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'custom',
] as const;
const KPI_UNITS = [
  'percentage',
  'count',
  'currency',
  'hours',
  'days',
  'score',
  'other',
] as const;
const KPI_DIRECTIONS = ['higher_is_better', 'lower_is_better'] as const;
const ASSIGNMENT_STATUSES = ['draft', 'active', 'completed', 'cancelled'] as const;

export class CreatePerformanceReviewCycleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsIn([...MEASUREMENT_PERIODS])
  measurementPeriod!: (typeof MEASUREMENT_PERIODS)[number];

  @IsDateString()
  reviewDueDate!: string;

  @IsOptional()
  @IsIn([...CYCLE_STATUSES])
  status?: (typeof CYCLE_STATUSES)[number];

  @IsOptional()
  @IsBoolean()
  requiresWorkflowApproval?: boolean;
}

export class UpdatePerformanceReviewCycleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsDateString()
  periodStart?: string;

  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @IsOptional()
  @IsIn([...MEASUREMENT_PERIODS])
  measurementPeriod?: (typeof MEASUREMENT_PERIODS)[number];

  @IsOptional()
  @IsDateString()
  reviewDueDate?: string;

  @IsOptional()
  @IsIn([...CYCLE_STATUSES])
  status?: (typeof CYCLE_STATUSES)[number];

  @IsOptional()
  @IsBoolean()
  requiresWorkflowApproval?: boolean;
}

export class SetReviewCycleParticipantsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  employeeIds!: string[];
}

export class ListEmployeePerformanceReviewsQueryDto {
  @IsOptional()
  @IsUUID()
  reviewCycleId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  managerEmployeeId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CompetencyRatingInputDto {
  @IsString()
  @MinLength(1)
  key!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}

export class KpiRatingInputDto {
  @IsUUID()
  kpiAssignmentId!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}

export class SaveSelfAssessmentDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CompetencyRatingInputDto)
  competencies?: CompetencyRatingInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => KpiRatingInputDto)
  kpiAssessments?: KpiRatingInputDto[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  overallSelfComment?: string | null;
}

export class SaveManagerAssessmentDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CompetencyRatingInputDto)
  competencies?: CompetencyRatingInputDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => KpiRatingInputDto)
  kpiAssessments?: KpiRatingInputDto[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  overallManagerComment?: string | null;
}

export class WorkflowReviewActionDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1000)
  comment?: string | null;
}

const PERFORMANCE_360_RELATIONSHIPS = ['peer', 'direct_report', 'cross_functional'] as const;

export class Invite360ReviewerItemDto {
  @IsUUID()
  employeeId!: string;

  @IsIn([...PERFORMANCE_360_RELATIONSHIPS])
  relationship!: (typeof PERFORMANCE_360_RELATIONSHIPS)[number];
}

export class Invite360ReviewersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => Invite360ReviewerItemDto)
  reviewers!: Invite360ReviewerItemDto[];
}

export class Feedback360RatingInputDto {
  @IsString()
  @MaxLength(50)
  key!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number | null;
}

export class Save360FeedbackDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => Feedback360RatingInputDto)
  competencyRatings?: Feedback360RatingInputDto[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  comment?: string | null;
}

/** Calibrates the overall rating; null clears the calibration and goes back to the calculated rating. */
export class SaveReviewOutcomeDto {
  @ValidateIf((_, value) => value !== null)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(5)
  overallRating!: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class SavePromotionRecommendationDto {
  @IsBoolean()
  promotionRecommended!: boolean;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  recommendedDesignationId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  promotionRecommendationNote?: string | null;
}

export class ExecutePromotionFromReviewDto {
  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsUUID()
  newDesignationId?: string;

  @IsOptional()
  @IsUUID()
  newDepartmentId?: string;

  @IsOptional()
  @IsUUID()
  newManagerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateKpiDefinitionDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsIn([...KPI_UNITS])
  unit!: (typeof KPI_UNITS)[number];

  @IsOptional()
  @IsIn([...KPI_DIRECTIONS])
  direction?: (typeof KPI_DIRECTIONS)[number];

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultTargetValue?: number;
}

export class UpdateKpiDefinitionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn([...KPI_UNITS])
  unit?: (typeof KPI_UNITS)[number];

  @IsOptional()
  @IsIn([...KPI_DIRECTIONS])
  direction?: (typeof KPI_DIRECTIONS)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  defaultTargetValue?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateEmployeeKpiAssignmentDto {
  @IsUUID()
  reviewCycleId!: string;

  @IsOptional()
  @IsUUID()
  kpiDefinitionId?: string;

  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  targetValue!: number;

  @IsOptional()
  @IsIn([...KPI_UNITS])
  unit?: (typeof KPI_UNITS)[number];

  @IsOptional()
  @IsIn([...KPI_DIRECTIONS])
  direction?: (typeof KPI_DIRECTIONS)[number];

  @IsOptional()
  @IsIn([...MEASUREMENT_PERIODS])
  measurementPeriod?: (typeof MEASUREMENT_PERIODS)[number];

  @IsOptional()
  @IsDateString()
  measurementPeriodStart?: string;

  @IsOptional()
  @IsDateString()
  measurementPeriodEnd?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentValue?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn([...ASSIGNMENT_STATUSES])
  status?: (typeof ASSIGNMENT_STATUSES)[number];
}

export class BulkAssignKpiDto {
  @IsUUID()
  reviewCycleId!: string;

  @IsUUID()
  kpiDefinitionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  employeeIds!: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetValue?: number;

  @IsOptional()
  @IsIn([...MEASUREMENT_PERIODS])
  measurementPeriod?: (typeof MEASUREMENT_PERIODS)[number];

  /** Create one goal per window of `measurementPeriod` across the whole cycle. */
  @IsOptional()
  @IsBoolean()
  everyWindow?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  measurementPeriodStart?: string;

  @IsOptional()
  @IsDateString()
  measurementPeriodEnd?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent?: number;
}

export class UpdateEmployeeKpiAssignmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetValue?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentValue?: number;

  @IsOptional()
  @IsIn([...MEASUREMENT_PERIODS])
  measurementPeriod?: (typeof MEASUREMENT_PERIODS)[number];

  @IsOptional()
  @IsDateString()
  measurementPeriodStart?: string;

  @IsOptional()
  @IsDateString()
  measurementPeriodEnd?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent?: number | null;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsIn([...ASSIGNMENT_STATUSES])
  status?: (typeof ASSIGNMENT_STATUSES)[number];
}

export class ListEmployeeKpiAssignmentsQueryDto {
  @IsOptional()
  @IsUUID()
  reviewCycleId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  kpiDefinitionId?: string;

  @IsOptional()
  @IsIn([...ASSIGNMENT_STATUSES])
  status?: (typeof ASSIGNMENT_STATUSES)[number];
}

export class ListKpiDefinitionsQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  activeOnly?: boolean;
}
