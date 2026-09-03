/** Custom field engine (MODULES.md §09) */

export type CustomFieldEntityType =
  | 'employee'
  | 'company'
  | 'department'
  | 'designation'
  | 'contract'
  | 'candidate'
  | 'document';

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'dropdown'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'image'
  | 'signature';

export interface CustomFieldDefinitionRecord {
  id: string;
  companyId: string;
  entityType: CustomFieldEntityType;
  contextId: string | null;
  fieldKey: string;
  label: string;
  fieldType: CustomFieldType;
  required: boolean;
  options: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DocumentScope = 'employee' | 'company';

export interface DocumentTypeFieldSchema {
  id?: string;
  fieldKey?: string;
  label: string;
  fieldType: CustomFieldType;
  required: boolean;
  options: string[];
  sortOrder: number;
  isActive?: boolean;
}

export interface DocumentTypeRecord {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  scope: DocumentScope;
  requiresVerification: boolean;
  tracksExpiry: boolean;
  isActive: boolean;
  documentCount: number;
  fields: DocumentTypeFieldSchema[];
  createdAt: string;
  updatedAt: string;
}

export type EmployeeDocumentStatus = 'verified' | 'pending' | 'expiring_soon';

export interface EmployeeDocumentRecord {
  id: string;
  employeeId: string;
  documentTypeId: string;
  documentTypeName: string;
  fields: Record<string, unknown>;
  fileKey: string | null;
  expiryDate: string | null;
  verifiedAt: string | null;
  status: EmployeeDocumentStatus;
  requiresVerification: boolean;
  tracksExpiry: boolean;
  createdAt: string;
  updatedAt: string;
}
