/** Vendor / Contractor Management (MODULES.md §31) — invoice-based, not salary_structures. */

export type ContractorKind = 'freelancer' | 'consultant' | 'vendor';
export type ContractorStatus = 'draft' | 'active' | 'inactive';
export type ContractorContractStatus = 'draft' | 'active' | 'expired' | 'terminated';
export type ContractorPaymentTerms =
  | 'due_on_receipt'
  | 'net_7'
  | 'net_14'
  | 'net_30'
  | 'net_45'
  | 'net_60';
export type ContractorBillingFrequency =
  | 'per_invoice'
  | 'weekly'
  | 'monthly'
  | 'milestone';
/** How the contract is billed — fixed fee, milestones, or hourly invoices. */
export type ContractorPaymentStructure =
  | 'fixed_project_fee'
  | 'milestone'
  | 'hourly_invoice';
export type ContractorMilestoneStatus = 'pending' | 'invoiced' | 'paid';
export type ContractorInvoiceStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'scheduled'
  | 'paid'
  | 'rejected'
  | 'cancelled';
export type ContractorPaymentBatchStatus = 'draft' | 'pending' | 'paid' | 'failed';

export interface ContractorRecord {
  id: string;
  companyId: string;
  contractorNumber: string;
  legalName: string;
  displayName: string | null;
  contractorKind: ContractorKind;
  category: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  taxId: string | null;
  status: ContractorStatus;
  ownerEmployeeId: string | null;
  ownerEmployeeName: string | null;
  activeContractCount: number;
  outstandingInvoiceAmount: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContractorContractMilestoneRecord {
  id: string;
  contractId: string;
  title: string;
  description: string | null;
  amount: string;
  targetDate: string | null;
  sortOrder: number;
  status: ContractorMilestoneStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ContractorContractRecord {
  id: string;
  companyId: string;
  contractorId: string;
  contractorName: string;
  contractNumber: string;
  title: string;
  scopeDescription: string | null;
  status: ContractorContractStatus;
  startDate: string;
  endDate: string;
  daysUntilExpiry: number;
  annualValue: string | null;
  fixedFeeAmount: string | null;
  hourlyRate: string | null;
  currency: string;
  paymentStructure: ContractorPaymentStructure;
  paymentTerms: ContractorPaymentTerms;
  billingFrequency: ContractorBillingFrequency;
  autoRenewal: boolean;
  noticePeriodDays: number;
  ownerEmployeeId: string | null;
  ownerEmployeeName: string | null;
  milestones: ContractorContractMilestoneRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface ContractorInvoiceLineItem {
  description: string;
  quantity?: number;
  unitAmount?: string;
  amount: string;
}

export interface ContractorInvoiceRecord {
  id: string;
  companyId: string;
  contractorId: string;
  contractorName: string;
  contractId: string;
  contractNumber: string;
  milestoneId: string | null;
  invoiceNumber: string;
  periodLabel: string | null;
  description: string | null;
  lineItems: ContractorInvoiceLineItem[];
  hoursWorked: string | null;
  hourlyRate: string | null;
  amount: string;
  currency: string;
  issuedAt: string;
  dueAt: string;
  status: ContractorInvoiceStatus;
  paidAt: string | null;
  paymentReference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractorPaymentBatchRecord {
  id: string;
  companyId: string;
  referenceNumber: string;
  status: ContractorPaymentBatchStatus;
  totalAmount: string;
  currency: string;
  itemCount: number;
  transactionReference: string | null;
  paidAt: string | null;
  journalExportId: string | null;
  createdAt: string;
}

export interface ContractorSummary {
  totalContractors: number;
  activeContracts: number;
  expiringWithin60Days: number;
  overdueContracts: number;
  outstandingInvoiceAmount: string;
  pendingInvoiceCount: number;
}

export const CONTRACTOR_PAYMENT_STRUCTURE_LABELS: Record<
  ContractorPaymentStructure,
  string
> = {
  fixed_project_fee: 'Fixed project fee',
  milestone: 'Milestone-based',
  hourly_invoice: 'Hourly (invoice)',
};
