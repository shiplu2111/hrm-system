import { IsOptional, IsString, MinLength, IsUUID, IsArray } from 'class-validator';

export class CreatePaymentBatchDto {
  @IsUUID()
  payrollPeriodId!: string;

  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  payrollRunIds?: string[];
}

export class MarkPaymentBatchPaidDto {
  @IsOptional()
  transactionReference?: string;
}

export class MarkPaymentBatchFailedDto {
  @IsString()
  @MinLength(1)
  failureReason!: string;
}
