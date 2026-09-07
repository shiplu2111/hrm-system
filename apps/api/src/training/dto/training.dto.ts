import { Type } from 'class-transformer';
import {
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
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

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
  @IsBoolean()
  activeOnly?: boolean;
}

export class CreateTrainingCourseDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn([...DELIVERY_MODES])
  deliveryMode?: (typeof DELIVERY_MODES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
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
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn([...DELIVERY_MODES])
  deliveryMode?: (typeof DELIVERY_MODES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

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
  title?: string;

  @IsDateString()
  scheduledStart!: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  instructor?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTrainingSessionDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  instructor?: string;

  @IsOptional()
  @IsIn([...SESSION_STATUSES])
  status?: (typeof SESSION_STATUSES)[number];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateTrainingSessionCostDto {
  @IsIn([...COST_CATEGORIES])
  category!: (typeof COST_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;
}

export class UpdateTrainingSessionCostDto {
  @IsOptional()
  @IsIn([...COST_CATEGORIES])
  category?: (typeof COST_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  currency?: string;
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
  @IsUUID('4', { each: true })
  employeeIds!: string[];
}

export class UpdateTrainingAttendanceDto {
  @IsOptional()
  @IsIn([...ATTENDANCE_STATUSES])
  status?: (typeof ATTENDANCE_STATUSES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsString()
  notes?: string;
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
