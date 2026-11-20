import {
  AttendanceSyncEventType,
  TimesheetSyncEventType,
} from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AttendanceSyncService } from './attendance-sync.service';
import { TimesheetSyncService } from './timesheet-sync.service';

describe('Offline sync employee scoping (ROLES_PERMISSIONS.md §5)', () => {
  const ownUser: AuthenticatedUser = {
    id: 'user-own',
    tenantId: 'tenant-1',
    roleId: 'role-employee',
    roleName: 'Employee',
    employeeId: 'emp-own',
    email: 'employee@example.com',
    permissions: [{ module: 'attendance', action: 'create' }],
    dataScope: 'own',
  };

  const unlinkedOwnUser: AuthenticatedUser = {
    ...ownUser,
    id: 'user-unlinked',
    employeeId: null,
  };

  describe('AttendanceSyncService', () => {
    it('rejects another employee event before checking for duplicates (prevents IDOR probe)', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: 'sync-secret',
        attendanceRecordId: 'att-secret',
        timeAnomaly: false,
        geofenceMismatch: false,
      });
      const dataScope = {
        canAccessEmployee: jest.fn().mockResolvedValue(false),
      };
      const service = new AttendanceSyncService(
        { unscoped: { attendanceSyncEvent: { findUnique } } } as never,
        dataScope as never,
      );

      const results = await service.syncBatch(
        'device-1',
        [
          {
            local_id: 'local-1',
            employee_id: 'emp-other',
            type: AttendanceSyncEventType.clock_in,
            timestamp_device: new Date().toISOString(),
          },
        ],
        ownUser,
      );

      expect(results).toEqual([
        {
          local_id: 'local-1',
          status: 'rejected',
          reason: 'forbidden_employee',
        },
      ]);
      expect(findUnique).not.toHaveBeenCalled();
    });

    it('rejects an own-scoped user with employeeId=null before touching sync events', async () => {
      const findUnique = jest.fn();
      const dataScope = {
        canAccessEmployee: jest.fn().mockResolvedValue(false),
      };
      const service = new AttendanceSyncService(
        { unscoped: { attendanceSyncEvent: { findUnique } } } as never,
        dataScope as never,
      );

      const results = await service.syncBatch(
        'device-1',
        [
          {
            local_id: 'local-2',
            employee_id: 'emp-other',
            type: AttendanceSyncEventType.clock_in,
            timestamp_device: new Date().toISOString(),
          },
        ],
        unlinkedOwnUser,
      );

      expect(results).toEqual([
        {
          local_id: 'local-2',
          status: 'rejected',
          reason: 'forbidden_employee',
        },
      ]);
      expect(dataScope.canAccessEmployee).toHaveBeenCalledWith(
        unlinkedOwnUser,
        'emp-other',
      );
      expect(findUnique).not.toHaveBeenCalled();
    });

    it('allows replay/duplicate lookup only when the employee is the signed-in user', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: 'sync-own',
        attendanceRecordId: 'att-own',
        timeAnomaly: false,
        geofenceMismatch: false,
      });
      const dataScope = {
        canAccessEmployee: jest.fn().mockResolvedValue(true),
      };
      const service = new AttendanceSyncService(
        { unscoped: { attendanceSyncEvent: { findUnique } } } as never,
        dataScope as never,
      );

      const results = await service.syncBatch(
        'device-1',
        [
          {
            local_id: 'local-own',
            employee_id: 'emp-own',
            type: AttendanceSyncEventType.clock_in,
            timestamp_device: new Date().toISOString(),
          },
        ],
        ownUser,
      );

      expect(results).toEqual([
        {
          local_id: 'local-own',
          status: 'duplicate',
          server_id: 'att-own',
          reason: undefined,
        },
      ]);
      expect(findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe('TimesheetSyncService', () => {
    it('rejects another employee event before checking for duplicates', async () => {
      const findUnique = jest.fn().mockResolvedValue({
        id: 'ts-secret',
        timesheetEntryId: 'entry-secret',
        timeAnomaly: false,
      });
      const dataScope = {
        canAccessEmployee: jest.fn().mockResolvedValue(false),
      };
      const service = new TimesheetSyncService(
        { unscoped: { timesheetSyncEvent: { findUnique } } } as never,
        {} as never,
        dataScope as never,
      );

      const results = await service.syncBatch(
        'device-1',
        [
          {
            local_id: 'local-ts-1',
            employee_id: 'emp-other',
            type: TimesheetSyncEventType.log_entry,
            timestamp_device: new Date().toISOString(),
          },
        ],
        ownUser,
      );

      expect(results).toEqual([
        {
          local_id: 'local-ts-1',
          status: 'rejected',
          reason: 'forbidden_employee',
        },
      ]);
      expect(findUnique).not.toHaveBeenCalled();
    });

    it('rejects an own-scoped user with employeeId=null', async () => {
      const findUnique = jest.fn();
      const dataScope = {
        canAccessEmployee: jest.fn().mockResolvedValue(false),
      };
      const service = new TimesheetSyncService(
        { unscoped: { timesheetSyncEvent: { findUnique } } } as never,
        {} as never,
        dataScope as never,
      );

      const results = await service.syncBatch(
        'device-1',
        [
          {
            local_id: 'local-ts-2',
            employee_id: 'emp-other',
            type: TimesheetSyncEventType.log_entry,
            timestamp_device: new Date().toISOString(),
          },
        ],
        unlinkedOwnUser,
      );

      expect(results).toEqual([
        {
          local_id: 'local-ts-2',
          status: 'rejected',
          reason: 'forbidden_employee',
        },
      ]);
      expect(dataScope.canAccessEmployee).toHaveBeenCalledWith(
        unlinkedOwnUser,
        'emp-other',
      );
      expect(findUnique).not.toHaveBeenCalled();
    });
  });
});
