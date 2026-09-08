import type {
  ContractorContractStatus,
  ContractorPaymentTerms,
} from '@hrm/shared-types';

const PAYMENT_TERMS_DAYS: Record<ContractorPaymentTerms, number> = {
  due_on_receipt: 0,
  net_7: 7,
  net_14: 14,
  net_30: 30,
  net_45: 45,
  net_60: 60,
};

export function paymentTermsDays(terms: ContractorPaymentTerms): number {
  return PAYMENT_TERMS_DAYS[terms] ?? 30;
}

export function computeInvoiceDueDate(
  issuedAt: Date,
  paymentTerms: ContractorPaymentTerms,
): Date {
  const days = paymentTermsDays(paymentTerms);
  return new Date(issuedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

export function resolveContractStatus(input: {
  storedStatus: ContractorContractStatus;
  startDate: Date;
  endDate: Date;
  asOf?: Date;
}): ContractorContractStatus {
  if (input.storedStatus === 'draft' || input.storedStatus === 'terminated') {
    return input.storedStatus;
  }

  const asOf = input.asOf ?? new Date();
  const start = startOfUtcDay(input.startDate);
  const end = startOfUtcDay(input.endDate);
  const today = startOfUtcDay(asOf);

  if (today > end) {
    return 'expired';
  }
  if (today >= start) {
    return 'active';
  }
  return input.storedStatus === 'active' ? 'active' : 'draft';
}

export function daysUntilExpiry(endDate: Date, asOf = new Date()): number {
  const end = startOfUtcDay(endDate).getTime();
  const today = startOfUtcDay(asOf).getTime();
  return Math.ceil((end - today) / (24 * 60 * 60 * 1000));
}

export function generateContractorNumber(
  countForYear: number,
  year = new Date().getUTCFullYear(),
): string {
  return `VEN-${year}-${String(countForYear + 1).padStart(3, '0')}`;
}

export function generateContractNumber(
  countForYear: number,
  year = new Date().getUTCFullYear(),
): string {
  return `CTR-${year}-${String(countForYear + 1).padStart(3, '0')}`;
}

export function generateInvoiceNumber(
  countForYear: number,
  year = new Date().getUTCFullYear(),
): string {
  return `CINV-${year}-${String(countForYear + 1).padStart(3, '0')}`;
}

export function generateContractorPaymentBatchReference(
  countForYear: number,
  year = new Date().getUTCFullYear(),
): string {
  return `CPAY-${year}-${String(countForYear + 1).padStart(4, '0')}`;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
