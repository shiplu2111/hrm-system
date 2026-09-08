import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

const CONTRACTOR_KINDS = ['freelancer', 'consultant', 'vendor'] as const;
const CONTRACTOR_STATUSES = ['draft', 'active', 'inactive'] as const;
const CONTRACT_STATUSES = ['draft', 'active', 'expired', 'terminated'] as const;
const PAYMENT_TERMS = [
  'due_on_receipt',
  'net_7',
  'net_14',
  'net_30',
  'net_45',
  'net_60',
] as const;
const BILLING_FREQUENCIES = ['per_invoice', 'weekly', 'monthly', 'milestone'] as const;
const PAYMENT_STRUCTURES = [
  'fixed_project_fee',
  'milestone',
  'hourly_invoice',
] as const;
const INVOICE_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'scheduled',
  'paid',
  'rejected',
  'cancelled',
] as const;

export class ListContractorsQueryDto {
  @IsOptional()
  @IsIn([...CONTRACTOR_STATUSES])
  status?: (typeof CONTRACTOR_STATUSES)[number];

  @IsOptional()
  @IsString()
  search?: string;
}

export class CreateContractorDto {
  @IsString()
  legalName!: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsIn([...CONTRACTOR_KINDS])
  contractorKind?: (typeof CONTRACTOR_KINDS)[number];

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  taxId?: string;

  @IsOptional()
  @IsUUID()
  ownerEmployeeId?: string;

  @IsOptional()
  @IsIn([...CONTRACTOR_STATUSES])
  status?: (typeof CONTRACTOR_STATUSES)[number];
}

export class CreateContractMilestoneDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  sortOrder?: number;
}

export class CreateContractorContractDto {
  @IsUUID()
  contractorId!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  scopeDescription?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsNumberString()
  annualValue?: string;

  @IsOptional()
  @IsNumberString()
  fixedFeeAmount?: string;

  @IsOptional()
  @IsNumberString()
  hourlyRate?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsIn([...PAYMENT_STRUCTURES])
  paymentStructure?: (typeof PAYMENT_STRUCTURES)[number];

  @IsOptional()
  @IsIn([...PAYMENT_TERMS])
  paymentTerms?: (typeof PAYMENT_TERMS)[number];

  @IsOptional()
  @IsIn([...BILLING_FREQUENCIES])
  billingFrequency?: (typeof BILLING_FREQUENCIES)[number];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateContractMilestoneDto)
  milestones?: CreateContractMilestoneDto[];

  @IsOptional()
  @IsBoolean()
  autoRenewal?: boolean;

  @IsOptional()
  @IsUUID()
  ownerEmployeeId?: string;

  @IsOptional()
  @IsIn([...CONTRACT_STATUSES])
  status?: (typeof CONTRACT_STATUSES)[number];
}

export class ContractorInvoiceLineItemDto {
  @IsString()
  description!: string;

  @IsOptional()
  quantity?: number;

  @IsOptional()
  @IsNumberString()
  unitAmount?: string;

  @IsNumberString()
  amount!: string;
}

export class CreateContractorInvoiceDto {
  @IsUUID()
  contractorId!: string;

  @IsUUID()
  contractId!: string;

  @IsOptional()
  @IsUUID()
  milestoneId?: string;

  @IsOptional()
  @IsString()
  periodLabel?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractorInvoiceLineItemDto)
  lineItems?: ContractorInvoiceLineItemDto[];

  @IsNumberString()
  amount!: string;

  @IsOptional()
  @IsNumberString()
  hoursWorked?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsDateString()
  issuedAt!: string;
}

export class ContractorInvoiceActionDto {
  @IsOptional()
  @IsString()
  paymentReference?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CreateContractorPaymentBatchDto {
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  invoiceIds?: string[];
}

export class ListContractorInvoicesQueryDto {
  @IsOptional()
  @IsUUID()
  contractorId?: string;

  @IsOptional()
  @IsIn([...INVOICE_STATUSES])
  status?: (typeof INVOICE_STATUSES)[number];
}
