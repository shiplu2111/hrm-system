import type {
  ApiResponse as ApiEnvelope,
  ApproveDataRequestInput,
  BackupsComplianceSummary,
  BackupRunItem,
  CreateEmployeeAnonymizationInput,
  CreateRestoreRequestInput,
  CreateTenantExportInput,
  DataRequestItem,
  RejectDataRequestInput,
  RejectRestoreRequestInput,
  RestoreRequestItem,
  TriggerBackupInput,
} from '@hrm/shared-types';

const API_BASE = '/api/v1/platform/backups';

function getAuthHeaders(): HeadersInit {
  const token =
    localStorage.getItem('hrm_platform_access_token') ||
    localStorage.getItem('platform_token') ||
    localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg =
      json.error?.message ||
      json.message ||
      `Request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }
  return json.data;
}

export const platformBackupsApi = {
  async getSummary(thresholds?: {
    backupThresholdHours?: number;
    restoreTestThresholdDays?: number;
  }): Promise<BackupsComplianceSummary> {
    const params = new URLSearchParams();
    if (thresholds?.backupThresholdHours) {
      params.set('backupThresholdHours', thresholds.backupThresholdHours.toString());
    }
    if (thresholds?.restoreTestThresholdDays) {
      params.set('restoreTestThresholdDays', thresholds.restoreTestThresholdDays.toString());
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${API_BASE}/summary${qs}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<BackupsComplianceSummary>(res);
  },

  async listBackupRuns(): Promise<BackupRunItem[]> {
    const res = await fetch(`${API_BASE}/runs`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<BackupRunItem[]>(res);
  },

  async triggerBackup(input: TriggerBackupInput): Promise<BackupRunItem> {
    const res = await fetch(`${API_BASE}/runs`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<BackupRunItem>(res);
  },

  async runRestoreTest(id: string): Promise<BackupRunItem> {
    const res = await fetch(`${API_BASE}/runs/${id}/test-restore`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<BackupRunItem>(res);
  },

  async listRestoreRequests(): Promise<RestoreRequestItem[]> {
    const res = await fetch(`${API_BASE}/restore-requests`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<RestoreRequestItem[]>(res);
  },

  async createRestoreRequest(input: CreateRestoreRequestInput): Promise<RestoreRequestItem> {
    const res = await fetch(`${API_BASE}/restore-requests`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<RestoreRequestItem>(res);
  },

  async approveRestoreRequest(id: string): Promise<RestoreRequestItem> {
    const res = await fetch(`${API_BASE}/restore-requests/${id}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse<RestoreRequestItem>(res);
  },

  async rejectRestoreRequest(
    id: string,
    input: RejectRestoreRequestInput,
  ): Promise<RestoreRequestItem> {
    const res = await fetch(`${API_BASE}/restore-requests/${id}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<RestoreRequestItem>(res);
  },

  async listDataRequests(): Promise<DataRequestItem[]> {
    const res = await fetch(`${API_BASE}/data-requests`, {
      headers: getAuthHeaders(),
    });
    return handleResponse<DataRequestItem[]>(res);
  },

  async createTenantExport(input: CreateTenantExportInput): Promise<DataRequestItem> {
    const res = await fetch(`${API_BASE}/data-requests/tenant-export`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<DataRequestItem>(res);
  },

  async createEmployeeAnonymization(
    input: CreateEmployeeAnonymizationInput,
  ): Promise<DataRequestItem> {
    const res = await fetch(`${API_BASE}/data-requests/employee-anonymize`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<DataRequestItem>(res);
  },

  async approveDataRequest(
    id: string,
    input?: ApproveDataRequestInput,
  ): Promise<DataRequestItem> {
    const res = await fetch(`${API_BASE}/data-requests/${id}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input || {}),
    });
    return handleResponse<DataRequestItem>(res);
  },

  async rejectDataRequest(
    id: string,
    input: RejectDataRequestInput,
  ): Promise<DataRequestItem> {
    const res = await fetch(`${API_BASE}/data-requests/${id}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(input),
    });
    return handleResponse<DataRequestItem>(res);
  },

  async listTenants(): Promise<Array<{ id: string; name: string; subdomain: string }>> {
    const res = await fetch('/api/v1/platform/tenants', {
      headers: getAuthHeaders(),
    });
    const data = await handleResponse<any>(res);
    return Array.isArray(data) ? data : data.items || [];
  },

  async listEmployeesForTenant(
    tenantId: string,
  ): Promise<Array<{ id: string; name: string; employeeNumber: string }>> {
    const res = await fetch(`/api/v1/platform/tenants/${tenantId}/support-access/employees`, {
      headers: getAuthHeaders(),
    }).catch(() => null);
    if (!res || !res.ok) {
      // Fallback: fetch from usage or generic endpoint
      return [];
    }
    const data = await handleResponse<any>(res);
    return Array.isArray(data) ? data : [];
  },
};
