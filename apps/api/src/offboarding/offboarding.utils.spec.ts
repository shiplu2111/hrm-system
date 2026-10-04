import type { PayrollCalculationLine, PayrollCalculationPreview } from '@hrm/shared-types';
import {
  SettlementLineError,
  buildSettlementLines,
  isOffboardingTaskOverdue,
  resolveExitInterviewStatus,
  sanitizeExitRatings,
  settlementLinesToOverrides,
  summarizeOffboardingTasks,
} from './offboarding.utils';

function line(
  componentId: string,
  componentName: string,
  componentType: 'earning' | 'deduction',
  amount: string,
): PayrollCalculationLine {
  return {
    salaryStructureId: `s-${componentId}`,
    componentId,
    componentName,
    componentType,
    calculationType: 'fixed',
    baseAmount: null,
    percentage: null,
    amount,
  };
}

function calc(earnings: PayrollCalculationLine[], deductions: PayrollCalculationLine[]): PayrollCalculationPreview {
  return {
    employeeId: 'e1',
    asOfDate: '2026-08-31',
    grossPay: '0.00',
    totalDeductions: '0.00',
    netPay: '0.00',
    earnings,
    deductions,
  };
}

describe('offboarding utils', () => {
  describe('summarizeOffboardingTasks', () => {
    const today = '2026-10-04';

    it('counts required tasks for progress, with skipped as done', () => {
      const summary = summarizeOffboardingTasks(
        [
          { status: 'completed', isRequired: true, dueDate: null },
          { status: 'skipped', isRequired: true, dueDate: null },
          { status: 'pending', isRequired: true, dueDate: '2026-10-01' },
          { status: 'pending', isRequired: false, dueDate: '2026-09-01' },
        ],
        today,
      );
      expect(summary).toEqual({
        progressPercent: 67,
        completedTaskCount: 2,
        totalTaskCount: 4,
        requiredTaskCount: 3,
        requiredCompletedCount: 2,
        overdueTaskCount: 2,
      });
    });

    it('falls back to all tasks when none are required', () => {
      const summary = summarizeOffboardingTasks(
        [
          { status: 'completed', isRequired: false, dueDate: null },
          { status: 'pending', isRequired: false, dueDate: null },
        ],
        today,
      );
      expect(summary.progressPercent).toBe(50);
    });

    it('treats only pending tasks past their due date as overdue', () => {
      expect(isOffboardingTaskOverdue({ status: 'pending', dueDate: '2026-10-03' }, today)).toBe(true);
      expect(isOffboardingTaskOverdue({ status: 'pending', dueDate: today }, today)).toBe(false);
      expect(isOffboardingTaskOverdue({ status: 'completed', dueDate: '2026-01-01' }, today)).toBe(false);
    });
  });

  describe('exit interview helpers', () => {
    it('derives the interview status', () => {
      expect(resolveExitInterviewStatus(null)).toBe('not_started');
      expect(resolveExitInterviewStatus({ scheduledAt: new Date(), conductedAt: null })).toBe('scheduled');
      expect(resolveExitInterviewStatus({ scheduledAt: null, conductedAt: new Date() })).toBe('completed');
    });

    it('keeps only known areas with whole scores from 1 to 5', () => {
      expect(
        sanitizeExitRatings({ manager: 4, team: 0, growth: 3.5, compensation: 5, bogus: 3 }),
      ).toEqual({ manager: 4, compensation: 5 });
      expect(sanitizeExitRatings(null)).toEqual({});
      expect(sanitizeExitRatings([1, 2])).toEqual({});
    });
  });

  describe('buildSettlementLines', () => {
    it('compares components and lists earnings before deductions', () => {
      const original = calc(
        [line('basic', 'Basic', 'earning', '8000.00'), line('car', 'Car allowance', 'earning', '500.00')],
        [line('tax', 'Tax', 'deduction', '1700.00')],
      );
      const revised = calc(
        [line('basic', 'Basic', 'earning', '8000.00'), line('leave', 'Leave encashment', 'earning', '1200.00')],
        [line('tax', 'Tax', 'deduction', '1940.00')],
      );

      expect(buildSettlementLines(original, revised)).toEqual([
        { componentId: 'basic', componentName: 'Basic', componentType: 'earning', original: '8000.00', revised: '8000.00', difference: '0.00' },
        { componentId: 'leave', componentName: 'Leave encashment', componentType: 'earning', original: '0.00', revised: '1200.00', difference: '1200.00' },
        { componentId: 'car', componentName: 'Car allowance', componentType: 'earning', original: '500.00', revised: '0.00', difference: '-500.00' },
        { componentId: 'tax', componentName: 'Tax', componentType: 'deduction', original: '1700.00', revised: '1940.00', difference: '240.00' },
      ]);
    });

    it('leaves the original side empty when the run has no stored breakdown', () => {
      const revised = calc([line('basic', 'Basic', 'earning', '8000.00')], []);
      expect(buildSettlementLines(null, revised)).toEqual([
        { componentId: 'basic', componentName: 'Basic', componentType: 'earning', original: null, revised: '8000.00', difference: '8000.00' },
      ]);
    });

    it('returns no lines when neither side has a breakdown', () => {
      expect(buildSettlementLines(null, null)).toEqual([]);
    });
  });

  describe('settlementLinesToOverrides', () => {
    it('normalises amounts', () => {
      expect(settlementLinesToOverrides([{ componentId: 'c1', amount: ' 1200.5 ' }])).toEqual([
        { componentId: 'c1', amount: '1200.50' },
      ]);
      expect(settlementLinesToOverrides(undefined)).toEqual([]);
    });

    it('rejects negative or malformed amounts and duplicate components', () => {
      expect(() => settlementLinesToOverrides([{ componentId: 'c1', amount: '-5' }])).toThrow(SettlementLineError);
      expect(() => settlementLinesToOverrides([{ componentId: 'c1', amount: '1.234' }])).toThrow(SettlementLineError);
      expect(() =>
        settlementLinesToOverrides([
          { componentId: 'c1', amount: '1' },
          { componentId: 'c1', amount: '2' },
        ]),
      ).toThrow(SettlementLineError);
    });
  });
});
