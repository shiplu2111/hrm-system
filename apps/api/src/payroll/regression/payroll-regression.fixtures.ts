import { PayComponentCalculationType } from '@prisma/client';
import {
  PAY_FORMULA_OVERTIME_EXAMPLE,
  PAY_FORMULA_UNPAID_LEAVE_EXAMPLE,
} from '@hrm/shared-types';
import type { PayrollRegressionFixture } from './payroll-regression.types';

/** June 2024 payroll period — Australia (AUS): basic + HRA + OT − superannuation. */
export const AUS_PAYROLL_REGRESSION_FIXTURE: PayrollRegressionFixture = {
  countryCode: 'AUS',
  employeeId: 'regression-emp-aus',
  companyId: 'regression-company-aus',
  periodEnd: '2024-06-30',
  basicSalary: '6000.00',
  attendance: {
    workedHours: '180',
    standardHours: '160',
    hourlyRate: '37.50',
    otMultiplier: '1.5',
    status: 'present',
    unpaidDays: '0',
    workingDaysInPeriod: 21,
  },
  leave: {
    unpaidLeaveDays: 0,
    paidLeaveDays: 0,
  },
  salaryStructures: [
    {
      id: 'aus-ss-basic',
      componentId: 'aus-comp-basic',
      componentType: 'earning',
      name: 'Basic Salary',
      calculationType: PayComponentCalculationType.fixed,
      amountOrFormula: { amount: '6000.00' },
    },
    {
      id: 'aus-ss-hra',
      componentId: 'aus-comp-hra',
      componentType: 'earning',
      name: 'House Rent Allowance',
      calculationType: PayComponentCalculationType.percentage,
      amountOrFormula: { percentage: 10 },
      formula: { base: 'basic', percentage: 10 },
    },
    {
      id: 'aus-ss-ot',
      componentId: 'aus-comp-ot',
      componentType: 'earning',
      name: 'Overtime',
      calculationType: PayComponentCalculationType.formula,
      amountOrFormula: {},
      formula: PAY_FORMULA_OVERTIME_EXAMPLE as unknown as Record<string, unknown>,
    },
    {
      id: 'aus-ss-super',
      componentId: 'aus-comp-super',
      componentType: 'deduction',
      name: 'Superannuation',
      calculationType: PayComponentCalculationType.percentage,
      amountOrFormula: { percentage: 11 },
      formula: { base: 'gross', percentage: 11 },
    },
  ],
};

/** June 2024 payroll period — Bangladesh (BGD): basic + transport − tax − unpaid leave. */
export const BGD_PAYROLL_REGRESSION_FIXTURE: PayrollRegressionFixture = {
  countryCode: 'BGD',
  employeeId: 'regression-emp-bgd',
  companyId: 'regression-company-bgd',
  periodEnd: '2024-06-30',
  basicSalary: '45000.00',
  attendance: {
    workedHours: '168',
    standardHours: '176',
    hourlyRate: '255.68',
    otMultiplier: '2',
    status: 'unpaid_leave',
    unpaidDays: '2',
    workingDaysInPeriod: 22,
  },
  leave: {
    unpaidLeaveDays: 2,
    paidLeaveDays: 0,
  },
  salaryStructures: [
    {
      id: 'bgd-ss-basic',
      componentId: 'bgd-comp-basic',
      componentType: 'earning',
      name: 'Basic Salary',
      calculationType: PayComponentCalculationType.fixed,
      amountOrFormula: { amount: '45000.00' },
    },
    {
      id: 'bgd-ss-transport',
      componentId: 'bgd-comp-transport',
      componentType: 'earning',
      name: 'Transport Allowance',
      calculationType: PayComponentCalculationType.fixed,
      amountOrFormula: { amount: '3000.00' },
    },
    {
      id: 'bgd-ss-tax',
      componentId: 'bgd-comp-tax',
      componentType: 'deduction',
      name: 'Income Tax',
      calculationType: PayComponentCalculationType.percentage,
      amountOrFormula: { percentage: 5 },
      formula: { base: 'gross', percentage: 5 },
    },
    {
      id: 'bgd-ss-unpaid',
      componentId: 'bgd-comp-unpaid',
      componentType: 'deduction',
      name: 'Unpaid Leave Deduction',
      calculationType: PayComponentCalculationType.formula,
      amountOrFormula: {},
      formula: PAY_FORMULA_UNPAID_LEAVE_EXAMPLE as unknown as Record<string, unknown>,
    },
  ],
};

export const PAYROLL_REGRESSION_FIXTURES = [
  AUS_PAYROLL_REGRESSION_FIXTURE,
  BGD_PAYROLL_REGRESSION_FIXTURE,
] as const;
