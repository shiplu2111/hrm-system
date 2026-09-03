export type PayrollRunStatus =
  | 'draft'
  | 'calculated'
  | 'under_review'
  | 'approved'
  | 'finalized'
  | 'paid'
  | 'cancelled';

export type PayComponentType = 'earning' | 'deduction';

export type PayComponentCalculationType = 'fixed' | 'percentage' | 'formula';

/** @deprecated Use PayComponentPercentageFormula from payroll-formula */
export type PayComponentPercentageBase = 'basic' | 'gross';

/** @deprecated Use PayComponentPercentageFormula from payroll-formula */
export interface PayComponentFormulaConfig {
  base?: PayComponentPercentageBase;
  percentage?: number;
}

export type {
  PayComponentFormula,
  PayComponentPercentageFormula,
  PayFormulaRule,
  PayFormulaCondition,
  PayFormulaExpression,
  PayFormulaArithmetic,
  PayFormulaLiteral,
  PayFormulaReference,
  PayFormulaCompareOp,
  PayFormulaArithmeticOp,
  PayFormulaRefPath,
} from './payroll-formula';

export {
  isPayFormulaRule,
  isPercentageFormula,
  PAY_FORMULA_OVERTIME_EXAMPLE,
  PAY_FORMULA_UNPAID_LEAVE_EXAMPLE,
  PAY_FORMULA_REF_PATHS,
} from './payroll-formula';

export interface PayComponentRecord {
  id: string;
  companyId: string;
  name: string;
  type: PayComponentType;
  calculationType: PayComponentCalculationType;
  formula: import('./payroll-formula').PayComponentFormula | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalaryStructureAmountConfig {
  /** Fixed monetary amount — decimal string e.g. "5000.00" */
  amount?: string;
  /** Percentage rate 0–100 for percentage components */
  percentage?: number;
  /** Optional hourly rate override for formula components */
  hourly_rate?: string;
  /** Optional OT multiplier override for formula components */
  ot_multiplier?: number;
}

export interface SalaryStructureRecord {
  id: string;
  employeeId: string;
  componentType: PayComponentType;
  componentId: string;
  componentName?: string;
  componentCalculationType?: PayComponentCalculationType;
  amountOrFormula: SalaryStructureAmountConfig;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollCalculationLine {
  salaryStructureId: string;
  componentId: string;
  componentName: string;
  componentType: PayComponentType;
  calculationType: 'fixed' | 'percentage' | 'formula';
  baseAmount: string | null;
  percentage: number | null;
  amount: string;
  /** Present when calculationType is formula — structured rule that was evaluated */
  formulaApplied?: boolean;
  formulaDescription?: string | null;
}

export interface PayrollCalculationPreview {
  employeeId: string;
  asOfDate: string;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  earnings: PayrollCalculationLine[];
  deductions: PayrollCalculationLine[];
}

export interface PayrollRunSummary {
  id: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  status: PayrollRunStatus;
}

export type PayrollPeriodStatus = 'draft' | 'open' | 'processing' | 'closed';

export interface PayrollPeriodRecord {
  id: string;
  companyId: string;
  startDate: string;
  endDate: string;
  paymentDate: string;
  status: PayrollPeriodStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRunRecord {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  employeeNumber?: string;
  employeeName?: string;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  status: PayrollRunStatus;
  locked: boolean;
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRunTransitionResult {
  run: PayrollRunRecord;
  previousStatus: PayrollRunStatus;
  newStatus: PayrollRunStatus;
}

export type PaymentBatchStatus = 'draft' | 'pending' | 'paid' | 'failed';
export type PaymentBatchItemStatus = 'pending' | 'paid' | 'failed';

export interface PayslipRecord {
  id: string;
  payrollRunId: string;
  employeeId: string;
  fileKey: string;
  downloadUrl?: string;
  generatedAt: string;
  createdAt: string;
}

export interface PaymentBatchItemRecord {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName?: string;
  amount: string;
  status: PaymentBatchItemStatus;
  transactionReference: string | null;
  failureReason: string | null;
}

export interface PaymentBatchRecord {
  id: string;
  companyId: string;
  payrollPeriodId: string;
  referenceNumber: string;
  status: PaymentBatchStatus;
  totalAmount: string;
  itemCount: number;
  transactionReference: string | null;
  failureReason: string | null;
  submittedAt: string | null;
  paidAt: string | null;
  failedAt: string | null;
  items?: PaymentBatchItemRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentBatchTransitionResult {
  batch: PaymentBatchRecord;
  previousStatus: PaymentBatchStatus;
  newStatus: PaymentBatchStatus;
}

/** Hypothetical salary-structure overrides for simulation (PAYROLL_LOGIC.md §8). */
export interface PayrollSalaryStructureOverride {
  salaryStructureId?: string;
  componentId?: string;
  amount?: string;
  percentage?: number;
  hourly_rate?: string;
  ot_multiplier?: number;
}

export interface PayrollSimulationResult {
  employeeId: string;
  asOfDate: string;
  /** Current committed calculation (no overrides) */
  baseline: PayrollCalculationPreview;
  /** Projected calculation with hypothetical overrides */
  simulated: PayrollCalculationPreview;
  delta: {
    grossPay: string;
    totalDeductions: string;
    netPay: string;
  };
}

export type PayrollAdjustmentStatus = 'draft' | 'pending' | 'applied' | 'cancelled';

export interface PayrollAdjustmentRecord {
  id: string;
  companyId: string;
  employeeId: string;
  originalPayrollRunId: string;
  applyToPayrollPeriodId: string | null;
  retroactiveFrom: string;
  retroactiveTo: string;
  reason: string;
  originalGrossPay: string;
  originalTotalDeductions: string;
  originalNetPay: string;
  revisedGrossPay: string;
  revisedTotalDeductions: string;
  revisedNetPay: string;
  adjustmentGrossPay: string;
  adjustmentTotalDeductions: string;
  adjustmentNetPay: string;
  status: PayrollAdjustmentStatus;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
