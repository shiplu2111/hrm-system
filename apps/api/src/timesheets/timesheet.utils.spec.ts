import type { WorkflowInstanceRecord } from '@hrm/shared-types';
import {
  computeTimesheetHours,
  formatDateValue,
  parseDateString,
  resolveTimesheetDisplayStatus,
  splitBillableHours,
} from './timesheet.utils';

describe('timesheet.utils', () => {
  describe('computeTimesheetHours', () => {
    it('subtracts break minutes from elapsed time', () => {
      const start = new Date('2026-03-24T09:00:00.000Z');
      const end = new Date('2026-03-24T17:00:00.000Z');
      expect(computeTimesheetHours(start, end, 30)).toBe(7.5);
    });

    it('never returns negative hours', () => {
      const start = new Date('2026-03-24T17:00:00.000Z');
      const end = new Date('2026-03-24T09:00:00.000Z');
      expect(computeTimesheetHours(start, end, 0)).toBe(0);
    });
  });

  describe('splitBillableHours', () => {
    it('assigns all hours to billable when flagged billable', () => {
      expect(splitBillableHours(5.5, true)).toEqual({
        billableHours: 5.5,
        nonBillableHours: 0,
      });
    });

    it('assigns all hours to non-billable when not billable', () => {
      expect(splitBillableHours(2, false)).toEqual({
        billableHours: 0,
        nonBillableHours: 2,
      });
    });
  });

  describe('parseDateString / formatDateValue', () => {
    it('round-trips YYYY-MM-DD dates', () => {
      const date = parseDateString('2026-03-24');
      expect(formatDateValue(date)).toBe('2026-03-24');
    });
  });

  describe('resolveTimesheetDisplayStatus', () => {
    it('maps terminal statuses', () => {
      expect(
        resolveTimesheetDisplayStatus({ status: 'approved', workflow: null }),
      ).toBe('Approved');
      expect(
        resolveTimesheetDisplayStatus({ status: 'rejected', workflow: null }),
      ).toBe('Rejected');
    });

    it('shows pending manager when workflow step is manager', () => {
      const workflow = {
        id: 'wf-1',
        definitionId: 'def-1',
        companyId: 'co-1',
        tenantId: 't-1',
        entityType: 'timesheet_entry',
        entityId: 'entry-1',
        requesterEmployeeId: 'emp-1',
        requesterUserId: 'user-1',
        status: 'pending',
        currentStepOrder: 1,
        steps: [
          {
            order: 1,
            assigneeType: 'direct_manager',
            roleName: 'Manager',
            status: 'pending',
            actedByUserId: null,
            actedByEmployeeId: null,
            actedAt: null,
            comment: null,
          },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        completedAt: null,
      } as WorkflowInstanceRecord;

      expect(
        resolveTimesheetDisplayStatus({
          status: 'pending_approval',
          workflow,
        }),
      ).toBe('Pending Manager');
    });
  });
});
