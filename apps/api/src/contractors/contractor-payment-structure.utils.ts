import { Decimal } from '@prisma/client/runtime/library';
import type {
  ContractorPaymentStructure,
} from '@hrm/shared-types';
import { formatMoney, parseMoney } from '../payroll/payroll.utils';

export interface InvoiceValidationInput {
  paymentStructure: ContractorPaymentStructure;
  fixedFeeAmount: string | null;
  hourlyRate: string | null;
  invoiceAmount: string;
  hoursWorked?: string | null;
  milestoneAmount?: string | null;
  milestoneStatus?: string | null;
  invoicedTotalExcludingCurrent: string;
}

export function computeHourlyInvoiceAmount(
  hoursWorked: string,
  hourlyRate: string,
): string {
  const hours = new Decimal(hoursWorked);
  const rate = parseMoney(hourlyRate);
  return formatMoney(hours.times(rate));
}

export function validateInvoiceAgainstContract(
  input: InvoiceValidationInput,
): string | null {
  const amount = parseMoney(input.invoiceAmount);
  if (amount.lte(0)) {
    return 'Invoice amount must be greater than zero';
  }

  switch (input.paymentStructure) {
    case 'fixed_project_fee': {
      if (!input.fixedFeeAmount) {
        return 'Contract has no fixed fee amount configured';
      }
      const cap = parseMoney(input.fixedFeeAmount);
      const invoiced = parseMoney(input.invoicedTotalExcludingCurrent).plus(amount);
      if (invoiced.gt(cap)) {
        return `Invoice would exceed fixed project fee of ${formatMoney(cap)}`;
      }
      return null;
    }
    case 'milestone': {
      if (!input.milestoneAmount) {
        return 'Milestone is required for milestone-based contracts';
      }
      if (input.milestoneStatus && input.milestoneStatus !== 'pending') {
        return 'Milestone has already been invoiced or paid';
      }
      if (!parseMoney(input.milestoneAmount).eq(amount)) {
        return `Invoice amount must match milestone amount of ${input.milestoneAmount}`;
      }
      return null;
    }
    case 'hourly_invoice': {
      if (!input.hourlyRate) {
        return 'Contract has no hourly rate configured';
      }
      if (!input.hoursWorked) {
        return 'Hours worked is required for hourly invoices';
      }
      const expected = computeHourlyInvoiceAmount(
        input.hoursWorked,
        input.hourlyRate,
      );
      if (!parseMoney(expected).eq(amount)) {
        return `Invoice amount must equal hours × rate (${expected})`;
      }
      return null;
    }
    default:
      return null;
  }
}

export function resolveDefaultPaymentStructure(input: {
  paymentStructure?: ContractorPaymentStructure;
  billingFrequency?: string;
}): ContractorPaymentStructure {
  if (input.paymentStructure) {
    return input.paymentStructure;
  }
  if (input.billingFrequency === 'milestone') {
    return 'milestone';
  }
  return 'fixed_project_fee';
}
