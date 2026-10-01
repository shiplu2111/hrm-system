/**
 * User-facing strings for the payroll simulator (PAYROLL_LOGIC.md §8).
 * Kept in one catalogue so they can move into the i18n layer without touching components.
 */
export const simulationCopy = {
  eyebrow: 'Payroll · Simulation',
  title: 'Payroll Simulator',
  description:
    'Try “what if” changes to one employee’s salary or attendance and see the projected pay. Nothing here touches real payroll.',
  banner: {
    label: 'Simulation',
    title: 'What-if mode — nothing on this page is saved, approved or paid.',
    body: 'Figures are projections for planning only. Real pay comes from pay runs.',
    goToRuns: 'Go to real pay runs',
  },

  setup: {
    employee: 'Employee',
    chooseEmployee: 'Choose an employee…',
    loadError: 'Could not load employees and pay components.',
    asOf: 'Calculate as of',
    asOfHint: (month: string) =>
      `Uses salary structures in effect on this date and attendance recorded for ${month}.`,
    noEmployeesTitle: 'No employees to simulate',
    noEmployeesDescription: 'Add employees and give them a salary structure first.',
    selectTitle: 'Choose an employee to start',
    selectDescription: 'Their current pay is loaded as the starting point; change anything to see the projected effect.',
    reset: 'Reset all changes',
    changes: (n: number) => (n === 0 ? 'No changes yet' : `${n} ${n === 1 ? 'change' : 'changes'}`),
  },

  lines: {
    title: 'Pay lines',
    hint: 'Leave a field blank to keep the current value.',
    empty: 'This employee has no salary structure on this date. Add a component below to model one.',
    current: (value: string) => `Current: ${value}`,
    amount: 'Amount',
    ratePerDay: 'Rate per day',
    ratePerHour: 'Rate per hour',
    percentage: 'Percentage',
    formula: 'Worked out by its formula from the other figures.',
    remove: (name: string) => `Leave ${name} out of the simulation`,
    restore: (name: string) => `Put ${name} back`,
    removed: 'Left out',
    added: 'Hypothetical',
    removeAdded: (name: string) => `Remove hypothetical ${name}`,
    addTitle: 'Add a component',
    addPlaceholder: 'Add a component…',
    basis: 'Paid',
    basisOptions: { monthly: 'Per period', daily: 'Per day worked', hourly: 'Per hour worked' },
    errors: {
      money: 'Enter an amount like 5000 or 5000.50.',
      percentage: 'Enter a percentage from 0 to 100, up to 2 decimal places.',
      required: 'Enter a value for the hypothetical component.',
    },
  },

  attendance: {
    title: 'Attendance',
    hint: (month: string) => `Recorded attendance for ${month}. Override any figure to model a different month.`,
    daysWorked: 'Days worked',
    workedHours: 'Hours worked',
    unpaidDays: 'Unpaid leave days',
    recorded: (value: string) => `Recorded: ${value}`,
    workingDays: (days: string, hours: string) => `${days} working days · ${hours} standard hours in the month`,
    unused: 'Only daily and hourly pay or attendance-based formulas use these figures.',
    errors: {
      days: 'Enter days from 0 to 31, up to 2 decimal places.',
      hours: 'Enter hours from 0 to 744, up to 2 decimal places.',
    },
  },

  results: {
    title: 'Projected pay',
    watermark: 'Simulation',
    updating: 'Updating…',
    current: 'Current',
    projected: 'Projected',
    difference: 'Difference',
    gross: 'Gross pay',
    deductions: 'Deductions',
    net: 'Net pay',
    linesTitle: 'Line by line',
    colComponent: 'Component',
    noLines: 'No pay lines on this date.',
    currency: (currency: string) => `Amounts in ${currency}.`,
    employerSuper: (scheme: string, current: string, projected: string) =>
      `Employer ${scheme} contribution: ${current} now, ${projected} projected (paid by the company, not deducted).`,
    export: 'Export CSV',
    exportBanner: 'SIMULATION — projected figures, not real payroll',
    error: 'Could not run the simulation.',
    invalid: 'Fix the highlighted fields to update the projection.',
  },
} as const;
