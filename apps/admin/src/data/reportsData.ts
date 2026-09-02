export interface ReportCardItem {
  id: string;
  title: string;
  category: 'Payroll' | 'Attendance' | 'HR & People';
  description: string;
  chartType: 'line' | 'bar' | 'donut';
  chartData: { label: string; value: number; color?: string }[];
  scheduleFrequency: string;
  lastGenerated: string;
  format: 'PDF' | 'Excel' | 'CSV';
}

export interface ScheduledReport {
  id: string;
  reportName: string;
  category: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly';
  recipients: string[];
  nextRun: string;
  format: 'PDF' | 'Excel' | 'CSV';
  status: 'Active' | 'Paused';
}

export interface ExportTemplate {
  id: string;
  entity: string;
  description: string;
  recordCount: number;
  availableFormats: ('CSV' | 'Excel' | 'JSON')[];
  lastExported: string;
}

export const reportCards: ReportCardItem[] = [
  {
    id: 'rep-1',
    title: 'Monthly Salary & Variance Report',
    category: 'Payroll',
    description: 'Itemized department-level gross pay, deductions, tax withholding, and month-over-month variances.',
    chartType: 'bar',
    chartData: [
      { label: 'May', value: 1320 },
      { label: 'Jun', value: 1360 },
      { label: 'Jul', value: 1390 },
      { label: 'Aug', value: 1420 },
    ],
    scheduleFrequency: 'Monthly (Last day)',
    lastGenerated: 'Aug 30, 2024',
    format: 'Excel',
  },
  {
    id: 'rep-2',
    title: 'Attendance, Tardiness & LOP Analysis',
    category: 'Attendance',
    description: 'Employee clock-in punctuality trends, shift compliance, and Loss of Pay (LOP) impact.',
    chartType: 'line',
    chartData: [
      { label: 'W1', value: 96 },
      { label: 'W2', value: 94 },
      { label: 'W3', value: 98 },
      { label: 'W4', value: 95 },
    ],
    scheduleFrequency: 'Weekly (Every Mon)',
    lastGenerated: 'Aug 26, 2024',
    format: 'PDF',
  },
  {
    id: 'rep-3',
    title: 'Headcount & Diversity Metrics',
    category: 'HR & People',
    description: 'Workforce distribution across departments, seniority levels, gender ratio, and tenure.',
    chartType: 'donut',
    chartData: [
      { label: 'Engineering', value: 420, color: '#2563eb' },
      { label: 'Sales', value: 280, color: '#16a34a' },
      { label: 'Marketing', value: 145, color: '#f59e0b' },
      { label: 'Operations', value: 210, color: '#8b5cf6' },
      { label: 'Others', value: 229, color: '#06b6d4' },
    ],
    scheduleFrequency: 'Monthly (1st of month)',
    lastGenerated: 'Aug 01, 2024',
    format: 'PDF',
  },
  {
    id: 'rep-4',
    title: 'Statutory Tax (TDS) & 401(k) Liability',
    category: 'Payroll',
    description: 'Federal and state tax withholdings, employer matching contributions, and filing summaries.',
    chartType: 'bar',
    chartData: [
      { label: 'Q1', value: 280 },
      { label: 'Q2', value: 310 },
      { label: 'Q3', value: 340 },
    ],
    scheduleFrequency: 'Quarterly',
    lastGenerated: 'Jul 15, 2024',
    format: 'Excel',
  },
  {
    id: 'rep-5',
    title: 'Leave Utilization & Accrual Burn Rate',
    category: 'Attendance',
    description: 'Annual leave balances, sick leave spikes, and year-end carry-forward projections.',
    chartType: 'line',
    chartData: [
      { label: 'Q1', value: 45 },
      { label: 'Q2', value: 72 },
      { label: 'Q3', value: 110 },
      { label: 'Q4', value: 180 },
    ],
    scheduleFrequency: 'Monthly',
    lastGenerated: 'Aug 25, 2024',
    format: 'PDF',
  },
  {
    id: 'rep-6',
    title: 'Recruitment Funnel & Time-to-Hire',
    category: 'HR & People',
    description: 'Applicant conversion rates, stage bottlenecks, candidate ratings, and cost per hire.',
    chartType: 'bar',
    chartData: [
      { label: 'Applied', value: 450 },
      { label: 'Screen', value: 180 },
      { label: 'Interview', value: 45 },
      { label: 'Offer', value: 12 },
    ],
    scheduleFrequency: 'Bi-Weekly',
    lastGenerated: 'Aug 22, 2024',
    format: 'PDF',
  },
];

export const scheduledReports: ScheduledReport[] = [
  {
    id: 'sr-1',
    reportName: 'Monthly Executive Payroll Summary',
    category: 'Payroll',
    frequency: 'Monthly',
    recipients: ['cfo@acme.com', 'vp.hr@acme.com', 'finance.team@acme.com'],
    nextRun: '2024-08-31 23:59',
    format: 'Excel',
    status: 'Active',
  },
  {
    id: 'sr-2',
    reportName: 'Weekly Attendance Anomalies & Overtime',
    category: 'Attendance',
    frequency: 'Weekly',
    recipients: ['dept.managers@acme.com', 'hr.ops@acme.com'],
    nextRun: '2024-09-02 08:00',
    format: 'PDF',
    status: 'Active',
  },
  {
    id: 'sr-3',
    reportName: 'Quarterly Diversity & Retention Report',
    category: 'HR & People',
    frequency: 'Quarterly',
    recipients: ['board@acme.com', 'ceo@acme.com'],
    nextRun: '2024-09-30 09:00',
    format: 'PDF',
    status: 'Active',
  },
  {
    id: 'sr-4',
    reportName: 'Weekly Expense Reimbursement Batch',
    category: 'Payroll',
    frequency: 'Weekly',
    recipients: ['accounts.payable@acme.com'],
    nextRun: '2024-09-06 17:00',
    format: 'CSV',
    status: 'Paused',
  },
];

export const exportTemplates: ExportTemplate[] = [
  {
    id: 'et-1',
    entity: 'Employee Master Database',
    description: 'Complete personal, contractual, compensation, and departmental profiles of active & former staff.',
    recordCount: 1284,
    availableFormats: ['CSV', 'Excel', 'JSON'],
    lastExported: '2024-08-25 14:12',
  },
  {
    id: 'et-2',
    entity: 'Payroll Ledger & YTD Records',
    description: 'Historical gross-to-net calculations, tax withholdings, bonuses, and payment transaction IDs.',
    recordCount: 14200,
    availableFormats: ['CSV', 'Excel'],
    lastExported: '2024-08-30 18:00',
  },
  {
    id: 'et-3',
    entity: 'Time & Attendance Raw Logs',
    description: 'Daily clock-in, clock-out, GPS coordinates, geofence validations, and shift schedules.',
    recordCount: 38400,
    availableFormats: ['CSV', 'JSON'],
    lastExported: '2024-08-26 09:30',
  },
  {
    id: 'et-4',
    entity: 'Leave Requests & Balance Statements',
    description: 'Accrual histories, approved/rejected leaves, encashments, and holiday calendars.',
    recordCount: 2450,
    availableFormats: ['CSV', 'Excel'],
    lastExported: '2024-08-20 11:45',
  },
  {
    id: 'et-5',
    entity: 'Expense & Reimbursement Invoices',
    description: 'Approved claims, receipt links, categories, payment batches, and approval timestamps.',
    recordCount: 890,
    availableFormats: ['CSV', 'Excel'],
    lastExported: '2024-08-15 16:20',
  },
];

