import type { EmployeeDocumentRecord } from '@hrm/shared-types';
import { ApiError, getTenantAccessToken, tenantApiRequest } from './tenant-api-client';

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

export async function uploadEmployeeDocumentFile(
  employeeId: string,
  documentId: string,
  file: File,
): Promise<EmployeeDocumentRecord> {
  const token = getTenantAccessToken();
  const formData = new FormData();
  formData.append('file', file);

  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(
    `${import.meta.env.VITE_API_BASE_URL ?? '/api/v1'}/employees/${employeeId}/documents/${documentId}/file`,
    {
      method: 'POST',
      headers,
      body: formData,
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    data?: EmployeeDocumentRecord;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new ApiError(
      payload.error?.message ?? `Upload failed (${response.status})`,
      response.status,
    );
  }

  return payload.data as EmployeeDocumentRecord;
}
