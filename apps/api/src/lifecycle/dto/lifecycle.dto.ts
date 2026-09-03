import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { LifecycleEventType } from '@prisma/client';

export class CreateLifecycleEventDto {
  @IsEnum(LifecycleEventType)
  eventType!: LifecycleEventType;

  /** ISO date YYYY-MM-DD */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveDate!: string;

  @IsObject()
  details!: Record<string, unknown>;
}

export class ListLifecycleEventsQueryDto {
  @IsOptional()
  @IsEnum(LifecycleEventType)
  eventType?: LifecycleEventType;
}

/** Typed detail shapes validated in the service layer */
export interface PromotionDetails {
  newDesignationId: string;
  newDepartmentId?: string | null;
  newManagerId?: string | null;
  notes?: string;
}

export interface TransferDetails {
  newDepartmentId?: string | null;
  newWorkLocationId?: string | null;
  newCostCentreId?: string | null;
  newManagerId?: string | null;
  notes?: string;
}

export interface SalaryRevisionDetails {
  previousAmount: number;
  newAmount: number;
  currency?: string;
  reason?: string;
}

export interface ProbationDetails {
  newProbationEndDate: string;
  notes?: string;
}

export interface ConfirmationDetails {
  confirmationDate?: string;
  notes?: string;
}

export interface SuspensionDetails {
  reason: string;
  suspensionEndDate?: string | null;
  notes?: string;
}

export interface ResignationDetails {
  reason?: string;
  lastWorkingDate?: string;
  notes?: string;
}

export interface TerminationDetails {
  reason: string;
  lastWorkingDate?: string;
  notes?: string;
}

export interface RehireDetails {
  newHireDate?: string;
  newDepartmentId?: string | null;
  newDesignationId?: string | null;
  newEmploymentTypeId?: string | null;
  notes?: string;
}
