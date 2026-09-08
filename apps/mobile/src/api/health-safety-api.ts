import type { WorkplaceIncidentRecord } from '@hrm/shared-types';
import { request } from './client';

export function reportEmployeeIncident(
  employeeId: string,
  input: {
    incidentType: string;
    severity: string;
    location: string;
    occurredAt: string;
    description: string;
    gpsLat?: number;
    gpsLng?: number;
  },
): Promise<WorkplaceIncidentRecord> {
  return request<WorkplaceIncidentRecord>(
    `/employees/${employeeId}/health-safety/incidents`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function listEmployeeIncidents(
  companyId: string,
  limit = 20,
): Promise<WorkplaceIncidentRecord[]> {
  return request<WorkplaceIncidentRecord[]>(
    `/companies/${companyId}/health-safety/incidents?limit=${limit}`,
  );
}
