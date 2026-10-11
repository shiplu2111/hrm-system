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
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MAX_ENROLMENTS_PER_REQUEST } from '../training.rules';

/** Query strings arrive as text; `?activeOnly=true` must become a boolean before validation. */
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
const MARK_STATUSES = ['registered', 'attended', 'completed', 'no_show'] as const;

const DELIVERY_MODES = ['self_paced', 'instructor_led', 'virtual', 'blended'] as const;
const COURSE_STATUSES = ['draft', 'active', 'archived'] as const;
const SESSION_STATUSES = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;
const ATTENDANCE_STATUSES = [
  'registered',
  'attended',
  'completed',
  'no_show',
  'cancelled',
] as const;
const COST_CATEGORIES = [
  'venue',
  'instructor',
  'materials',
  'travel',
  'catering',
  'technology',
  'other',
] as const;

export class ListTrainingCoursesQueryDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn([...COURSE_STATUSES])
  status?: (typeof COURSE_STATUSES)[number];

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activeOnly?: boolean;
}

export class CreateTrainingCourseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  category?: string;

  @IsOptional()
  @IsIn([...DELIVERY_MODES])
  deliveryMode?: (typeof DELIVERY_MODES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  durationMinutes?: number;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsIn([...COURSE_STATUSES])
  status?: (typeof COURSE_STATUSES)[number];
}

export class UpdateTrainingCourseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(60)
  category?: string | null;

  @IsOptional()
  @IsIn([...DELIVERY_MODES])
  deliveryMode?: (typeof DELIVERY_MODES)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(100_000)
  durationMinutes?: number | null;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsIn([...COURSE_STATUSES])
  status?: (typeof COURSE_STATUSES)[number];
}

export class ListTrainingSessionsQueryDto {
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsIn([...SESSION_STATUSES])
  status?: (typeof SESSION_STATUSES)[number];
}

export class CreateTrainingSessionDto {
  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsDateString()
  scheduledStart!: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  instructor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateTrainingSessionDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(150)
  title?: string | null;

  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  scheduledEnd?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  location?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  instructor?: string | null;

  @IsOptional()
  @IsIn([...SESSION_STATUSES])
  status?: (typeof SESSION_STATUSES)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class CreateTrainingSessionCostDto {
  @IsIn([...COST_CATEGORIES])
  category!: (typeof COST_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000_000)
  amount!: number;

  /** Must match the company currency when given. */
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}

export class UpdateTrainingSessionCostDto {
  @IsOptional()
  @IsIn([...COST_CATEGORIES])
  category?: (typeof COST_CATEGORIES)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  description?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000_000)
  amount?: number;
}

export class ListTrainingAttendanceQueryDto {
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsIn([...ATTENDANCE_STATUSES])
  status?: (typeof ATTENDANCE_STATUSES)[number];
}

export class RegisterTrainingAttendanceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ENROLMENTS_PER_REQUEST)
  @IsUUID('4', { each: true })
  employeeIds!: string[];
}

export class UpdateTrainingAttendanceDto {
  @IsOptional()
  @IsIn([...MARK_STATUSES])
  status?: (typeof MARK_STATUSES)[number];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class MarkTrainingAttendanceDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  attendanceIds!: string[];

  @IsIn([...MARK_STATUSES])
  status!: (typeof MARK_STATUSES)[number];
}

export class BulkAssignTrainingDto {
  @IsUUID()
  sessionId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  employeeIds!: string[];
}

export class BulkAssignTrainingBodyDto {
  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @ValidateNested()
  @Type(() => RegisterTrainingAttendanceDto)
  registration!: RegisterTrainingAttendanceDto;
}

const SKILL_LEVELS = ['none', 'beginner', 'intermediate', 'advanced', 'expert'] as const;
const CERTIFICATION_STATUSES = ['active', 'expired', 'revoked'] as const;

export class ListSkillsQueryDto {
  @IsOptional()
  @IsString()
  category?: string;
}

export class CreateSkillDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateSkillDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ListEmployeeSkillsQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  skillId?: string;

  @IsOptional()
  @IsIn([...SKILL_LEVELS])
  level?: (typeof SKILL_LEVELS)[number];
}

export class UpsertEmployeeSkillDto {
  @IsUUID()
  employeeId!: string;

  @IsUUID()
  skillId!: string;

  @IsIn([...SKILL_LEVELS])
  level!: (typeof SKILL_LEVELS)[number];

  @IsOptional()
  @IsDateString()
  assessedAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEmployeeSkillDto {
  @IsOptional()
  @IsIn([...SKILL_LEVELS])
  level?: (typeof SKILL_LEVELS)[number];

  @IsOptional()
  @IsDateString()
  assessedAt?: string | null;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListCertificationsQueryDto {
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsIn([...CERTIFICATION_STATUSES])
  status?: (typeof CERTIFICATION_STATUSES)[number];

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  expiringOnly?: boolean;
}

export class CreateEmployeeCertificationDto {
  @IsUUID()
  employeeId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  certificateNumber?: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsIn([...CERTIFICATION_STATUSES])
  status?: (typeof CERTIFICATION_STATUSES)[number];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateEmployeeCertificationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string | null;

  @IsOptional()
  @IsString()
  issuer?: string;

  @IsOptional()
  @IsString()
  certificateNumber?: string;

  @IsOptional()
  @IsDateString()
  issuedAt?: string | null;

  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;

  @IsOptional()
  @IsIn([...CERTIFICATION_STATUSES])
  status?: (typeof CERTIFICATION_STATUSES)[number];

  @IsOptional()
  @IsString()
  notes?: string;
}
