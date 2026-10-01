import type { PayrollRunStatus } from '@hrm/shared-types';
import type { StatusPillTone } from '@/components/ui/StatusPill';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const employees = (n: number) => plural(n, 'employee');

/**
 * User-facing strings for the payroll period and pay run screens.
 * Kept in one catalogue so they can move into the i18n layer without touching components.
 */
export const payrollRunsCopy = {
  status: {
    draft: 'Draft',
    calculated: 'Calculated',
    under_review: 'Under review',
    approved: 'Approved',
    finalized: 'Finalized',
    paid: 'Paid',
    cancelled: 'Cancelled',
  } satisfies Record<PayrollRunStatus, string>,
  statusTone: {
    draft: 'warning',
    calculated: 'warning',
    under_review: 'accent',
    approved: 'success',
    finalized: 'success',
    paid: 'success',
    cancelled: 'neutral',
  } satisfies Record<PayrollRunStatus, StatusPillTone>,
  statusHint: {
    draft: 'Added, not calculated yet',
    calculated: 'Pay worked out, ready to submit',
    under_review: 'Waiting for approval',
    approved: 'Ready to finalize',
    finalized: 'Locked, payslips issued',
    paid: 'Payment recorded',
    cancelled: 'Not paid this period',
  } satisfies Record<PayrollRunStatus, string>,

  periods: {
    title: 'Pay Runs',
    description:
      'Create a payroll period, add employees and calculate their pay, then take it through review, approval and finalization. Finalized pay is locked.',
    create: 'New payroll period',
    colPeriod: 'Period',
    colPayment: 'Payment date',
    colEmployees: 'Employees',
    colNet: 'Total net pay',
    colStatus: 'Status',
    notStarted: 'No employees yet',
    mixed: 'and later steps',
    locked: 'Locked',
    emptyTitle: 'No payroll periods yet',
    emptyDescription: 'Create a period for the month you want to pay, then add employees and calculate their pay.',
    emptyAction: 'Create your first period',
    loadError: 'Could not load payroll periods.',
    created: (label: string) => `Payroll period ${label} created. Add employees to start the pay run.`,
  },

  periodForm: {
    createTitle: 'New payroll period',
    editTitle: 'Edit payroll period',
    description: 'The dates this payroll covers and when employees are paid.',
    month: 'Month',
    customDates: 'Use custom dates instead of a calendar month',
    startDate: 'Start date',
    endDate: 'End date',
    paymentDate: 'Payment date',
    paymentHint: 'The day employees receive this pay.',
    calendarMonthHint: (month: string) =>
      `Attendance-based pay (daily and hourly rates, overtime, unpaid leave) is worked out on the calendar month of the end date — ${month}. Use a full calendar month to keep them aligned.`,
    overlap: (periods: string) =>
      `Overlaps with ${periods}. Employees already in a pay run there are skipped when you add employees here, so nobody is paid twice for the same days.`,
    datesLocked: 'Pay has been calculated for this period, so only the payment date can change.',
    create: 'Create period',
    save: 'Save changes',
    saved: 'Payroll period updated.',
    errors: {
      dateRequired: 'Choose a date.',
      endBeforeStart: 'The end date must be on or after the start date.',
      paymentBeforeStart: 'The payment date must be on or after the start date.',
    },
  },

  detail: {
    back: 'All pay runs',
    notFound: 'This payroll period doesn’t exist or belongs to another company.',
    loadError: 'Could not load this pay run.',
    paidOn: (date: string) => `Payment date ${date}`,
    edit: 'Edit dates',
    flowTitle: 'Status flow',
    flowHint: 'Each employee moves through these steps. Act on a whole step here, or select employees in the table.',
    cancelledCount: (n: number) => `${plural(n, 'run')} cancelled`,
    statEmployees: 'Employees',
    statGross: 'Total gross',
    statDeductions: 'Total deductions',
    statNet: 'Total net pay',
    statCurrency: (currency: string) => `in ${currency}`,
    lockedBanner:
      'Finalized pay is locked: payslips have been issued and figures can’t be edited. Corrections are made as adjustments in a later payroll.',
    zeroNet: (n: number) =>
      `${employees(n)} ${n === 1 ? 'has' : 'have'} zero net pay. Check their salary structure and attendance before approving.`,
    addEmployees: 'Add employees',
    addMissing: 'Add missing employees',
    noRunsTitle: 'No employees in this pay run yet',
    noRunsDescription:
      'Add employees to create a draft run for everyone active with a salary structure in this period. Then calculate their pay.',
  },

  actions: {
    calculate: (n: number) => `Calculate ${n}`,
    recalculate: (n: number) => `Recalculate ${n}`,
    submit: (n: number) => `Submit ${n} for review`,
    approve: (n: number) => `Approve ${n}`,
    finalize: (n: number) => `Finalize ${n}`,
    pay: (n: number) => `Mark ${n} as paid`,
    sendBack: (n: number, to: string) => `Send ${n} back to ${to.toLowerCase()}`,
    cancel: (n: number) => `Cancel ${n}`,
    one: {
      calculate: 'Calculate',
      recalculate: 'Recalculate',
      submit: 'Submit for review',
      approve: 'Approve',
      finalize: 'Finalize',
      pay: 'Mark as paid',
      sendBack: (to: string) => `Send back to ${to.toLowerCase()}`,
      cancel: 'Cancel this run',
    },
    more: (step: string) => `More actions for ${step.toLowerCase()}`,
    viewBreakdown: 'View breakdown',
    openPayslip: 'Open payslip',
  },

  table: {
    title: 'Employees',
    colEmployee: 'Employee',
    colStatus: 'Status',
    colGross: 'Gross',
    colDeductions: 'Deductions',
    colNet: 'Net pay',
    searchPlaceholder: 'Search name or ID…',
    allStatuses: 'All statuses',
    selectAll: 'Select all shown',
    selectRow: (name: string) => `Select ${name}`,
    selected: (n: number) => `${n} selected`,
    mixedSelection: 'Select employees in the same status to act on them together.',
    clearSelection: 'Clear selection',
    noMatchTitle: 'No employees match',
    noMatchDescription: 'Try a different search or status.',
    clearFilters: 'Clear filters',
    lockedRow: 'Finalized pay is locked',
    otherCurrency: (currency: string) => `Paid in ${currency}`,
    notCalculated: 'Not calculated',
  },

  results: {
    generated: (created: number) =>
      created === 0 ? 'No new employees were added.' : `${employees(created)} added as drafts. Calculate their pay next.`,
    alreadyIncluded: (n: number) => `${employees(n)} already in this pay run.`,
    withoutStructureTitle: (n: number) => `${employees(n)} skipped — no salary structure in this period`,
    overlapTitle: (n: number) => `${employees(n)} skipped — already in an overlapping pay run`,
    overlapItem: (name: string, period: string) => `${name} (${period})`,
    calculated: (n: number) => `Pay calculated for ${employees(n)}.`,
    transitioned: (n: number, status: string) => `${employees(n)} moved to ${status.toLowerCase()}.`,
    failuresTitle: (n: number) => `${employees(n)} could not be processed`,
    dismiss: 'Dismiss',
  },

  confirm: {
    titles: {
      approve: 'Approve payroll?',
      finalize: 'Finalize payroll?',
      pay: 'Mark payroll as paid?',
      cancel: 'Cancel these pay runs?',
      recalculate: 'Recalculate pay?',
    },
    intros: {
      approve: 'Approving confirms these figures are correct. Finalizing is a separate step.',
      finalize:
        'Finalizing locks this pay. It can’t be edited afterwards — corrections are made as adjustments in a later payroll.',
      pay: 'Records that these employees have received this pay. This can’t be undone.',
      cancel: 'These employees won’t be paid in this period. You can add them again later.',
      recalculate: (n: number) =>
        `${employees(n)} under review will go back to Calculated and need to be reviewed again.`,
    },
    summaryPeriod: 'Pay period',
    summaryPayment: 'Payment date',
    summaryEmployees: 'Employees',
    summaryGross: 'Total gross',
    summaryDeductions: 'Total deductions',
    summaryNet: 'Total net pay',
    currencyNote: (currency: string) =>
      `Totals in ${currency}. Employees paid in another currency are converted at the period-end rate.`,
    excluded: (n: number) => `${employees(n)} in other steps ${n === 1 ? 'is' : 'are'} not included.`,
    employeesList: 'Included employees',
    finalizeEffects: [
      'Each employee’s payslip is generated and they are notified.',
      'Loan installments due in this period are marked as repaid.',
      'The payroll is sent to accounting if an integration is connected.',
      'Later salary changes covering this period become retroactive adjustments.',
    ],
    acknowledge: {
      finalize: 'I have checked the figures and understand finalized payroll is locked.',
      pay: 'I confirm these employees have been paid.',
    },
    stale: 'The payroll changed since you opened this review. The figures below have been refreshed — check them again before confirming.',
    staleNothingLeft:
      'The payroll changed since you opened that review, and none of those employees are in that step any more. Nothing was changed.',
  },

  breakdown: {
    title: (name: string) => name,
    description: (number: string, period: string) => `${number} · ${period}`,
    snapshot: 'As calculated for this pay run.',
    liveDraft: 'Not calculated yet. This is an estimate from current salary structures and attendance.',
    liveLegacy:
      'This run was calculated before breakdowns were stored. The lines below are recalculated now and may differ from the stored totals.',
    mismatch: (stored: string, live: string) => `Stored net pay is ${stored}; recalculating now gives ${live}.`,
    currency: (pay: string, base: string, rate: string, date: string) =>
      `Paid in ${pay}. Converted to ${base} at ${rate} (rate on ${date}).`,
    employerSuper: (amount: string, scheme: string) =>
      `Employer ${scheme} contribution ${amount} (paid by the company, not deducted).`,
    finalizedAt: (date: string) => `Finalized ${date}`,
    error: 'Could not load the breakdown.',
    close: 'Close',
  },
} as const;
