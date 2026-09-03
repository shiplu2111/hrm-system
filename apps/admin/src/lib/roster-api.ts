import type {
  HolidayRecord,
  ResolvedHolidayCalendar,
  RosterRecord,
  ShiftRecord,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listShifts(companyId: string): Promise<ShiftRecord[]> {
  return tenantApiRequest<ShiftRecord[]>(`/companies/${companyId}/shifts`);
}

export function createShift(
  companyId: string,
  input: {
    name: string;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    graceMinutes?: number;
    shiftType?: string;
  },
): Promise<ShiftRecord> {
  return tenantApiRequest<ShiftRecord>(`/companies/${companyId}/shifts`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteShift(companyId: string, shiftId: string): Promise<void> {
  return tenantApiRequest<void>(`/companies/${companyId}/shifts/${shiftId}`, {
    method: 'DELETE',
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
