import { Injectable } from '@nestjs/common';
import { TimesheetSyncEventType } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { DataScopeService } from '../rbac/data-scope.service';
import { TimesheetEntriesService } from '../timesheets/timesheet-entries.service';
import type { TimesheetSyncEventDto } from '../timesheets/dto/timesheet.dto';
import { getTenantIdFromSession } from '../tenant/tenant.context';

export type TimesheetSyncItemStatus = 'created' | 'duplicate' | 'rejected';

export interface TimesheetSyncItemResult {
  local_id: string;
  status: TimesheetSyncItemStatus;
  server_id?: string;
  reason?: string;
}

@Injectable()
export class TimesheetSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entriesService: TimesheetEntriesService,
    private readonly dataScope: DataScopeService,
  ) {}

  async syncBatch(
    deviceId: string,
    events: TimesheetSyncEventDto[],
    user: AuthenticatedUser,
  ): Promise<TimesheetSyncItemResult[]> {
    void deviceId;
    const results: TimesheetSyncItemResult[] = [];
    for (const event of events) {
      results.push(await this.processEvent(event, user));
    }

    const tenantId = user.tenantId || getTenantIdFromSession();
    if (tenantId && events.length > 0) {
      const createdCount = results.filter((r) => r.status === 'created').length;
      const duplicateCount = results.filter((r) => r.status === 'duplicate').length;
      const rejectedCount = results.filter((r) => r.status === 'rejected').length;
      const reasons = results
        .filter((r) => r.status === 'rejected' && r.reason)
        .map((r) => r.reason as string);

      this.prisma.unscoped.mobileSyncLog
        .create({
          data: {
            tenantId,
            deviceId: deviceId || 'unknown',
            entityType: 'timesheet',
            totalEvents: events.length,
            createdCount,
            duplicateCount,
            rejectedCount,
            reasons,
          },
        })
        .catch(() => {});
    }

    return results;
  }

  private async processEvent(
    event: TimesheetSyncEventDto,
    user: AuthenticatedUser,
  ): Promise<TimesheetSyncItemResult> {
    if (
      (user.employeeId && user.employeeId !== event.employee_id) ||
      !(await this.dataScope.canAccessEmployee(user, event.employee_id))
    ) {
      return {
        local_id: event.local_id,
        status: 'rejected',
        reason: 'forbidden_employee',
      };
    }

    const existing = await this.prisma.unscoped.timesheetSyncEvent.findUnique({
      where: {
        employeeId_localId: {
          employeeId: event.employee_id,
          localId: event.local_id,
        },
      },
    });

    if (existing) {
      return {
        local_id: event.local_id,
        status: 'duplicate',
        server_id: existing.timesheetEntryId ?? existing.id,
        reason: existing.timeAnomaly ? 'time_anomaly' : undefined,
      };
    }

    try {
      if (event.type === TimesheetSyncEventType.log_entry) {
        return await this.applyLogEntry(event, user);
      }
      if (event.type === TimesheetSyncEventType.submit_entry) {
        return await this.applySubmitEntry(event, user);
      }
      return {
        local_id: event.local_id,
        status: 'rejected',
        reason: 'unknown_event_type',
      };
    } catch (error) {
      return {
        local_id: event.local_id,
        status: 'rejected',
        reason: error instanceof Error ? error.message : 'sync_failed',
      };
    }
  }

  private async applyLogEntry(
    event: TimesheetSyncEventDto,
    user: AuthenticatedUser,
  ): Promise<TimesheetSyncItemResult> {
    if (
      !event.entry_date ||
      !event.project_id ||
      !event.task_name ||
      !event.start_time ||
      !event.end_time
    ) {
      return {
        local_id: event.local_id,
        status: 'rejected',
        reason: 'missing_fields',
      };
    }

    const employee = await this.prisma.scoped.employee.findFirstOrThrow({
      where: { id: event.employee_id },
      select: { companyId: true, tenantId: true },
    });

    const timeAnomaly = this.entriesService.evaluateTimeAnomaly(
      event.timestamp_device,
      event.offline_duration_seconds,
    );

    const entry = await this.entriesService.create(
      employee.companyId,
      {
        employeeId: event.employee_id,
        projectId: event.project_id,
        entryDate: event.entry_date,
        taskName: event.task_name,
        startTime: event.start_time,
        endTime: event.end_time,
        breakMinutes: event.break_minutes,
        isBillable: event.is_billable,
        notes: event.notes,
        submit: false,
      },
      user,
      {
        localId: event.local_id,
        source: 'mobile_sync',
        timeAnomaly,
      },
    );

    await this.prisma.unscoped.timesheetSyncEvent.create({
      data: {
        employeeId: event.employee_id,
        localId: event.local_id,
        eventType: TimesheetSyncEventType.log_entry,
        timesheetEntryId: entry.id,
        deviceTimestamp: new Date(event.timestamp_device),
        timeAnomaly,
      },
    });

    return {
      local_id: event.local_id,
      status: 'created',
      server_id: entry.id,
      reason: timeAnomaly ? 'time_anomaly' : undefined,
    };
  }

  private async applySubmitEntry(
    event: TimesheetSyncEventDto,
    user: AuthenticatedUser,
  ): Promise<TimesheetSyncItemResult> {
    if (!event.entry_local_id) {
      return {
        local_id: event.local_id,
        status: 'rejected',
        reason: 'missing_entry_local_id',
      };
    }

    const target = await this.prisma.unscoped.timesheetEntry.findFirst({
      where: {
        employeeId: event.employee_id,
        localId: event.entry_local_id,
      },
    });

    if (!target) {
      return {
        local_id: event.local_id,
        status: 'rejected',
        reason: 'entry_not_found',
      };
    }

    const submitted = await this.entriesService.submit(target.id, user);

    await this.prisma.unscoped.timesheetSyncEvent.create({
      data: {
        employeeId: event.employee_id,
        localId: event.local_id,
        eventType: TimesheetSyncEventType.submit_entry,
        timesheetEntryId: submitted.id,
        deviceTimestamp: new Date(event.timestamp_device),
        timeAnomaly: this.entriesService.evaluateTimeAnomaly(
          event.timestamp_device,
          event.offline_duration_seconds,
        ),
      },
    });

    return {
      local_id: event.local_id,
      status: 'created',
      server_id: submitted.id,
    };
  }
}
