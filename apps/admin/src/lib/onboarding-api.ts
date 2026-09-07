import type {
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

export interface CreateOnboardingTemplateItemInput {
  title: string;
  description?: string;
  category: OnboardingTaskCategory;
  taskType: OnboardingTaskType;
  documentTypeId?: string;
  policyDocumentUrl?: string;
  assigneeLabel?: string;
  dueDaysOffset?: number;
  sortOrder?: number;
  isRequired?: boolean;
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

export function addOnboardingTemplateItem(
  templateId: string,
  input: CreateOnboardingTemplateItemInput,
): Promise<OnboardingChecklistTemplateItemRecord> {
  return tenantApiRequest<OnboardingChecklistTemplateItemRecord>(
    `/onboarding-templates/${templateId}/items`,
    { method: 'POST', body: JSON.stringify(input) },
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

export function getEmployeeOnboarding(
  onboardingId: string,
): Promise<EmployeeOnboardingRecord> {
  return tenantApiRequest<EmployeeOnboardingRecord>(
    `/employee-onboardings/${onboardingId}`,
  );
}

export function completeOnboardingTask(
  onboardingId: string,
  taskId: string,
): Promise<EmployeeOnboardingTaskRecord> {
  return tenantApiRequest<EmployeeOnboardingTaskRecord>(
    `/employee-onboardings/${onboardingId}/tasks/${taskId}/complete`,
    { method: 'POST', body: JSON.stringify({}) },
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
