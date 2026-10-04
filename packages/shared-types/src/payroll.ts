import type { PayrollCurrencySnapshot } from './currency';

export type PayrollRunStatus =
  | 'draft'
  | 'calculated'
  | 'under_review'
  | 'approved'
  | 'finalized'
  | 'paid'
  | 'cancelled';

/** Main path of the status flow, in order (PAYROLL_LOGIC.md §7); `cancelled` sits outside it. */
export const PAYROLL_RUN_FLOW: readonly PayrollRunStatus[] = [
  'draft',
  'calculated',
  'under_review',
  'approved',
  'finalized',
  'paid',
];

/** Allowed status transitions (PAYROLL_LOGIC.md §7). */
export const PAYROLL_RUN_TRANSITIONS: Record<PayrollRunStatus, readonly PayrollRunStatus[]> = {
  draft: ['calculated', 'cancelled'],
  calculated: ['under_review', 'cancelled'],
  under_review: ['approved', 'calculated', 'cancelled'],
  approved: ['finalized', 'under_review', 'cancelled'],
  finalized: ['paid'],
  paid: [],
  cancelled: [],
};

/** Statuses that allow (re)calculation of pay amounts (PAYROLL_LOGIC.md §7). */
export const PAYROLL_RUN_RECALCULABLE_STATUSES: readonly PayrollRunStatus[] = [
  'draft',
  'calculated',
  'under_review',
];

/** Transitions that move money and need the totals the user confirmed. */
export const PAYROLL_RUN_CONFIRMED_TARGETS: readonly PayrollRunStatus[] = ['approved', 'finalized', 'paid'];

export type PayComponentType = 'earning' | 'deduction';

export type PayComponentCalculationType = 'fixed' | 'percentage' | 'formula';

/** How a fixed amount is paid — per period, per day worked, or per hour worked. */
export type SalaryPayBasis = 'monthly' | 'daily' | 'hourly';

export const SALARY_PAY_BASES: readonly SalaryPayBasis[] = ['monthly', 'daily', 'hourly'];

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
  PAY_FORMULA_LOAN_INSTALLMENT,
  PAY_FORMULA_OVERTIME_EXAMPLE,
  PAY_FORMULA_UNPAID_LEAVE_EXAMPLE,
  PAY_FORMULA_REF_PATHS,
} from './payroll-formula';

export interface PayComponentUsage {
  /** Distinct employees with a current or scheduled assignment */
  activeEmployeeCount: number;
  /** All salary structure rows referencing the component, including ended ones */
  assignmentCount: number;
}

export interface PayComponentRecord {
  id: string;
  companyId: string;
  name: string;
  type: PayComponentType;
  calculationType: PayComponentCalculationType;
  formula: import('./payroll-formula').PayComponentFormula | null;
  /** Present on list responses */
  usage?: PayComponentUsage;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePayComponentRequest {
  name: string;
  type: PayComponentType;
  calculationType: PayComponentCalculationType;
  formula?: import('./payroll-formula').PayComponentFormula;
}

export interface UpdatePayComponentRequest {
  name?: string;
  calculationType?: PayComponentCalculationType;
  formula?: import('./payroll-formula').PayComponentFormula | null;
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
  /** Always `monthly` for percentage and formula components. */
  payBasis: SalaryPayBasis;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSalaryStructureRequest {
  componentId: string;
  componentType: PayComponentType;
  amountOrFormula: Pick<SalaryStructureAmountConfig, 'amount' | 'percentage'>;
  /** Fixed components only; defaults to `monthly`. */
  payBasis?: SalaryPayBasis;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface UpdateSalaryStructureRequest {
  amountOrFormula?: Pick<SalaryStructureAmountConfig, 'amount' | 'percentage'>;
  payBasis?: SalaryPayBasis;
  effectiveFrom?: string;
  effectiveTo?: string | null;
}

/** Effective-dated change: closes the current row the day before and opens a new one. */
export interface ReviseSalaryStructureRequest {
  amountOrFormula: Pick<SalaryStructureAmountConfig, 'amount' | 'percentage'>;
  /** Omit to keep the current basis. */
  payBasis?: SalaryPayBasis;
  effectiveFrom: string;
}

export interface ReviseSalaryStructureResult {
  closed: SalaryStructureRecord;
  created: SalaryStructureRecord;
}

export interface LockedPayrollPeriodSummary {
  payrollPeriodId: string;
  startDate: string;
  endDate: string;
  runStatus: PayrollRunStatus;
}

/** Periods with finalized/paid runs for an employee — structure history there is read-only. */
export interface SalaryStructurePayrollLock {
  lockedThrough: string | null;
  periods: LockedPayrollPeriodSummary[];
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
  /** Fixed lines: daily/hourly amounts are `rate × units` (days or hours worked). */
  payBasis?: SalaryPayBasis;
  rate?: string | null;
  units?: string | null;
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
  superannuation?: SuperannuationContributionPreview | null;
  currency?: PayrollCurrencySnapshot;
}

export interface SuperannuationContributionPreview {
  schemeName: string;
  contributionBase: 'gross' | 'basic';
  employerContributionRate: number;
  employeeContributionRate: number;
  baseAmount: string;
  employerContribution: string;
  employeeContribution: string;
  totalContribution: string;
  /** Country rule layer that supplied the rates (for audit/display) */
  ruleType: 'social_security';
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
  /** Present on list and detail responses. */
  summary?: PayrollPeriodSummary;
  createdAt: string;
  updatedAt: string;
}

/** Aggregate of a period's runs; cancelled runs are counted but excluded from totals. */
export interface PayrollPeriodSummary {
  /** Runs that are not cancelled — one per employee. */
  employeeCount: number;
  statusCounts: Partial<Record<PayrollRunStatus, number>>;
  /** Base-currency totals of non-cancelled runs. */
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  /** Null when no run has been calculated yet. */
  baseCurrency: string | null;
}

export interface CreatePayrollPeriodRequest {
  startDate: string;
  endDate: string;
  paymentDate: string;
}

export interface UpdatePayrollPeriodRequest {
  startDate?: string;
  endDate?: string;
  paymentDate?: string;
}

export interface PayrollEmployeeRef {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
}

export interface GeneratePayrollRunsRequest {
  /** Defaults to every active employee with a salary structure in the period. */
  employeeIds?: string[];
}

export interface GeneratePayrollRunsResult {
  created: PayrollRunRecord[];
  /** Employees who already have an active run in this period. */
  alreadyIncluded: number;
  withoutSalaryStructure: PayrollEmployeeRef[];
  /** Employees with an active run in another period overlapping these dates. */
  inOverlappingPeriod: Array<PayrollEmployeeRef & { periodStartDate: string; periodEndDate: string }>;
}

export interface CalculatePayrollRunsRequest {
  /** Defaults to every run in draft, calculated or under review. */
  runIds?: string[];
}

/** What the user saw on the confirmation step; the server rejects the action if it no longer matches. */
export interface PayrollTotalsExpectation {
  runCount: number;
  /** Base-currency totals. */
  grossPay: string;
  netPay: string;
}

export interface BulkPayrollRunTransitionRequest {
  fromStatus: PayrollRunStatus;
  targetStatus: PayrollRunStatus;
  /** Defaults to every run of the period in `fromStatus`. */
  runIds?: string[];
  /** Required when approving, finalizing or marking as paid. */
  expected?: PayrollTotalsExpectation;
}

export interface PayrollBulkFailure {
  runId: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  message: string;
}

export interface PayrollBulkResult {
  succeeded: PayrollRunRecord[];
  failed: PayrollBulkFailure[];
}

export interface PayrollRunBreakdown {
  run: PayrollRunRecord;
  /**
   * `snapshot`: stored when the run was calculated.
   * `live`: recalculated now because the run predates snapshots or is still a draft — may differ from the stored totals.
   */
  source: 'snapshot' | 'live';
  calculation: PayrollCalculationPreview | null;
  /** Set when a live calculation failed. */
  error?: string;
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
  payCurrency?: string;
  baseCurrency?: string;
  exchangeRate?: string | null;
  exchangeRateId?: string | null;
  exchangeRateDate?: string | null;
  grossPayBase?: string | null;
  totalDeductionsBase?: string | null;
  netPayBase?: string | null;
  /** False for runs calculated before breakdown snapshots existed, and for drafts. */
  hasBreakdown?: boolean;
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

/** A finalized or paid run and its payslip, if one has been generated. */
export interface PayslipListItem {
  payrollRunId: string;
  payrollPeriodId: string;
  periodStartDate: string;
  periodEndDate: string;
  paymentDate: string;
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  departmentName: string | null;
  runStatus: PayrollRunStatus;
  finalizedAt: string | null;
  payCurrency: string;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  payslip: { id: string; generatedAt: string; downloadUrl: string } | null;
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
  /** Matches an active row for this component, or adds a hypothetical row when none is active. */
  componentId?: string;
  /** Drop the matched row from the simulated calculation. */
  remove?: boolean;
  amount?: string;
  percentage?: number;
  payBasis?: SalaryPayBasis;
  hourly_rate?: string;
  ot_multiplier?: number;
}

/** What-if change to a pay component's rule, applied to everyone assigned to it. */
export interface PayComponentImpactRequest {
  calculationType?: PayComponentCalculationType;
  formula?: import('./payroll-formula').PayComponentFormula | null;
  /** Defaults to today. */
  asOf?: string;
}

export interface PayrollTotals {
  grossPay: string;
  totalDeductions: string;
  netPay: string;
}

export interface PayComponentImpactEmployee {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  /** Currency of the per-employee figures; null when no currency snapshot applies. */
  payCurrency: string | null;
  baseline: PayrollTotals;
  simulated: PayrollTotals;
  delta: PayrollTotals;
}

export interface PayComponentImpactFailure {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  message: string;
}

/** Company-wide what-if for a component edit — nothing is saved (PAYROLL_LOGIC.md §8). */
export interface PayComponentImpactResult {
  componentId: string;
  asOfDate: string;
  employeeCount: number;
  /** Totals are converted to this currency; null when no currency snapshot applies. */
  baseCurrency: string | null;
  baseline: PayrollTotals;
  simulated: PayrollTotals;
  delta: PayrollTotals;
  /** Sorted by the size of the net pay change, largest first. */
  employees: PayComponentImpactEmployee[];
  failures: PayComponentImpactFailure[];
}

/** Hypothetical attendance for the simulated pay month; omitted fields keep the recorded figures. */
export interface PayrollAttendanceOverride {
  daysWorked?: string;
  workedHours?: string;
  unpaidDays?: string;
}

/** Attendance figures a calculation used — recorded, or with the simulation's overrides applied. */
export interface PayrollSimulationAttendance {
  periodStart: string;
  periodEnd: string;
  daysWorked: string;
  workedHours: string;
  unpaidDays: string;
  workingDaysInPeriod: string;
  standardHours: string;
}

export interface PayrollSimulationRequest {
  asOf?: string;
  structureOverrides?: PayrollSalaryStructureOverride[];
  attendance?: PayrollAttendanceOverride;
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
  /** Null when the employee has no salary structure on the date, so no attendance was read. */
  attendance: {
    baseline: PayrollSimulationAttendance | null;
    simulated: PayrollSimulationAttendance | null;
  };
}

export type PayrollAdjustmentStatus = 'draft' | 'pending' | 'applied' | 'cancelled';

/** `final_settlement` adjustments are created from an offboarding's settlement step. */
export type PayrollAdjustmentKind = 'retroactive' | 'final_settlement';

export interface PayrollAdjustmentRecord {
  id: string;
  kind: PayrollAdjustmentKind;
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
  structureOverrides: PayrollSalaryStructureOverride[] | null;
  /** Revised breakdown captured at creation; null for adjustments created before it was stored. */
  calculation: PayrollCalculationPreview | null;
  status: PayrollAdjustmentStatus;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
