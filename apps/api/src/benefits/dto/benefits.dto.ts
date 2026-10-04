import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

const MONEY = { maxDecimalPlaces: 2 } as const;
const MONEY_MESSAGE = { message: '$property must be an amount with at most 2 decimal places' };
const MAX_MONTHLY_AMOUNT = 1_000_000;

export const PLAN_CATEGORIES = [
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

export const DEPENDENT_RELATIONSHIPS = [
  'spouse',
  'child',
  'parent',
  'domestic_partner',
  'other',
] as const;

export type DependentRelationship = (typeof DEPENDENT_RELATIONSHIPS)[number];

export class CreateBenefitPlanDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Plan name is required' })
  @MaxLength(120)
  name!: string;

  @IsIn([...PLAN_CATEGORIES])
  category!: (typeof PLAN_CATEGORIES)[number];

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Provider is required' })
  @MaxLength(120)
  provider!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Plan tier is required' })
  @MaxLength(40)
  planTier!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  employerContributionLabel?: string | null;

  /** Monthly amount the employer pays per enrolled employee. `null` clears it. */
  @IsOptional()
  @IsNumber(MONEY, MONEY_MESSAGE)
  @Min(0)
  @Max(MAX_MONTHLY_AMOUNT)
  employerContributionAmount?: number | null;

  /** Monthly amount the employee pays. */
  @IsOptional()
  @IsNumber(MONEY, MONEY_MESSAGE)
  @Min(0)
  @Max(MAX_MONTHLY_AMOUNT)
  employeeContributionAmount?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  employeeContributionLabel?: string | null;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  coverageLimitLabel?: string | null;

  @IsOptional()
  @IsBoolean()
  allowsDependents?: boolean;

  /** `null` means no maximum. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxDependents?: number | null;

  /** Empty means any relationship is eligible. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn([...DEPENDENT_RELATIONSHIPS], { each: true })
  eligibleRelationships?: DependentRelationship[];

  /** Extra monthly employee cost per covered dependent. `null` clears it. */
  @IsOptional()
  @IsNumber(MONEY, MONEY_MESSAGE)
  @Min(0)
  @Max(MAX_MONTHLY_AMOUNT)
  dependentContributionAmount?: number | null;

  @IsOptional()
  @IsIn([...PLAN_STATUSES])
  status?: (typeof PLAN_STATUSES)[number];
}

export class UpdateBenefitPlanDto extends PartialType(CreateBenefitPlanDto) {}

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
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Dependent name is required' })
  @MaxLength(120)
  fullName!: string;

  @IsIn([...DEPENDENT_RELATIONSHIPS])
  relationship!: DependentRelationship;

  @IsOptional()
  @IsDateString({ strict: true })
  dateOfBirth?: string;

  /** Life insurance only: the beneficiary's share of the payout. */
  @IsOptional()
  @IsNumber(MONEY, MONEY_MESSAGE)
  @Min(0.01)
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

  @IsDateString({ strict: true })
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString({ strict: true })
  effectiveTo?: string;

  @IsOptional()
  @IsNumber(MONEY, MONEY_MESSAGE)
  @Min(0)
  @Max(MAX_MONTHLY_AMOUNT)
  employeeContributionAmount?: number;

  @IsOptional()
  @IsNumber(MONEY, MONEY_MESSAGE)
  @Min(0)
  @Max(100)
  beneficiarySharePercent?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
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

export class CancelBenefitEnrollmentDto {
  /** Last day of coverage. Defaults to today. */
  @IsOptional()
  @IsDateString({ strict: true })
  endDate?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
