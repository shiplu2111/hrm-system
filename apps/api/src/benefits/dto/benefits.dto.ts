import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const PLAN_CATEGORIES = [
  'health_insurance',
  'life_insurance',
  'dental_vision',
  'wellness',
  'other',
] as const;

const PLAN_STATUSES = ['draft', 'active', 'inactive'] as const;

const ENROLLMENT_TYPES = [
  'open_enrollment',
  'new_hire',
  'life_event',
  'admin',
] as const;

const DEPENDENT_RELATIONSHIPS = [
  'spouse',
  'child',
  'parent',
  'domestic_partner',
  'other',
] as const;

export class CreateBenefitPlanDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsIn([...PLAN_CATEGORIES])
  category!: (typeof PLAN_CATEGORIES)[number];

  @IsString()
  @MinLength(1)
  provider!: string;

  @IsString()
  @MinLength(1)
  planTier!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  employerContributionLabel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  employerContributionAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  employeeContributionAmount?: number;

  @IsOptional()
  @IsString()
  employeeContributionLabel?: string;

  @IsOptional()
  @IsString()
  coverageLimitLabel?: string;

  @IsOptional()
  @IsIn([...PLAN_STATUSES])
  status?: (typeof PLAN_STATUSES)[number];
}

export class UpdateBenefitPlanDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsIn([...PLAN_CATEGORIES])
  category?: (typeof PLAN_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MinLength(1)
  provider?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  planTier?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  employerContributionLabel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  employerContributionAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  employeeContributionAmount?: number;

  @IsOptional()
  @IsString()
  employeeContributionLabel?: string;

  @IsOptional()
  @IsString()
  coverageLimitLabel?: string;

  @IsOptional()
  @IsIn([...PLAN_STATUSES])
  status?: (typeof PLAN_STATUSES)[number];
}

export class CreateBenefitOpenEnrollmentDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  planIds!: string[];
}

export class BenefitEnrollmentDependentDto {
  @IsString()
  @MinLength(1)
  fullName!: string;

  @IsIn([...DEPENDENT_RELATIONSHIPS])
  relationship!: (typeof DEPENDENT_RELATIONSHIPS)[number];

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  beneficiarySharePercent?: number;
}

export class CreateBenefitEnrollmentDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  benefitPlanId!: string;

  @IsOptional()
  @IsUUID()
  openEnrollmentPeriodId?: string;

  @IsIn([...ENROLLMENT_TYPES])
  enrollmentType!: (typeof ENROLLMENT_TYPES)[number];

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  employeeContributionAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  beneficiarySharePercent?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BenefitEnrollmentDependentDto)
  dependents?: BenefitEnrollmentDependentDto[];
}

export class ListBenefitEnrollmentsQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  benefitPlanId?: string;

  @IsOptional()
  @IsIn(['pending', 'active', 'cancelled', 'terminated'])
  status?: 'pending' | 'active' | 'cancelled' | 'terminated';
}

export class AddBenefitEnrollmentDependentDto extends BenefitEnrollmentDependentDto {}
