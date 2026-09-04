import type { ReportDefinition } from '@hrm/shared-types';

export const REPORT_CATALOG: ReportDefinition[] = [
  {
    id: 'payroll.employee-summary',
    category: 'payroll',
    title: 'Employee Payroll Summary',
    description: 'Per-employee gross, deductions, and net pay for the selected period.',
  },
  {
    id: 'payroll.activity-summary',
    category: 'payroll',
    title: 'Payroll Activity Summary',
    description: 'Payroll run counts and totals by status across the period.',
  },
  {
    id: 'payroll.superannuation-summary',
    category: 'payroll',
    title: 'Superannuation Summary',
    description: 'Employee and employer super contributions by payroll run.',
  },
  {
    id: 'payroll.register',
    category: 'payroll',
    title: 'Payroll Register',
    description: 'Detailed payroll register listing every run in the period.',
  },
  {
    id: 'payroll.salary-summary',
    category: 'payroll',
    title: 'Salary Summary',
    description: 'Department-level salary totals from finalized payroll runs.',
  },
  {
    id: 'payroll.earnings',
    category: 'payroll',
    title: 'Earnings Report',
    description: 'Gross earnings by employee from payroll runs in the period.',
  },
  {
    id: 'payroll.deductions',
    category: 'payroll',
    title: 'Deductions Report',
    description: 'Total deductions by employee from payroll runs in the period.',
  },
  {
    id: 'payroll.tax',
    category: 'payroll',
    title: 'Tax Report',
    description: 'Tax identifiers and withheld amounts from employee tax profiles and payroll.',
  },
  {
    id: 'payroll.overtime',
    category: 'payroll',
    title: 'Payroll Overtime Report',
    description: 'Overtime-related earnings inferred from payroll gross totals.',
  },
  {
    id: 'payroll.variance',
    category: 'payroll',
    title: 'Payroll Variance Report',
    description: 'Month-over-month net pay variance by employee between consecutive periods.',
  },
  {
    id: 'payroll.payment',
    category: 'payroll',
    title: 'Payment Report',
    description: 'Payment batch status, amounts, and employee disbursements.',
  },
  {
    id: 'attendance.daily',
    category: 'attendance',
    title: 'Daily Attendance Report',
    description: 'One row per employee per day with status and clock times.',
  },
  {
    id: 'attendance.monthly',
    category: 'attendance',
    title: 'Monthly Attendance Summary',
    description: 'Aggregated present, absent, and leave days per employee for the period.',
  },
  {
    id: 'attendance.late',
    category: 'attendance',
    title: 'Late Arrival Report',
    description: 'Employees with late clock-ins during the period.',
  },
  {
    id: 'attendance.early-leave',
    category: 'attendance',
    title: 'Early Leave Report',
    description: 'Employees who left before scheduled shift end.',
  },
  {
    id: 'attendance.absence',
    category: 'attendance',
    title: 'Absence Report',
    description: 'Absent attendance records in the selected date range.',
  },
  {
    id: 'attendance.working-hours',
    category: 'attendance',
    title: 'Working Hours Report',
    description: 'Total worked hours per employee based on clock in/out and breaks.',
  },
  {
    id: 'attendance.overtime',
    category: 'attendance',
    title: 'Attendance Overtime Report',
    description: 'Days where worked hours exceeded standard shift duration.',
  },
  {
    id: 'attendance.break',
    category: 'attendance',
    title: 'Break Report',
    description: 'Break start/end times and total break minutes per attendance day.',
  },
  {
    id: 'attendance.exception',
    category: 'attendance',
    title: 'Attendance Exception Report',
    description: 'Time anomalies, geofence mismatches, and pending manager reviews.',
  },
  {
    id: 'hr.headcount',
    category: 'hr',
    title: 'Headcount Report',
    description: 'Active employee counts by department and employment type.',
  },
  {
    id: 'hr.new-hires',
    category: 'hr',
    title: 'New Hires Report',
    description: 'Employees hired within the selected date range.',
  },
  {
    id: 'hr.terminations',
    category: 'hr',
    title: 'Terminations Report',
    description: 'Termination and resignation lifecycle events in the period.',
  },
  {
    id: 'hr.turnover',
    category: 'hr',
    title: 'Turnover Report',
    description: 'Turnover rate by department based on terminations vs headcount.',
  },
  {
    id: 'hr.demographics',
    category: 'hr',
    title: 'Demographics Report',
    description: 'Workforce breakdown by gender and nationality from employee profiles.',
  },
  {
    id: 'hr.department-summary',
    category: 'hr',
    title: 'Department Summary',
    description: 'Employee distribution and status counts by department.',
  },
  {
    id: 'hr.employment-type-summary',
    category: 'hr',
    title: 'Employment Type Summary',
    description: 'Headcount grouped by employment type.',
  },
  {
    id: 'hr.expiry',
    category: 'hr',
    title: 'Document & Contract Expiry',
    description: 'Documents and contracts expiring within the report window.',
  },
  {
    id: 'hr.probation-ending',
    category: 'hr',
    title: 'Probation Ending Report',
    description: 'Employees whose probation ends in the selected period.',
  },
];

export const REPORT_IDS = new Set(REPORT_CATALOG.map((report) => report.id));

export function findReportDefinition(reportId: string): ReportDefinition | undefined {
  return REPORT_CATALOG.find((report) => report.id === reportId);
}
