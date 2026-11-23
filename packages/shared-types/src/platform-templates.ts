/**
 * Platform Default Templates (Stage C.0: Tenant Provisioning Defaults)
 * Defines versioned baseline templates from which new tenants are provisioned.
 * Changing a default affects only tenants created afterwards, never existing tenants.
 */

export type PlatformTemplateCategory =
  | 'document_types'
  | 'leave_policies'
  | 'notification_templates'
  | 'default_roles'
  | 'onboarding_checklists';

export type PlatformTemplateStatus = 'draft' | 'published' | 'archived';

// 1. Document Types Template Item
export interface DefaultDocumentTypeItem {
  name: string;
  description?: string;
  scope?: 'employee' | 'company';
  requiresVerification: boolean;
  tracksExpiry: boolean;
  fieldDefinitions?: {
    fieldName: string;
    fieldType: 'text' | 'date' | 'number' | 'file';
    isRequired: boolean;
  }[];
}

// 2. Leave Policies Template Item
export interface DefaultLeavePolicyItem {
  name: string;
  code: string;
  isPaid: boolean;
  entitlementDays: number;
  accrualType: 'yearly' | 'monthly' | 'hourly' | 'none';
  carryForwardMax?: number | null;
  expiryMonths?: number | null;
  encashmentAllowed?: boolean;
  probationRestricted?: boolean;
  allowNegativeBalance?: boolean;
  negativeBalanceCap?: number | null;
  halfDayAllowed?: boolean;
  deductPublicHolidays?: boolean;
  approvalSteps?: { roleName: string }[];
}

// 3. Notification Templates Item
export interface DefaultNotificationTemplateItem {
  key: string;
  title?: string;
  channels: ('in_app' | 'email' | 'push' | 'sms')[];
  subject: string;
  body: string;
  variables?: string[];
}

// 4. Default Roles & Permissions Item
export interface DefaultRolePermissionDef {
  module: string;
  actions: ('view' | 'create' | 'edit' | 'delete' | 'approve' | 'finalize')[];
}

export interface DefaultRoleItem {
  name: string;
  description?: string;
  dataScope: 'all' | 'team' | 'department' | 'location' | 'own';
  permissions: DefaultRolePermissionDef[];
}

// 5. Onboarding Checklists Template Item
export interface DefaultOnboardingChecklistItem {
  title: string;
  description?: string;
  category: 'document_collection' | 'policy_acceptance' | 'equipment_provisioning' | 'system_access' | 'general';
  taskType: 'document_collection' | 'policy_acceptance' | 'manual_task' | 'provisioning';
  assigneeLabel?: string;
  dueDaysOffset?: number;
  isRequired: boolean;
  documentTypeName?: string;
  assetCategory?: string;
}

export interface DefaultOnboardingChecklistTemplate {
  name: string;
  description?: string;
  isDefault: boolean;
  items: DefaultOnboardingChecklistItem[];
}

// Platform Default Template Entity
export interface PlatformDefaultTemplate {
  id: string;
  countryId?: string | null;
  category: PlatformTemplateCategory;
  version: number;
  name: string;
  description?: string | null;
  status: PlatformTemplateStatus;
  payload: any;
  effectiveFrom: string;
  effectiveTo?: string | null;
  changeSummary?: string | null;
  sourceReference?: string | null;
  createdBy: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  country?: {
    id: string;
    name: string;
    isoCode: string;
  } | null;
}

export interface CreatePlatformTemplateInput {
  countryId?: string | null;
  category: PlatformTemplateCategory;
  name: string;
  description?: string;
  payload: any;
  effectiveFrom?: string;
  changeSummary?: string;
  sourceReference?: string;
  status?: PlatformTemplateStatus;
}

export interface UpdatePlatformTemplateInput {
  name?: string;
  description?: string;
  payload?: any;
  effectiveFrom?: string;
  changeSummary?: string;
  sourceReference?: string;
}

export interface PublishPlatformTemplateInput {
  effectiveFrom?: string;
  changeSummary?: string;
  approvedBy?: string;
}

export interface EffectiveProvisioningTemplatesResponse {
  countryId?: string | null;
  countryName?: string;
  countryCode?: string;
  templates: {
    document_types?: PlatformDefaultTemplate;
    leave_policies?: PlatformDefaultTemplate;
    notification_templates?: PlatformDefaultTemplate;
    default_roles?: PlatformDefaultTemplate;
    onboarding_checklists?: PlatformDefaultTemplate;
  };
  sources: {
    document_types: 'country' | 'global' | 'system_fallback';
    leave_policies: 'country' | 'global' | 'system_fallback';
    notification_templates: 'country' | 'global' | 'system_fallback';
    default_roles: 'country' | 'global' | 'system_fallback';
    onboarding_checklists: 'country' | 'global' | 'system_fallback';
  };
}
