import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CompanyIdParam {
  @IsUUID()
  companyId!: string;
}

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsUUID()
  parentDepartmentId?: string | null;
}

export class UpdateDepartmentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsUUID()
  parentDepartmentId?: string | null;
}

export class CreateJobLevelDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  @Min(1)
  rank!: number;
}

export class UpdateJobLevelDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  rank?: number;
}

export class CreateDesignationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  jobLevelId?: string | null;

  @IsOptional()
  @IsString()
  salaryGrade?: string | null;
}

export class UpdateDesignationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsUUID()
  jobLevelId?: string | null;

  @IsOptional()
  @IsString()
  salaryGrade?: string | null;
}

export class CreateNamedEntityDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}

export class UpdateNamedEntityDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}

export class CreateCostCentreDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}

export class UpdateCostCentreDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  code?: string;
}

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  employeeNumber!: string;

  @IsUUID()
  companyId!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsOptional()
  @IsObject()
  personalInfo?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  employmentStatus?: string;

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
  managerId?: string | null;

  @IsString()
  hireDate!: string;

  @IsOptional()
  @IsString()
  probationEndDate?: string | null;

  @IsOptional()
  @IsString()
  confirmationDate?: string | null;

  @IsOptional()
  @IsUUID()
  workLocationId?: string | null;

  @IsOptional()
  @IsUUID()
  costCentreId?: string | null;
}

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  employeeNumber?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @IsOptional()
  @IsObject()
  personalInfo?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  employmentStatus?: string;

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
  managerId?: string | null;

  @IsOptional()
  @IsString()
  hireDate?: string;

  @IsOptional()
  @IsString()
  probationEndDate?: string | null;

  @IsOptional()
  @IsString()
  confirmationDate?: string | null;

  @IsOptional()
  @IsUUID()
  workLocationId?: string | null;

  @IsOptional()
  @IsUUID()
  costCentreId?: string | null;
}
