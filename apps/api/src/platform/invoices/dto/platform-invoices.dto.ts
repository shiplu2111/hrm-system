import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export enum InvoiceStatusEnum {
  draft = 'draft',
  open = 'open',
  paid = 'paid',
  past_due = 'past_due',
  uncollectible = 'uncollectible',
  void = 'void',
}

export class QueryPlatformInvoicesDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(InvoiceStatusEnum)
  status?: InvoiceStatusEnum;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class MarkInvoicePaidDto {
  @IsNotEmpty({ message: 'Mandatory justification reason is required when marking an invoice paid manually' })
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class IssueCreditNoteDto {
  @IsNotEmpty({ message: 'Credit amount is required' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01, { message: 'Credit amount must be greater than 0' })
  amount!: number;

  @IsNotEmpty({ message: 'Mandatory justification reason is required when issuing a credit note' })
  @IsString()
  reason!: string;
}

export class ResendInvoiceEmailDto {
  @IsOptional()
  @IsString()
  recipientEmail?: string;
}
