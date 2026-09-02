export interface PaySchedule {
  id: string;
  name: string;
  frequency: 'Monthly' | 'Bi-Weekly' | 'Weekly' | 'Semi-Monthly';
  cutOffDay: string;
  paymentDay: string;
  autoProcess: boolean;
  employeesCount: number;
  currency: string;
  status: 'Active' | 'Inactive';
}

export interface PayrollPeriod {
  id: string;
  periodName: string;
  scheduleId: string;
  startDate: string;
  endDate: string;
  cutOffDate: string;
  payDate: string;
  status: 'Draft' | 'Calculated' | 'Under Review' | 'Approved' | 'Finalized' | 'Paid' | 'Cancelled';
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
}

export interface SalaryComponent {
  id: string;
  code: string;
  name: string;
  category: 'Earning' | 'Deduction';
  type: 'Fixed' | 'Percentage of Basic' | 'Formula' | 'Variable';
  calculationBasis: string;
  taxable: boolean;
  adminDefined: boolean;
  active: boolean;
  description: string;
}

export interface SalaryStructureItem {
  componentId: string;
  name: string;
  category: 'Earning' | 'Deduction';
  amount: number;
  type: string;
}

export interface EmployeeSalaryStructure {
  id: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  department: string;
  currency: string;
  basicSalary: number;
  earnings: SalaryStructureItem[];
  deductions: SalaryStructureItem[];
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  effectiveDate: string;
  paySchedule: string;
}

export interface PayrollRule {
  id: string;
  name: string;
  version: string;
  category: 'Overtime' | 'Tax' | 'Bonus' | 'Deduction' | 'Allowance';
  conditionText: string;
  actionText: string;
  conditionFormula: string;
  actionFormula: string;
  effectiveFrom: string;
  effectiveTo: string;
  region: string;
  status: 'Active' | 'Superseded' | 'Draft';
  author: string;
}

export interface PayslipItem {
  label: string;
  amount: number;
  ytd?: number;
}

export interface PayslipData {
  id: string;
  payslipNumber: string;
  period: string;
  payDate: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  joiningDate: string;
  bankName: string;
  accountNumber: string;
  panOrSsn: string;
  pfOrUan: string;
  workingDays: number;
  leavesTaken: number;
  lossOfPayDays: number;
  earnings: PayslipItem[];
  deductions: PayslipItem[];
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  netPayInWords: string;
  ytdGross: number;
  ytdTax: number;
  ytdNet: number;
  isFinalSettlement?: boolean;
  settlementDetails?: {
    lastWorkingDay: string;
    gratuity: number;
    leaveEncashment: number;
    noticePeriodRecovery: number;
    severance: number;
    assetHandoverClearance: boolean;
  };
}

export interface PaymentBatch {
  id: string;
  batchNumber: string;
  periodName: string;
  bankName: string;
  accountNumber: string;
  generatedDate: string;
  totalEmployees: number;
  totalAmount: number;
  format: 'NACHA' | 'SEPA XML' | 'CSV' | 'ACH Direct';
  status: 'Pending' | 'Sent' | 'Failed' | 'Settled';
}

export interface PaymentItem {
  id: string;
  batchId: string;
  employeeId: string;
  employeeName: string;
  bankName: string;
  accountNumber: string;
  routingOrIfsc: string;
  amount: number;
  currency: string;
  status: 'Pending' | 'Sent' | 'Failed';
  referenceNumber: string;
  errorMessage?: string;
}

export interface TaxProfile {
  id: string;
  employeeId: string;
  employeeName: string;
  panOrTaxId: string;
  regime: 'New Regime (2024)' | 'Old Regime with Exemptions' | 'US Standard W-4' | 'UK PAYE';
  annualBaseSalary: number;
  projectedAnnualGross: number;
  declaredInvestments: number;
  section80C: number;
  hraExemption: number;
  healthInsurance80D: number;
  taxableIncome: number;
  annualTaxLiability: number;
  monthlyTds: number;
  taxBracket: string;
  status: 'Verified' | 'Pending Verification' | 'Draft';
}

export interface BenefitPlan {
  id: string;
  name: string;
  category: 'Health Insurance' | 'Life Insurance' | 'Retirement 401(k)' | 'Dental & Vision' | 'Wellness';
  provider: string;
  planTier: 'Silver' | 'Gold' | 'Platinum' | 'Custom';
  employerContribution: string;
  employeeContribution: string;
  coverageLimit: string;
  enrolledCount: number;
  description: string;
  status: 'Active' | 'Open Enrollment' | 'Inactive';
}

export interface LoanRecord {
  id: string;
  loanId: string;
  employeeId: string;
  employeeName: string;
  loanType: 'Emergency Advance' | 'Education Assistance' | 'Home / Relocation' | 'Device Purchase';
  principalAmount: number;
  interestRate: number; // percentage
  tenorMonths: number;
  monthlyEmi: number;
  disbursedDate: string;
  repaidAmount: number;
  remainingBalance: number;
  installmentsPaid: number;
  installmentsTotal: number;
  deductFromPayroll: boolean;
  status: 'Active' | 'Pending Approval' | 'Fully Paid' | 'Rejected';
}

export interface ExpenseClaim {
  id: string;
  claimId: string;
  employeeId: string;
  employeeName: string;
  category: 'Travel & Accommodation' | 'Meals & Entertainment' | 'Software & Subscriptions' | 'Equipment & Hardware' | 'Training & Certifications';
  amount: number;
  currency: string;
  date: string;
  description: string;
  receiptName: string;
  receiptSize: string;
  receiptThumbnail?: string;
  approvalStage: 'Employee Submitted' | 'Manager Approved' | 'Finance Approved' | 'Reimbursed';
  status: 'Pending Manager' | 'Pending Finance' | 'Approved for Payroll' | 'Reimbursed' | 'Rejected';
  approvedByManager?: string;
  approvedByFinance?: string;
}

export interface BillingPlan {
  id: string;
  name: string;
  pricePerUser: number;
  billingFrequency: 'monthly' | 'annually';
  description: string;
  popular?: boolean;
  features: { name: string; included: boolean }[];
}

export interface TenantBilling {
  id: string;
  companyName: string;
  domain: string;
  plan: 'Starter' | 'Business' | 'Enterprise';
  seats: number;
  mrr: number;
  paymentMethod: string;
  nextBillingDate: string;
  lastInvoiceAmount: number;
  status: 'Paid' | 'Pending' | 'Past Due' | 'Trial';
}

// ----------------- MOCK DATA CONSTANTS -----------------

export const paySchedules: PaySchedule[] = [
  {
    id: 'ps-1',
    name: 'US Regular Monthly Payroll',
    frequency: 'Monthly',
    cutOffDay: '25th of month',
    paymentDay: 'Last working day',
    autoProcess: true,
    employeesCount: 142,
    currency: 'USD ($)',
    status: 'Active',
  },
  {
    id: 'ps-2',
    name: 'Engineering Bi-Weekly Cycle',
    frequency: 'Bi-Weekly',
    cutOffDay: 'Alternate Thursdays',
    paymentDay: 'Following Friday',
    autoProcess: true,
    employeesCount: 88,
    currency: 'USD ($)',
    status: 'Active',
  },
  {
    id: 'ps-3',
    name: 'UK London Monthly Cycle',
    frequency: 'Monthly',
    cutOffDay: '20th of month',
    paymentDay: '28th of month',
    autoProcess: false,
    employeesCount: 45,
    currency: 'GBP (£)',
    status: 'Active',
  },
  {
    id: 'ps-4',
    name: 'Contractors Weekly Settlement',
    frequency: 'Weekly',
    cutOffDay: 'Every Sunday',
    paymentDay: 'Every Tuesday',
    autoProcess: false,
    employeesCount: 24,
    currency: 'USD ($)',
    status: 'Active',
  },
];

export const payrollPeriods: PayrollPeriod[] = [
  {
    id: 'pr-2024-08',
    periodName: 'August 2024 (Monthly)',
    scheduleId: 'ps-1',
    startDate: '2024-08-01',
    endDate: '2024-08-31',
    cutOffDate: '2024-08-25',
    payDate: '2024-08-31',
    status: 'Approved',
    employeeCount: 142,
    totalGross: 1420000,
    totalDeductions: 340800,
    totalNet: 1079200,
  },
  {
    id: 'pr-2024-09',
    periodName: 'September 2024 (Monthly)',
    scheduleId: 'ps-1',
    startDate: '2024-09-01',
    endDate: '2024-09-30',
    cutOffDate: '2024-09-25',
    payDate: '2024-09-30',
    status: 'Draft',
    employeeCount: 144,
    totalGross: 1452000,
    totalDeductions: 348480,
    totalNet: 1103520,
  },
  {
    id: 'pr-2024-07',
    periodName: 'July 2024 (Monthly)',
    scheduleId: 'ps-1',
    startDate: '2024-07-01',
    endDate: '2024-07-31',
    cutOffDate: '2024-07-25',
    payDate: '2024-07-31',
    status: 'Paid',
    employeeCount: 139,
    totalGross: 1390000,
    totalDeductions: 333600,
    totalNet: 1056400,
  },
  {
    id: 'pr-2024-06',
    periodName: 'June 2024 (Monthly)',
    scheduleId: 'ps-1',
    startDate: '2024-06-01',
    endDate: '2024-06-30',
    cutOffDate: '2024-06-25',
    payDate: '2024-06-30',
    status: 'Paid',
    employeeCount: 136,
    totalGross: 1360000,
    totalDeductions: 326400,
    totalNet: 1033600,
  },
];

export const salaryComponents: SalaryComponent[] = [
  {
    id: 'sc-1',
    code: 'BASIC',
    name: 'Basic Salary',
    category: 'Earning',
    type: 'Fixed',
    calculationBasis: 'Fixed Base Amount (50% of CTC)',
    taxable: true,
    adminDefined: true,
    active: true,
    description: 'Core foundational component of the compensation structure.',
  },
  {
    id: 'sc-2',
    code: 'HRA',
    name: 'House Rent Allowance (HRA)',
    category: 'Earning',
    type: 'Percentage of Basic',
    calculationBasis: '40% of Basic Salary',
    taxable: true,
    adminDefined: true,
    active: true,
    description: 'Housing allowance eligible for tax exemption with rent receipts.',
  },
  {
    id: 'sc-3',
    code: 'CONV',
    name: 'Conveyance & Transport',
    category: 'Earning',
    type: 'Fixed',
    calculationBasis: 'Flat $800 / month',
    taxable: false,
    adminDefined: false,
    active: true,
    description: 'Reimbursement for commuting expenses.',
  },
  {
    id: 'sc-4',
    code: 'SPEC_ALLW',
    name: 'Special Allowance',
    category: 'Earning',
    type: 'Variable',
    calculationBasis: 'Balancing Component of CTC',
    taxable: true,
    adminDefined: true,
    active: true,
    description: 'Flexible component to fulfill total compensation offering.',
  },
  {
    id: 'sc-5',
    code: 'OT_PAY',
    name: 'Overtime Earnings',
    category: 'Earning',
    type: 'Formula',
    calculationBasis: '(Hourly Rate × 1.5) × OT Hours',
    taxable: true,
    adminDefined: true,
    active: true,
    description: 'Calculated dynamically based on approved attendance OT hours.',
  },
  {
    id: 'sc-6',
    code: 'PERF_BONUS',
    name: 'Performance Bonus',
    category: 'Earning',
    type: 'Variable',
    calculationBasis: 'Quarterly Appraisal Rating Multiple',
    taxable: true,
    adminDefined: false,
    active: true,
    description: 'Discretionary performance-linked incentive pay.',
  },
  {
    id: 'sc-7',
    code: 'TAX_TDS',
    name: 'Income Tax Withholding (TDS)',
    category: 'Deduction',
    type: 'Formula',
    calculationBasis: 'Progressive Tax Slabs / Annual Projection',
    taxable: false,
    adminDefined: true,
    active: true,
    description: 'Statutory income tax deducted at source.',
  },
  {
    id: 'sc-8',
    code: 'PF_401K',
    name: 'Provident Fund / 401(k)',
    category: 'Deduction',
    type: 'Percentage of Basic',
    calculationBasis: '12% of Basic Salary (Matched by Employer)',
    taxable: false,
    adminDefined: true,
    active: true,
    description: 'Statutory retirement contribution.',
  },
  {
    id: 'sc-9',
    code: 'MED_INS',
    name: 'Health Insurance Premium',
    category: 'Deduction',
    type: 'Fixed',
    calculationBasis: '$150 / month (Employee Co-pay)',
    taxable: false,
    adminDefined: false,
    active: true,
    description: 'Group medical and dental insurance employee share.',
  },
  {
    id: 'sc-10',
    code: 'LOAN_EMI',
    name: 'Loan & Advance Recovery',
    category: 'Deduction',
    type: 'Variable',
    calculationBasis: 'Active Loan Schedule Installment',
    taxable: false,
    adminDefined: true,
    active: true,
    description: 'Monthly deduction for active salary advance or emergency loan.',
  },
];

export const employeeSalaryStructures: EmployeeSalaryStructure[] = [
  {
    id: 'ess-1',
    employeeId: 'EMP-001',
    employeeName: 'Sarah Chen',
    designation: 'VP Engineering',
    department: 'Engineering',
    currency: '$',
    basicSalary: 7500,
    effectiveDate: '2024-01-01',
    paySchedule: 'US Regular Monthly Payroll',
    earnings: [
      { componentId: 'sc-1', name: 'Basic Salary', category: 'Earning', amount: 7500, type: 'Fixed' },
      { componentId: 'sc-2', name: 'House Rent Allowance (HRA)', category: 'Earning', amount: 3000, type: '40% Basic' },
      { componentId: 'sc-3', name: 'Conveyance Allowance', category: 'Earning', amount: 800, type: 'Fixed' },
      { componentId: 'sc-4', name: 'Special Allowance', category: 'Earning', amount: 3200, type: 'Fixed' },
      { componentId: 'sc-6', name: 'Executive Bonus', category: 'Earning', amount: 500, type: 'Monthly' },
    ],
    deductions: [
      { componentId: 'sc-7', name: 'Income Tax (TDS)', category: 'Deduction', amount: 2650, type: 'Statutory' },
      { componentId: 'sc-8', name: '401(k) / Retirement', category: 'Deduction', amount: 900, type: '12% Basic' },
      { componentId: 'sc-9', name: 'Health Insurance', category: 'Deduction', amount: 150, type: 'Fixed' },
    ],
    grossSalary: 15000,
    totalDeductions: 3700,
    netSalary: 11300,
  },
  {
    id: 'ess-2',
    employeeId: 'EMP-002',
    employeeName: 'Marcus Johnson',
    designation: 'VP Sales',
    department: 'Sales',
    currency: '$',
    basicSalary: 6875,
    effectiveDate: '2024-01-01',
    paySchedule: 'US Regular Monthly Payroll',
    earnings: [
      { componentId: 'sc-1', name: 'Basic Salary', category: 'Earning', amount: 6875, type: 'Fixed' },
      { componentId: 'sc-2', name: 'House Rent Allowance (HRA)', category: 'Earning', amount: 2750, type: '40% Basic' },
      { componentId: 'sc-3', name: 'Conveyance Allowance', category: 'Earning', amount: 800, type: 'Fixed' },
      { componentId: 'sc-4', name: 'Special Allowance', category: 'Earning', amount: 2575, type: 'Fixed' },
      { componentId: 'sc-6', name: 'Sales Commission', category: 'Earning', amount: 750, type: 'Variable' },
    ],
    deductions: [
      { componentId: 'sc-7', name: 'Income Tax (TDS)', category: 'Deduction', amount: 2350, type: 'Statutory' },
      { componentId: 'sc-8', name: '401(k) / Retirement', category: 'Deduction', amount: 825, type: '12% Basic' },
      { componentId: 'sc-9', name: 'Health Insurance', category: 'Deduction', amount: 150, type: 'Fixed' },
      { componentId: 'sc-10', name: 'Loan EMI', category: 'Deduction', amount: 300, type: 'Active' },
    ],
    grossSalary: 13750,
    totalDeductions: 3625,
    netSalary: 10125,
  },
  {
    id: 'ess-3',
    employeeId: 'EMP-003',
    employeeName: 'Priya Patel',
    designation: 'VP Marketing',
    department: 'Marketing',
    currency: '$',
    basicSalary: 6250,
    effectiveDate: '2024-02-01',
    paySchedule: 'US Regular Monthly Payroll',
    earnings: [
      { componentId: 'sc-1', name: 'Basic Salary', category: 'Earning', amount: 6250, type: 'Fixed' },
      { componentId: 'sc-2', name: 'House Rent Allowance (HRA)', category: 'Earning', amount: 2500, type: '40% Basic' },
      { componentId: 'sc-3', name: 'Conveyance Allowance', category: 'Earning', amount: 800, type: 'Fixed' },
      { componentId: 'sc-4', name: 'Special Allowance', category: 'Earning', amount: 2950, type: 'Fixed' },
    ],
    deductions: [
      { componentId: 'sc-7', name: 'Income Tax (TDS)', category: 'Deduction', amount: 2100, type: 'Statutory' },
      { componentId: 'sc-8', name: '401(k) / Retirement', category: 'Deduction', amount: 750, type: '12% Basic' },
      { componentId: 'sc-9', name: 'Health Insurance', category: 'Deduction', amount: 150, type: 'Fixed' },
    ],
    grossSalary: 12500,
    totalDeductions: 3000,
    netSalary: 9500,
  },
  {
    id: 'ess-4',
    employeeId: 'EMP-005',
    employeeName: 'Lisa Wang',
    designation: 'Eng Director',
    department: 'Engineering',
    currency: '$',
    basicSalary: 5800,
    effectiveDate: '2024-01-01',
    paySchedule: 'US Regular Monthly Payroll',
    earnings: [
      { componentId: 'sc-1', name: 'Basic Salary', category: 'Earning', amount: 5800, type: 'Fixed' },
      { componentId: 'sc-2', name: 'House Rent Allowance (HRA)', category: 'Earning', amount: 2320, type: '40% Basic' },
      { componentId: 'sc-3', name: 'Conveyance Allowance', category: 'Earning', amount: 800, type: 'Fixed' },
      { componentId: 'sc-4', name: 'Special Allowance', category: 'Earning', amount: 2680, type: 'Fixed' },
    ],
    deductions: [
      { componentId: 'sc-7', name: 'Income Tax (TDS)', category: 'Deduction', amount: 1950, type: 'Statutory' },
      { componentId: 'sc-8', name: '401(k) / Retirement', category: 'Deduction', amount: 696, type: '12% Basic' },
      { componentId: 'sc-9', name: 'Health Insurance', category: 'Deduction', amount: 150, type: 'Fixed' },
    ],
    grossSalary: 11600,
    totalDeductions: 2796,
    netSalary: 8804,
  },
  {
    id: 'ess-5',
    employeeId: 'EMP-009',
    employeeName: 'Nina Garcia',
    designation: 'QA Lead',
    department: 'Engineering',
    currency: '$',
    basicSalary: 4200,
    effectiveDate: '2024-03-01',
    paySchedule: 'US Regular Monthly Payroll',
    earnings: [
      { componentId: 'sc-1', name: 'Basic Salary', category: 'Earning', amount: 4200, type: 'Fixed' },
      { componentId: 'sc-2', name: 'House Rent Allowance (HRA)', category: 'Earning', amount: 1680, type: '40% Basic' },
      { componentId: 'sc-3', name: 'Conveyance Allowance', category: 'Earning', amount: 600, type: 'Fixed' },
      { componentId: 'sc-4', name: 'Special Allowance', category: 'Earning', amount: 1520, type: 'Fixed' },
    ],
    deductions: [
      { componentId: 'sc-7', name: 'Income Tax (TDS)', category: 'Deduction', amount: 1200, type: 'Statutory' },
      { componentId: 'sc-8', name: '401(k) / Retirement', category: 'Deduction', amount: 504, type: '12% Basic' },
      { componentId: 'sc-9', name: 'Health Insurance', category: 'Deduction', amount: 120, type: 'Fixed' },
    ],
    grossSalary: 8000,
    totalDeductions: 1824,
    netSalary: 6176,
  },
];

export const payrollRules: PayrollRule[] = [
  {
    id: 'rule-1',
    name: 'Overtime 1.5x Multiplier',
    version: 'v2.2',
    category: 'Overtime',
    conditionText: 'IF daily_hours > 8 AND day_type == "WEEKDAY"',
    actionText: 'THEN ot_rate = hourly_base_rate * 1.5',
    conditionFormula: 'hours_worked > 8 && shift_type == "standard"',
    actionFormula: 'ot_hours * (base_salary / 160) * 1.5',
    effectiveFrom: '2024-01-01',
    effectiveTo: '2024-12-31',
    region: 'US-CA (California)',
    status: 'Active',
    author: 'Payroll Admin (Alex Morgan)',
  },
  {
    id: 'rule-2',
    name: 'Weekend Double Time (2.0x)',
    version: 'v1.4',
    category: 'Overtime',
    conditionText: 'IF day_type IN ("SATURDAY", "SUNDAY")',
    actionText: 'THEN ot_rate = hourly_base_rate * 2.0',
    conditionFormula: 'is_weekend == true && hours_worked > 0',
    actionFormula: 'ot_hours * (base_salary / 160) * 2.0',
    effectiveFrom: '2024-01-01',
    effectiveTo: '2024-12-31',
    region: 'Global',
    status: 'Active',
    author: 'Alex Morgan',
  },
  {
    id: 'rule-3',
    name: 'Performance Rating Tier Bonus',
    version: 'v3.0',
    category: 'Bonus',
    conditionText: 'IF appraisal_score >= 4.5 AND tenure_months >= 12',
    actionText: 'THEN bonus_amount = monthly_basic * 0.25',
    conditionFormula: 'appraisal_rating >= 4.5 && tenure >= 12',
    actionFormula: 'basic_salary * 0.25',
    effectiveFrom: '2024-06-01',
    effectiveTo: '2025-05-31',
    region: 'All Regions',
    status: 'Active',
    author: 'John Smith (VP HR)',
  },
  {
    id: 'rule-4',
    name: 'Unpaid Leave LOP Deduction',
    version: 'v1.0',
    category: 'Deduction',
    conditionText: 'IF unpaid_leave_days > 0',
    actionText: 'THEN deduction = (monthly_gross / days_in_month) * unpaid_leave_days',
    conditionFormula: 'unpaid_days > 0',
    actionFormula: '(gross_salary / 30) * unpaid_days',
    effectiveFrom: '2023-01-01',
    effectiveTo: '2024-12-31',
    region: 'Global',
    status: 'Active',
    author: 'Alex Morgan',
  },
  {
    id: 'rule-5',
    name: 'Legacy 401(k) Match (Superseded)',
    version: 'v1.0',
    category: 'Tax',
    conditionText: 'IF employee_contrib <= 4%',
    actionText: 'THEN employer_match = employee_contrib * 0.5',
    conditionFormula: 'employee_401k <= 0.04',
    actionFormula: 'employee_401k * 0.5',
    effectiveFrom: '2022-01-01',
    effectiveTo: '2023-12-31',
    region: 'US',
    status: 'Superseded',
    author: 'HR Operations',
  },
];

export const samplePayslip: PayslipData = {
  id: 'ps-emp-001-202408',
  payslipNumber: 'PS-2024-08-001',
  period: 'August 1, 2024 — August 31, 2024',
  payDate: 'August 31, 2024',
  employeeId: 'EMP-001',
  employeeName: 'Sarah Chen',
  department: 'Engineering',
  designation: 'VP Engineering',
  joiningDate: 'March 15, 2019',
  bankName: 'Silicon Valley Bank (SVB / First Citizens)',
  accountNumber: '••••••••4892',
  panOrSsn: 'XXX-XX-9481',
  pfOrUan: 'UAN-9840192841',
  workingDays: 22,
  leavesTaken: 1,
  lossOfPayDays: 0,
  earnings: [
    { label: 'Basic Salary', amount: 7500, ytd: 60000 },
    { label: 'House Rent Allowance (HRA)', amount: 3000, ytd: 24000 },
    { label: 'Conveyance Allowance', amount: 800, ytd: 6400 },
    { label: 'Special Allowance', amount: 3200, ytd: 25600 },
    { label: 'Executive Bonus', amount: 500, ytd: 4000 },
  ],
  deductions: [
    { label: 'Income Tax Withholding (TDS)', amount: 2650, ytd: 21200 },
    { label: '401(k) / Provident Fund', amount: 900, ytd: 7200 },
    { label: 'Health Insurance Premium', amount: 150, ytd: 1200 },
  ],
  grossEarnings: 15000,
  totalDeductions: 3700,
  netPay: 11300,
  netPayInWords: 'Eleven Thousand Three Hundred US Dollars Only',
  ytdGross: 120000,
  ytdTax: 21200,
  ytdNet: 90400,
};

export const sampleFinalSettlementPayslip: PayslipData = {
  id: 'ps-emp-012-settlement',
  payslipNumber: 'FS-2024-08-012',
  period: 'August 1, 2024 — August 15, 2024',
  payDate: 'August 20, 2024',
  employeeId: 'EMP-012',
  employeeName: 'Robert Lee',
  department: 'Engineering',
  designation: 'Senior Software Engineer',
  joiningDate: 'December 01, 2019',
  bankName: 'Chase Bank USA',
  accountNumber: '••••••••1920',
  panOrSsn: 'XXX-XX-1102',
  pfOrUan: 'UAN-1928374619',
  workingDays: 11,
  leavesTaken: 0,
  lossOfPayDays: 0,
  isFinalSettlement: true,
  settlementDetails: {
    lastWorkingDay: '2024-08-15',
    gratuity: 4800,
    leaveEncashment: 3200,
    noticePeriodRecovery: 0,
    severance: 5000,
    assetHandoverClearance: true,
  },
  earnings: [
    { label: 'Pro-rated Basic Salary (15 days)', amount: 3500 },
    { label: 'Pro-rated Allowances', amount: 2200 },
    { label: 'Unused Leave Encashment (12 Days)', amount: 3200 },
    { label: 'Statutory Gratuity (4.5 Yrs Service)', amount: 4800 },
    { label: 'Severance / Transition Pay', amount: 5000 },
  ],
  deductions: [
    { label: 'Final Tax Withholding', amount: 3200 },
    { label: 'PF / 401(k) Recovery', amount: 420 },
    { label: 'Asset Damage / Unreturned Deductions', amount: 0 },
  ],
  grossEarnings: 18700,
  totalDeductions: 3620,
  netPay: 15080,
  netPayInWords: 'Fifteen Thousand Eighty US Dollars Only',
  ytdGross: 84000,
  ytdTax: 16500,
  ytdNet: 64200,
};

export const paymentBatches: PaymentBatch[] = [
  {
    id: 'pb-1',
    batchNumber: 'BATCH-202408-01',
    periodName: 'August 2024 (Monthly)',
    bankName: 'Silicon Valley Bank / First Citizens',
    accountNumber: 'ACCT-98492019',
    generatedDate: '2024-08-30',
    totalEmployees: 142,
    totalAmount: 1079200,
    format: 'NACHA',
    status: 'Settled',
  },
  {
    id: 'pb-2',
    batchNumber: 'BATCH-202408-02',
    periodName: 'August 2024 Special Disbursal',
    bankName: 'Chase Direct ACH',
    accountNumber: 'ACCT-11928401',
    generatedDate: '2024-08-31',
    totalEmployees: 8,
    totalAmount: 42500,
    format: 'ACH Direct',
    status: 'Sent',
  },
  {
    id: 'pb-3',
    batchNumber: 'BATCH-202409-PRE',
    periodName: 'September 2024 Advance Cycle',
    bankName: 'Silicon Valley Bank',
    accountNumber: 'ACCT-98492019',
    generatedDate: '2024-09-02',
    totalEmployees: 12,
    totalAmount: 36000,
    format: 'CSV',
    status: 'Pending',
  },
];

export const paymentItems: PaymentItem[] = [
  {
    id: 'pi-1',
    batchId: 'pb-1',
    employeeId: 'EMP-001',
    employeeName: 'Sarah Chen',
    bankName: 'SVB First Citizens',
    accountNumber: '••••••••4892',
    routingOrIfsc: '021000021',
    amount: 11300,
    currency: '$',
    status: 'Sent',
    referenceNumber: 'TXN-984201948',
  },
  {
    id: 'pi-2',
    batchId: 'pb-1',
    employeeId: 'EMP-002',
    employeeName: 'Marcus Johnson',
    bankName: 'Chase Bank NA',
    accountNumber: '••••••••7731',
    routingOrIfsc: '121000358',
    amount: 10125,
    currency: '$',
    status: 'Sent',
    referenceNumber: 'TXN-984201949',
  },
  {
    id: 'pi-3',
    batchId: 'pb-1',
    employeeId: 'EMP-003',
    employeeName: 'Priya Patel',
    bankName: 'Bank of America',
    accountNumber: '••••••••3319',
    routingOrIfsc: '111000025',
    amount: 9500,
    currency: '$',
    status: 'Sent',
    referenceNumber: 'TXN-984201950',
  },
  {
    id: 'pi-4',
    batchId: 'pb-1',
    employeeId: 'EMP-006',
    employeeName: 'David Kim',
    bankName: 'Wells Fargo',
    accountNumber: '••••••••9012',
    routingOrIfsc: '121000240',
    amount: 8800,
    currency: '$',
    status: 'Failed',
    referenceNumber: 'TXN-984201951',
    errorMessage: 'Invalid Routing Number (Code R03 - Account Not Found)',
  },
  {
    id: 'pi-5',
    batchId: 'pb-1',
    employeeId: 'EMP-010',
    employeeName: 'James Park',
    bankName: 'Citibank NA',
    accountNumber: '••••••••8490',
    routingOrIfsc: '021000089',
    amount: 6800,
    currency: '$',
    status: 'Pending',
    referenceNumber: 'TXN-984201952',
  },
];

export const taxProfiles: TaxProfile[] = [
  {
    id: 'tp-1',
    employeeId: 'EMP-001',
    employeeName: 'Sarah Chen',
    panOrTaxId: 'US-SSN-9481',
    regime: 'US Standard W-4',
    annualBaseSalary: 180000,
    projectedAnnualGross: 180000,
    declaredInvestments: 22500,
    section80C: 19500,
    hraExemption: 12000,
    healthInsurance80D: 3000,
    taxableIncome: 142500,
    annualTaxLiability: 31800,
    monthlyTds: 2650,
    taxBracket: '24% Marginal Slab',
    status: 'Verified',
  },
  {
    id: 'tp-2',
    employeeId: 'EMP-002',
    employeeName: 'Marcus Johnson',
    panOrTaxId: 'US-SSN-7731',
    regime: 'US Standard W-4',
    annualBaseSalary: 165000,
    projectedAnnualGross: 165000,
    declaredInvestments: 18000,
    section80C: 15000,
    hraExemption: 10000,
    healthInsurance80D: 2500,
    taxableIncome: 134500,
    annualTaxLiability: 28200,
    monthlyTds: 2350,
    taxBracket: '24% Marginal Slab',
    status: 'Verified',
  },
  {
    id: 'tp-3',
    employeeId: 'EMP-003',
    employeeName: 'Priya Patel',
    panOrTaxId: 'US-SSN-3319',
    regime: 'New Regime (2024)',
    annualBaseSalary: 150000,
    projectedAnnualGross: 150000,
    declaredInvestments: 12000,
    section80C: 10000,
    hraExemption: 8000,
    healthInsurance80D: 2000,
    taxableIncome: 128000,
    annualTaxLiability: 25200,
    monthlyTds: 2100,
    taxBracket: '22% Marginal Slab',
    status: 'Pending Verification',
  },
];

export const benefitPlans: BenefitPlan[] = [
  {
    id: 'bp-1',
    name: 'Comprehensive Health & Dental (Gold)',
    category: 'Health Insurance',
    provider: 'Blue Cross Blue Shield',
    planTier: 'Gold',
    employerContribution: '85% ($850/mo)',
    employeeContribution: '$150/mo',
    coverageLimit: '$2,000,000 In-Network',
    enrolledCount: 118,
    description: 'Comprehensive medical, dental, vision coverage with low deductible ($500).',
    status: 'Active',
  },
  {
    id: 'bp-2',
    name: 'Premier Executive Health Plan (Platinum)',
    category: 'Health Insurance',
    provider: 'Kaiser Permanente',
    planTier: 'Platinum',
    employerContribution: '100% ($1,200/mo)',
    employeeContribution: '$0/mo',
    coverageLimit: '$5,000,000 Global',
    enrolledCount: 24,
    description: 'Zero deductible executive plan with international emergency cover.',
    status: 'Active',
  },
  {
    id: 'bp-3',
    name: '401(k) Retirement Savings & Match',
    category: 'Retirement 401(k)',
    provider: 'Fidelity Investments',
    planTier: 'Custom',
    employerContribution: '100% Match up to 6% Basic',
    employeeContribution: 'Voluntary (Up to $23,000)',
    coverageLimit: 'IRS Annual Maximum',
    enrolledCount: 136,
    description: 'Tax-deferred and Roth 401(k) investment portfolios with auto-rebalancing.',
    status: 'Open Enrollment',
  },
  {
    id: 'bp-4',
    name: 'Group Term Life Insurance',
    category: 'Life Insurance',
    provider: 'MetLife',
    planTier: 'Gold',
    employerContribution: '100% ($60/mo)',
    employeeContribution: '$0/mo',
    coverageLimit: '3x Annual Base Salary',
    enrolledCount: 142,
    description: 'Life insurance and accidental death & dismemberment (AD&D) protection.',
    status: 'Active',
  },
  {
    id: 'bp-5',
    name: 'Wellness & Gym Reimbursement',
    category: 'Wellness',
    provider: 'Gympass / Wellhub',
    planTier: 'Silver',
    employerContribution: '$75 / month credit',
    employeeContribution: '$25 / month',
    coverageLimit: 'Access to 10,000+ studios',
    enrolledCount: 89,
    description: 'Monthly subsidy for gym memberships, fitness apps, and mental health counseling.',
    status: 'Active',
  },
];

export const loanRecords: LoanRecord[] = [
  {
    id: 'loan-1',
    loanId: 'LN-2024-001',
    employeeId: 'EMP-002',
    employeeName: 'Marcus Johnson',
    loanType: 'Home / Relocation',
    principalAmount: 6000,
    interestRate: 2.5,
    tenorMonths: 12,
    monthlyEmi: 512,
    disbursedDate: '2024-03-01',
    repaidAmount: 3072,
    remainingBalance: 2928,
    installmentsPaid: 6,
    installmentsTotal: 12,
    deductFromPayroll: true,
    status: 'Active',
  },
  {
    id: 'loan-2',
    loanId: 'LN-2024-002',
    employeeId: 'EMP-015',
    employeeName: 'Daniel Cho',
    loanType: 'Emergency Advance',
    principalAmount: 2000,
    interestRate: 0,
    tenorMonths: 4,
    monthlyEmi: 500,
    disbursedDate: '2024-07-01',
    repaidAmount: 1000,
    remainingBalance: 1000,
    installmentsPaid: 2,
    installmentsTotal: 4,
    deductFromPayroll: true,
    status: 'Active',
  },
  {
    id: 'loan-3',
    loanId: 'LN-2024-003',
    employeeId: 'EMP-010',
    employeeName: 'James Park',
    loanType: 'Device Purchase',
    principalAmount: 1800,
    interestRate: 0,
    tenorMonths: 6,
    monthlyEmi: 300,
    disbursedDate: '2024-08-01',
    repaidAmount: 300,
    remainingBalance: 1500,
    installmentsPaid: 1,
    installmentsTotal: 6,
    deductFromPayroll: true,
    status: 'Active',
  },
  {
    id: 'loan-4',
    loanId: 'LN-2024-004',
    employeeId: 'EMP-007',
    employeeName: 'Emma Wilson',
    loanType: 'Education Assistance',
    principalAmount: 4500,
    interestRate: 1.5,
    tenorMonths: 10,
    monthlyEmi: 456,
    disbursedDate: '2024-08-20',
    repaidAmount: 0,
    remainingBalance: 4500,
    installmentsPaid: 0,
    installmentsTotal: 10,
    deductFromPayroll: true,
    status: 'Pending Approval',
  },
];

export const expenseClaims: ExpenseClaim[] = [
  {
    id: 'exp-1',
    claimId: 'EXP-2024-101',
    employeeId: 'EMP-002',
    employeeName: 'Marcus Johnson',
    category: 'Meals & Entertainment',
    amount: 485.50,
    currency: '$',
    date: '2024-08-22',
    description: 'Client dinner with Acme Partner procurement team in NYC.',
    receiptName: 'dinner_receipt_aug22.pdf',
    receiptSize: '1.2 MB',
    approvalStage: 'Finance Approved',
    status: 'Approved for Payroll',
    approvedByManager: 'Sarah Chen (Aug 23)',
    approvedByFinance: 'Alex Morgan (Aug 24)',
  },
  {
    id: 'exp-2',
    claimId: 'EXP-2024-102',
    employeeId: 'EMP-005',
    employeeName: 'Lisa Wang',
    category: 'Software & Subscriptions',
    amount: 240.00,
    currency: '$',
    date: '2024-08-24',
    description: 'Annual JetBrains IDE team license renewal for frontend leads.',
    receiptName: 'jetbrains_invoice_inv981.pdf',
    receiptSize: '450 KB',
    approvalStage: 'Manager Approved',
    status: 'Pending Finance',
    approvedByManager: 'Sarah Chen (Aug 25)',
  },
  {
    id: 'exp-3',
    claimId: 'EXP-2024-103',
    employeeId: 'EMP-009',
    employeeName: 'Nina Garcia',
    category: 'Travel & Accommodation',
    amount: 1120.00,
    currency: '$',
    date: '2024-08-20',
    description: 'Flight and 2-night hotel for QA Summit Chicago 2024.',
    receiptName: 'flight_hotel_chicago.pdf',
    receiptSize: '2.8 MB',
    approvalStage: 'Employee Submitted',
    status: 'Pending Manager',
  },
  {
    id: 'exp-4',
    claimId: 'EXP-2024-104',
    employeeId: 'EMP-008',
    employeeName: 'Tom Anderson',
    category: 'Training & Certifications',
    amount: 650.00,
    currency: '$',
    date: '2024-08-15',
    description: 'HubSpot Inbound Marketing Master Certification exam fee.',
    receiptName: 'hubspot_cert_receipt.pdf',
    receiptSize: '620 KB',
    approvalStage: 'Reimbursed',
    status: 'Reimbursed',
    approvedByManager: 'Priya Patel (Aug 16)',
    approvedByFinance: 'Alex Morgan (Aug 18)',
  },
];

export const billingPlans: BillingPlan[] = [
  {
    id: 'plan-free',
    name: 'Free Starter',
    pricePerUser: 0,
    billingFrequency: 'monthly',
    description: 'Essential HR & Employee Directory for startups under 15 employees.',
    features: [
      { name: 'Up to 15 Active Employees', included: true },
      { name: 'Employee Directory & Org Chart', included: true },
      { name: 'Basic Leave & Holiday Calendar', included: true },
      { name: 'Standard Payroll Run (1 Schedule)', included: true },
      { name: 'Custom Formula Engine', included: false },
      { name: 'Biometric & Geofence Capture', included: false },
      { name: 'Direct Bank NACHA & SEPA Transfer', included: false },
      { name: 'Dedicated Support & SLA', included: false },
    ],
  },
  {
    id: 'plan-starter',
    name: 'Growth',
    pricePerUser: 4,
    billingFrequency: 'monthly',
    description: 'Designed for fast growing businesses scaling from 15 to 100 staff.',
    features: [
      { name: 'Up to 100 Active Employees', included: true },
      { name: 'Employee Directory & Documents', included: true },
      { name: 'Time & Attendance with Geofencing', included: true },
      { name: 'Multi-Schedule Automated Payroll', included: true },
      { name: 'Tax Profile & TDS Slabs', included: true },
      { name: 'Custom Formula Engine', included: false },
      { name: 'Direct Bank NACHA & SEPA Transfer', included: true },
      { name: 'Dedicated Support & SLA', included: false },
    ],
  },
  {
    id: 'plan-business',
    name: 'Business Pro',
    pricePerUser: 8,
    billingFrequency: 'monthly',
    popular: true,
    description: 'Complete HRMS, advanced visual formula rules, and automated payouts.',
    features: [
      { name: 'Up to 1,000 Active Employees', included: true },
      { name: 'Full Recruitment ATS & Onboarding', included: true },
      { name: 'Advanced Geofence & Device Control', included: true },
      { name: 'Visual Formula & Rules Engine', included: true },
      { name: 'Multi-Country Tax & Superannuation', included: true },
      { name: 'Loans, Advances & Expense Pipeline', included: true },
      { name: 'NACHA / SEPA / Bank Batch Files', included: true },
      { name: 'Priority 24/7 Support', included: true },
    ],
  },
  {
    id: 'plan-enterprise',
    name: 'Enterprise Suite',
    pricePerUser: 14,
    billingFrequency: 'monthly',
    description: 'Unlimited capacity, bespoke integrations, dedicated account manager.',
    features: [
      { name: 'Unlimited Employees & Sub-entities', included: true },
      { name: 'Multi-Tenant Architecture', included: true },
      { name: 'Custom Payroll API & Webhooks', included: true },
      { name: 'Full Audit Trail & SOC2 Compliance', included: true },
      { name: 'Dedicated Infrastructure & SSO (SAML)', included: true },
      { name: 'Custom Formula Builder & Sandboxes', included: true },
      { name: 'Custom Bank Transfer Formats', included: true },
      { name: 'Dedicated Customer Success Manager', included: true },
    ],
  },
];

export const tenantBillings: TenantBilling[] = [
  {
    id: 'tb-1',
    companyName: 'Acme Corporation (Current Tenant)',
    domain: 'acme.com',
    plan: 'Business',
    seats: 142,
    mrr: 1136,
    paymentMethod: 'Visa •••• 4242',
    nextBillingDate: '2024-09-15',
    lastInvoiceAmount: 1136,
    status: 'Paid',
  },
  {
    id: 'tb-2',
    companyName: 'Globex Innovations',
    domain: 'globex.io',
    plan: 'Enterprise',
    seats: 480,
    mrr: 6720,
    paymentMethod: 'ACH Direct Debit',
    nextBillingDate: '2024-09-01',
    lastInvoiceAmount: 6720,
    status: 'Paid',
  },
  {
    id: 'tb-3',
    companyName: 'Initech Logistics',
    domain: 'initech.net',
    plan: 'Starter',
    seats: 64,
    mrr: 256,
    paymentMethod: 'Mastercard •••• 8821',
    nextBillingDate: '2024-09-20',
    lastInvoiceAmount: 256,
    status: 'Paid',
  },
  {
    id: 'tb-4',
    companyName: 'Stark Industries UK',
    domain: 'starkindustries.co.uk',
    plan: 'Enterprise',
    seats: 850,
    mrr: 11900,
    paymentMethod: 'Wire Transfer / Invoice',
    nextBillingDate: '2024-08-28',
    lastInvoiceAmount: 11900,
    status: 'Pending',
  },
  {
    id: 'tb-5',
    companyName: 'Hooli Cloud Labs',
    domain: 'hooli.xyz',
    plan: 'Business',
    seats: 210,
    mrr: 1680,
    paymentMethod: 'Amex •••• 1002',
    nextBillingDate: '2024-08-10',
    lastInvoiceAmount: 1680,
    status: 'Past Due',
  },
];

