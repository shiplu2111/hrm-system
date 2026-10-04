import type {
  AssetCategory,
  EmployeeOnboardingRecord,
  EmployeeOnboardingTaskRecord,
  OnboardingChecklistTemplateItemRecord,
  OnboardingChecklistTemplateRecord,
  OnboardingStatus,
  OnboardingTaskCategory,
  OnboardingTaskType,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

export interface CreateOnboardingTemplateInput {
  name: string;
  description?: string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateOnboardingTemplateInput {
  name?: string;
  description?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface OnboardingTemplateItemInput {
  title: string;
  description?: string | null;
  category: OnboardingTaskCategory;
  taskType: OnboardingTaskType;
  documentTypeId?: string | null;
  assetCategory?: AssetCategory | null;
  policyDocumentUrl?: string | null;
  assigneeLabel?: string | null;
  dueDaysOffset?: number | null;
  isRequired?: boolean;
}

export interface StartEmployeeOnboardingInput {
  employeeId: string;
  templateId?: string;
  startDate?: string;
  sendWelcome?: boolean;
}

export function listOnboardingTemplates(
  companyId: string,
  activeOnly?: boolean,
): Promise<OnboardingChecklistTemplateRecord[]> {
  const params = new URLSearchParams();
  if (activeOnly) params.set('activeOnly', 'true');
  const qs = params.toString();
  return tenantApiRequest<OnboardingChecklistTemplateRecord[]>(
    `/companies/${companyId}/onboarding-templates${qs ? `?${qs}` : ''}`,
  );
}

export function getOnboardingTemplate(
  templateId: string,
): Promise<OnboardingChecklistTemplateRecord> {
  return tenantApiRequest<OnboardingChecklistTemplateRecord>(
    `/onboarding-templates/${templateId}`,
  );
}

export function createOnboardingTemplate(
  companyId: string,
  input: CreateOnboardingTemplateInput,
): Promise<OnboardingChecklistTemplateRecord> {
  return tenantApiRequest<OnboardingChecklistTemplateRecord>(
    `/companies/${companyId}/onboarding-templates`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateOnboardingTemplate(
  templateId: string,
  input: UpdateOnboardingTemplateInput,
): Promise<OnboardingChecklistTemplateRecord> {
  return tenantApiRequest<OnboardingChecklistTemplateRecord>(
    `/onboarding-templates/${templateId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteOnboardingTemplate(templateId: string): Promise<void> {
  return tenantApiRequest<void>(`/onboarding-templates/${templateId}`, {
    method: 'DELETE',
  });
}

export function duplicateOnboardingTemplate(
  templateId: string,
): Promise<OnboardingChecklistTemplateRecord> {
  return tenantApiRequest<OnboardingChecklistTemplateRecord>(
    `/onboarding-templates/${templateId}/duplicate`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export function addOnboardingTemplateItem(
  templateId: string,
  input: OnboardingTemplateItemInput,
): Promise<OnboardingChecklistTemplateItemRecord> {
  return tenantApiRequest<OnboardingChecklistTemplateItemRecord>(
    `/onboarding-templates/${templateId}/items`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateOnboardingTemplateItem(
  itemId: string,
  input: Partial<OnboardingTemplateItemInput>,
): Promise<OnboardingChecklistTemplateItemRecord> {
  return tenantApiRequest<OnboardingChecklistTemplateItemRecord>(
    `/onboarding-template-items/${itemId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteOnboardingTemplateItem(itemId: string): Promise<void> {
  return tenantApiRequest<void>(`/onboarding-template-items/${itemId}`, {
    method: 'DELETE',
  });
}

export function reorderOnboardingTemplateItems(
  templateId: string,
  itemIds: string[],
): Promise<OnboardingChecklistTemplateRecord> {
  return tenantApiRequest<OnboardingChecklistTemplateRecord>(
    `/onboarding-templates/${templateId}/items/order`,
    { method: 'PUT', body: JSON.stringify({ itemIds }) },
  );
}

export function listEmployeeOnboardings(
  companyId: string,
  status?: OnboardingStatus,
): Promise<EmployeeOnboardingRecord[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  const qs = params.toString();
  return tenantApiRequest<EmployeeOnboardingRecord[]>(
    `/companies/${companyId}/employee-onboardings${qs ? `?${qs}` : ''}`,
  );
}

export function startEmployeeOnboarding(
  companyId: string,
  input: StartEmployeeOnboardingInput,
): Promise<EmployeeOnboardingRecord> {
  return tenantApiRequest<EmployeeOnboardingRecord>(
    `/companies/${companyId}/employee-onboardings`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function getEmployeeOnboarding(
  onboardingId: string,
): Promise<EmployeeOnboardingRecord> {
  return tenantApiRequest<EmployeeOnboardingRecord>(
    `/employee-onboardings/${onboardingId}`,
  );
}

/** Resolves to null when the employee has no onboarding yet. */
export function getOnboardingForEmployee(
  employeeId: string,
): Promise<EmployeeOnboardingRecord | null> {
  return tenantApiRequest<EmployeeOnboardingRecord | null>(
    `/employees/${employeeId}/onboarding`,
  );
}

export function completeOnboardingTask(
  onboardingId: string,
  taskId: string,
  note?: string,
): Promise<EmployeeOnboardingTaskRecord> {
  return tenantApiRequest<EmployeeOnboardingTaskRecord>(
    `/employee-onboardings/${onboardingId}/tasks/${taskId}/complete`,
    { method: 'POST', body: JSON.stringify(note ? { note } : {}) },
  );
}

export function skipOnboardingTask(
  onboardingId: string,
  taskId: string,
  reason?: string,
): Promise<EmployeeOnboardingTaskRecord> {
  return tenantApiRequest<EmployeeOnboardingTaskRecord>(
    `/employee-onboardings/${onboardingId}/tasks/${taskId}/skip`,
    { method: 'POST', body: JSON.stringify(reason ? { reason } : {}) },
  );
}

export function reopenOnboardingTask(
  onboardingId: string,
  taskId: string,
  reason?: string,
): Promise<EmployeeOnboardingTaskRecord> {
  return tenantApiRequest<EmployeeOnboardingTaskRecord>(
    `/employee-onboardings/${onboardingId}/tasks/${taskId}/reopen`,
    { method: 'POST', body: JSON.stringify(reason ? { reason } : {}) },
  );
}

export function acceptOnboardingPolicy(
  onboardingId: string,
  taskId: string,
): Promise<EmployeeOnboardingTaskRecord> {
  return tenantApiRequest<EmployeeOnboardingTaskRecord>(
    `/employee-onboardings/${onboardingId}/tasks/${taskId}/accept-policy`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export function assignOnboardingAsset(
  onboardingId: string,
  taskId: string,
  input: {
    assetId: string;
    assignedAt?: string;
    conditionOnAssign?: string;
    notes?: string;
  },
): Promise<EmployeeOnboardingTaskRecord> {
  return tenantApiRequest<EmployeeOnboardingTaskRecord>(
    `/employee-onboardings/${onboardingId}/tasks/${taskId}/assign-assets`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function resendOnboardingWelcome(
  onboardingId: string,
): Promise<EmployeeOnboardingRecord> {
  return tenantApiRequest<EmployeeOnboardingRecord>(
    `/employee-onboardings/${onboardingId}/resend-welcome`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}
