export type PayrollRunStatus =
  | 'draft'
  | 'calculated'
  | 'under_review'
  | 'approved'
  | 'finalized'
  | 'paid'
  | 'cancelled';

export interface PayrollRunSummary {
  id: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollRunStatus;
}
