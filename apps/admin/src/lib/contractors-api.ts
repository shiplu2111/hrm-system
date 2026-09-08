import type {
  ContractorBillingFrequency,
  ContractorContractRecord,
  ContractorInvoiceRecord,
  ContractorKind,
  ContractorPaymentBatchRecord,
  ContractorPaymentStructure,
  ContractorPaymentTerms,
  ContractorRecord,
  ContractorSummary,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export {
  CONTRACTOR_PAYMENT_STRUCTURE_LABELS,
} from '@hrm/shared-types';

export const CONTRACTOR_KIND_LABELS: Record<ContractorKind, string> = {
  freelancer: 'Freelancer',
  consultant: 'Consultant',
  vendor: 'Vendor',
};

export const PAYMENT_TERMS_LABELS: Record<ContractorPaymentTerms, string> = {
  due_on_receipt: 'Due on receipt',
  net_7: 'Net 7',
  net_14: 'Net 14',
  net_30: 'Net 30',
  net_45: 'Net 45',
  net_60: 'Net 60',
};

export const BILLING_FREQUENCY_LABELS: Record<ContractorBillingFrequency, string> = {
  per_invoice: 'Per invoice',
  weekly: 'Weekly',
  monthly: 'Monthly',
  milestone: 'Milestone',
};

export const INVOICE_STATUS_LABELS: Record<
  ContractorInvoiceRecord['status'],
  string
> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  scheduled: 'Scheduled',
  paid: 'Paid',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export function getContractorSummary(companyId: string): Promise<ContractorSummary> {
  return tenantApiRequest<ContractorSummary>(
    `/companies/${companyId}/contractors/summary`,
  );
}

export function listContractors(
  companyId: string,
  params?: { status?: string; search?: string },
): Promise<ContractorRecord[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.search) query.set('search', params.search);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return tenantApiRequest<ContractorRecord[]>(
    `/companies/${companyId}/contractors${suffix}`,
  );
}

export function getContractor(contractorId: string): Promise<ContractorRecord> {
  return tenantApiRequest<ContractorRecord>(`/contractors/${contractorId}`);
}

export function createContractor(
  companyId: string,
  input: {
    legalName: string;
    displayName?: string;
    contractorKind?: ContractorKind;
    category?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    location?: string;
    taxId?: string;
    ownerEmployeeId?: string;
  },
): Promise<ContractorRecord> {
  return tenantApiRequest<ContractorRecord>(
    `/companies/${companyId}/contractors`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listContractorContracts(
  companyId: string,
): Promise<ContractorContractRecord[]> {
  return tenantApiRequest<ContractorContractRecord[]>(
    `/companies/${companyId}/contractor-contracts`,
  );
}

export function listContractsForContractor(
  contractorId: string,
): Promise<ContractorContractRecord[]> {
  return tenantApiRequest<ContractorContractRecord[]>(
    `/contractors/${contractorId}/contracts`,
  );
}

export function createContractorContract(
  companyId: string,
  input: {
    contractorId: string;
    title: string;
    scopeDescription?: string;
    startDate: string;
    endDate: string;
    annualValue?: string;
    currency?: string;
    paymentTerms?: ContractorPaymentTerms;
    billingFrequency?: ContractorBillingFrequency;
    paymentStructure?: ContractorPaymentStructure;
    fixedFeeAmount?: string;
    hourlyRate?: string;
    milestones?: Array<{
      title: string;
      description?: string;
      amount: string;
      targetDate?: string;
      sortOrder?: number;
    }>;
    autoRenewal?: boolean;
    ownerEmployeeId?: string;
  },
): Promise<ContractorContractRecord> {
  return tenantApiRequest<ContractorContractRecord>(
    `/companies/${companyId}/contractor-contracts`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listContractorInvoices(
  companyId: string,
  params?: { contractorId?: string; status?: string },
): Promise<ContractorInvoiceRecord[]> {
  const query = new URLSearchParams();
  if (params?.contractorId) query.set('contractorId', params.contractorId);
  if (params?.status) query.set('status', params.status);
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return tenantApiRequest<ContractorInvoiceRecord[]>(
    `/companies/${companyId}/contractor-invoices${suffix}`,
  );
}

export function createContractorInvoice(
  companyId: string,
  input: {
    contractorId: string;
    contractId: string;
    periodLabel?: string;
    description?: string;
    amount: string;
    currency?: string;
    issuedAt: string;
  },
): Promise<ContractorInvoiceRecord> {
  return tenantApiRequest<ContractorInvoiceRecord>(
    `/companies/${companyId}/contractor-invoices`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function submitContractorInvoice(
  invoiceId: string,
): Promise<ContractorInvoiceRecord> {
  return tenantApiRequest<ContractorInvoiceRecord>(
    `/contractor-invoices/${invoiceId}/submit`,
    { method: 'POST' },
  );
}

export function approveContractorInvoice(
  invoiceId: string,
): Promise<ContractorInvoiceRecord> {
  return tenantApiRequest<ContractorInvoiceRecord>(
    `/contractor-invoices/${invoiceId}/approve`,
    { method: 'POST' },
  );
}

export function listContractorPaymentBatches(
  companyId: string,
): Promise<ContractorPaymentBatchRecord[]> {
  return tenantApiRequest<ContractorPaymentBatchRecord[]>(
    `/companies/${companyId}/contractor-payment-batches`,
  );
}

export function createContractorPaymentBatch(
  companyId: string,
  invoiceIds?: string[],
): Promise<ContractorPaymentBatchRecord> {
  return tenantApiRequest<ContractorPaymentBatchRecord>(
    `/companies/${companyId}/contractor-payment-batches`,
    { method: 'POST', body: JSON.stringify({ invoiceIds }) },
  );
}
