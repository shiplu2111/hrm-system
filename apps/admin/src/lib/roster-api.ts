import type {
  BulkAssignRosterInput,
  BulkAssignRosterResult,
  BulkClearRosterInput,
  BulkClearRosterResult,
  CreateOvertimeRuleInput,
  HolidayRecord,
  LocationOption,
  OvertimeRuleRecord,
  ResolvedHolidayCalendar,
  RosterRecord,
  ShiftRecord,
  ShiftRuleConfig,
  ShiftType,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export interface ShiftInput {
  name: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  minimumMinutes: number | null;
  lateRule: ShiftRuleConfig | null;
  earlyLeaveRule: ShiftRuleConfig | null;
  weekendRule: ShiftRuleConfig | null;
  otRuleId: string | null;
}

export function listShifts(companyId: string): Promise<ShiftRecord[]> {
  return tenantApiRequest<ShiftRecord[]>(`/companies/${companyId}/shifts`);
}

export function createShift(companyId: string, input: ShiftInput): Promise<ShiftRecord> {
  const body = {
    ...input,
    minimumMinutes: input.minimumMinutes ?? undefined,
    lateRule: input.lateRule ?? undefined,
    earlyLeaveRule: input.earlyLeaveRule ?? undefined,
    weekendRule: input.weekendRule ?? undefined,
    otRuleId: input.otRuleId ?? undefined,
  };
  return tenantApiRequest<ShiftRecord>(`/companies/${companyId}/shifts`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateShift(
  companyId: string,
  shiftId: string,
  input: Partial<ShiftInput>,
): Promise<ShiftRecord> {
  return tenantApiRequest<ShiftRecord>(`/companies/${companyId}/shifts/${shiftId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteShift(companyId: string, shiftId: string): Promise<void> {
  return tenantApiRequest<void>(`/companies/${companyId}/shifts/${shiftId}`, {
    method: 'DELETE',
  });
}

export function listOtRules(companyId: string): Promise<OvertimeRuleRecord[]> {
  return tenantApiRequest<OvertimeRuleRecord[]>(`/companies/${companyId}/ot-rules`);
}

export function createOtRule(
  companyId: string,
  input: CreateOvertimeRuleInput,
): Promise<OvertimeRuleRecord> {
  return tenantApiRequest<OvertimeRuleRecord>(`/companies/${companyId}/ot-rules`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listRosterLocations(companyId: string): Promise<LocationOption[]> {
  return tenantApiRequest<LocationOption[]>(`/companies/${companyId}/rosters/locations`);
}

const ROSTER_PAGE_SIZE = 1000;

/** Every roster entry in the date range, fetched page by page. */
export async function listRostersInRange(
  companyId: string,
  from: string,
  to: string,
): Promise<RosterRecord[]> {
  const rows: RosterRecord[] = [];
  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({
      from,
      to,
      page: String(page),
      pageSize: String(ROSTER_PAGE_SIZE),
    });
    const batch = await tenantApiRequest<RosterRecord[]>(
      `/companies/${companyId}/rosters?${params.toString()}`,
    );
    rows.push(...batch);
    if (batch.length < ROSTER_PAGE_SIZE) return rows;
  }
}

export function bulkAssignRoster(
  companyId: string,
  input: BulkAssignRosterInput,
): Promise<BulkAssignRosterResult> {
  return tenantApiRequest<BulkAssignRosterResult>(`/companies/${companyId}/rosters/bulk`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function bulkClearRoster(
  companyId: string,
  input: BulkClearRosterInput,
): Promise<BulkClearRosterResult> {
  return tenantApiRequest<BulkClearRosterResult>(`/companies/${companyId}/rosters/bulk-clear`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listRosters(
  companyId: string,
  query?: { from?: string; to?: string; employeeId?: string },
): Promise<RosterRecord[]> {
  const params = new URLSearchParams();
  if (query?.from) params.set('from', query.from);
  if (query?.to) params.set('to', query.to);
  if (query?.employeeId) params.set('employeeId', query.employeeId);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return tenantApiRequest<RosterRecord[]>(
    `/companies/${companyId}/rosters${qs}`,
  );
}

export function createRoster(
  companyId: string,
  input: {
    employeeId: string;
    shiftId: string;
    date: string;
    locationId?: string;
  },
): Promise<RosterRecord> {
  return tenantApiRequest<RosterRecord>(`/companies/${companyId}/rosters`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteRoster(
  companyId: string,
  rosterId: string,
): Promise<void> {
  return tenantApiRequest<void>(
    `/companies/${companyId}/rosters/${rosterId}`,
    { method: 'DELETE' },
  );
}

export function resolveHolidayCalendar(
  companyId: string,
  query: { from: string; to: string; stateCode?: string },
): Promise<ResolvedHolidayCalendar> {
  const params = new URLSearchParams({
    from: query.from,
    to: query.to,
  });
  if (query.stateCode) params.set('stateCode', query.stateCode);
  return tenantApiRequest<ResolvedHolidayCalendar>(
    `/companies/${companyId}/holidays/calendar?${params.toString()}`,
  );
}

export function listHolidays(
  companyId: string,
  query?: { from?: string; to?: string },
): Promise<HolidayRecord[]> {
  const params = new URLSearchParams();
  if (query?.from) params.set('from', query.from);
  if (query?.to) params.set('to', query.to);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return tenantApiRequest<HolidayRecord[]>(
    `/companies/${companyId}/holidays${qs}`,
  );
}

export function createHoliday(
  companyId: string,
  input: {
    scope: 'company' | 'branch' | 'employee';
    name: string;
    date: string;
    recurring?: boolean;
    locationId?: string;
    employeeId?: string;
  },
): Promise<HolidayRecord> {
  return tenantApiRequest<HolidayRecord>(`/companies/${companyId}/holidays`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteHoliday(
  companyId: string,
  holidayId: string,
): Promise<void> {
  return tenantApiRequest<void>(
    `/companies/${companyId}/holidays/${holidayId}`,
    { method: 'DELETE' },
  );
}
