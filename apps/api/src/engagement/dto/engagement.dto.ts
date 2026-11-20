import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const ANNOUNCEMENT_STATUSES = ['draft', 'published', 'archived'] as const;
const SURVEY_STATUSES = ['draft', 'published', 'closed'] as const;
const SURVEY_TYPES = ['pulse', 'enps'] as const;
const QUESTION_TYPES = ['multiple_choice', 'rating', 'text', 'enps'] as const;
const KUDOS_TYPES = ['peer', 'manager'] as const;
const KUDOS_MODERATION_FILTERS = ['active', 'removed', 'all'] as const;

export class ListAnnouncementsQueryDto {
  @IsOptional()
  @IsIn([...ANNOUNCEMENT_STATUSES])
  status?: (typeof ANNOUNCEMENT_STATUSES)[number];
}

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;
}

export class UpdateAnnouncementDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsIn([...ANNOUNCEMENT_STATUSES])
  status?: (typeof ANNOUNCEMENT_STATUSES)[number];
}

export class SurveyQuestionDto {
  @IsIn([...QUESTION_TYPES])
  questionType!: (typeof QUESTION_TYPES)[number];

  @IsString()
  @MinLength(1)
  prompt!: string;

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

export class CreateSurveyDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn([...SURVEY_TYPES])
  surveyType?: (typeof SURVEY_TYPES)[number];

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionDto)
  questions!: SurveyQuestionDto[];
}

export class UpdateSurveyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SurveyQuestionDto)
  questions?: SurveyQuestionDto[];
}

export class SubmitSurveyAnswerDto {
  @IsUUID()
  questionId!: string;

  @IsOptional()
  @IsString()
  textValue?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  numericValue?: number;

  @IsOptional()
  @IsString()
  selectedOption?: string;
}

export class SubmitSurveyResponseDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SubmitSurveyAnswerDto)
  answers!: SubmitSurveyAnswerDto[];
}

export class ListSurveysQueryDto {
  @IsOptional()
  @IsIn([...SURVEY_STATUSES])
  status?: (typeof SURVEY_STATUSES)[number];

  @IsOptional()
  @IsIn([...SURVEY_TYPES])
  surveyType?: (typeof SURVEY_TYPES)[number];
}

export class ListKudosQueryDto {
  @IsOptional()
  @IsUUID()
  toEmployeeId?: string;

  @IsOptional()
  @IsUUID()
  fromEmployeeId?: string;

  @IsOptional()
  @IsIn([...KUDOS_TYPES])
  kudosType?: (typeof KUDOS_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ListKudosModerationQueryDto {
  @IsOptional()
  @IsIn([...KUDOS_MODERATION_FILTERS])
  status?: (typeof KUDOS_MODERATION_FILTERS)[number];

  @IsOptional()
  @IsIn([...KUDOS_TYPES])
  kudosType?: (typeof KUDOS_TYPES)[number];

  @IsOptional()
  @IsUUID()
  toEmployeeId?: string;

  @IsOptional()
  @IsUUID()
  fromEmployeeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class RemoveKudosDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateKudosDto {
  @IsUUID()
  fromEmployeeId!: string;

  @IsUUID()
  toEmployeeId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}

export class CreateEmployeeKudosDto {
  @IsUUID()
  toEmployeeId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}
