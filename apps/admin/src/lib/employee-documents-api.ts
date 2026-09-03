import type { EmployeeDocumentRecord } from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export function listEmployeeDocuments(
  employeeId: string,
): Promise<EmployeeDocumentRecord[]> {
  return tenantApiRequest<EmployeeDocumentRecord[]>(
    `/employees/${employeeId}/documents`,
  );
}

export function createEmployeeDocument(
  employeeId: string,
  input: {
    documentTypeId: string;
    fields?: Record<string, unknown>;
    fileKey?: string | null;
    expiryDate?: string | null;
  },
): Promise<EmployeeDocumentRecord> {
  return tenantApiRequest<EmployeeDocumentRecord>(
    `/employees/${employeeId}/documents`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function verifyEmployeeDocument(
  employeeId: string,
  documentId: string,
): Promise<EmployeeDocumentRecord> {
  return tenantApiRequest<EmployeeDocumentRecord>(
    `/employees/${employeeId}/documents/${documentId}/verify`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export function deleteEmployeeDocument(
  employeeId: string,
  documentId: string,
): Promise<void> {
  return tenantApiRequest<void>(
    `/employees/${employeeId}/documents/${documentId}`,
    { method: 'DELETE' },
  );
}
