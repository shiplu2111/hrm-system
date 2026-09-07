import type { PayComponentCalculationType } from '@prisma/client';
import type { ResolvedSuperannuationRates } from '../superannuation.utils';

export interface PayrollRegressionAttendanceInput {
  workedHours: string;
  standardHours: string;
  hourlyRate: string;
  otMultiplier: string;
  status: 'present' | 'unpaid_leave';
  unpaidDays: string;
  workingDaysInPeriod: number;
}

export interface PayrollRegressionLeaveInput {
  unpaidLeaveDays: number;
  paidLeaveDays: number;
}

export interface PayrollRegressionStructureInput {
  id: string;
  componentId: string;
  componentType: 'earning' | 'deduction';
  name: string;
  calculationType: PayComponentCalculationType;
  amountOrFormula: Record<string, unknown>;
  formula?: Record<string, unknown> | null;
}

export interface PayrollRegressionFixture {
  countryCode: 'AUS' | 'BGD';
  employeeId: string;
  companyId: string;
  periodEnd: string;
  basicSalary: string;
  attendance: PayrollRegressionAttendanceInput;
  leave: PayrollRegressionLeaveInput;
  salaryStructures: PayrollRegressionStructureInput[];
  /** Resolved `social_security` country-rule rates (when testing superannuation). */
  superannuationRates?: ResolvedSuperannuationRates | null;
}

export interface PayslipGoldenLine {
  componentName: string;
  calculationType: string;
  amount: string;
}

export interface PayslipGoldenOutput {
  countryCode: 'AUS' | 'BGD';
  periodEnd: string;
  grossPay: string;
  totalDeductions: string;
  netPay: string;
  earnings: PayslipGoldenLine[];
  deductions: PayslipGoldenLine[];
  superannuation?: {
    employerContribution: string;
    employeeContribution: string;
    totalContribution: string;
  } | null;
  inputs: {
    attendance: PayrollRegressionAttendanceInput;
    leave: PayrollRegressionLeaveInput;
    basicSalary: string;
  };
}
