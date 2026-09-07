import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
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
  requiresWorkflowApproval?: boolean;
}

export class UpdatePerformanceReviewCycleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

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

export class SaveSelfAssessmentDto {
  @IsOptional()
  competencies?: Array<Record<string, unknown>>;

  @IsOptional()
  kpiAssessments?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsString()
  overallSelfComment?: string | null;
}

export class SaveManagerAssessmentDto {
  @IsOptional()
  competencies?: Array<Record<string, unknown>>;

  @IsOptional()
  kpiAssessments?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsString()
  overallManagerComment?: string | null;
}

export class WorkflowReviewActionDto {
  @IsOptional()
  @IsString()
  comment?: string | null;
}

const PERFORMANCE_360_RELATIONSHIPS = ['peer', 'direct_report', 'cross_functional'] as const;
const OVERALL_RATING_LABELS = [
  'outstanding',
  'exceeds_expectations',
  'meets_expectations',
  'needs_improvement',
] as const;

export class Invite360ReviewerItemDto {
  @IsUUID()
  employeeId!: string;

  @IsIn([...PERFORMANCE_360_RELATIONSHIPS])
  relationship!: (typeof PERFORMANCE_360_RELATIONSHIPS)[number];
}

export class Invite360ReviewersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => Invite360ReviewerItemDto)
  reviewers!: Invite360ReviewerItemDto[];
}

export class Submit360FeedbackDto {
  @IsOptional()
  @IsArray()
  competencyRatings?: Array<{ key: string; rating: number }>;

  @IsOptional()
  @IsString()
  comment?: string | null;
}

export class SaveReviewOutcomeDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  overallRating?: number;

  @IsOptional()
  @IsIn([...OVERALL_RATING_LABELS])
  overallRatingLabel?: (typeof OVERALL_RATING_LABELS)[number];

  @IsOptional()
  promotionRecommended?: boolean;

  @IsOptional()
  @IsUUID()
  recommendedDesignationId?: string | null;

  @IsOptional()
  @IsString()
  promotionRecommendationNote?: string | null;
}

export class ExecutePromotionFromReviewDto {
  @IsDateString()
  effectiveDate!: string;

  @IsOptional()
  @IsUUID()
  newDepartmentId?: string;
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
  @IsNumber()
  @Min(0)
  defaultTargetValue?: number;

  @IsOptional()
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
  @IsUUID('4', { each: true })
  employeeIds!: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetValue?: number;

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
  @IsNumber()
  @Min(0)
  @Max(100)
  weightPercent?: number;

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
  activeOnly?: boolean;
}
