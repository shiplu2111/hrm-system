import type {
  CustomFieldDefinitionRecord,
  CustomFieldEntityType,
  CustomFieldType,
  DocumentTypeFieldSchema,
  DocumentTypeRecord,
} from '@hrm/shared-types';
import { tenantApiRequest } from './tenant-api-client';

type CreateCustomFieldInput = {
  entityType: CustomFieldEntityType;
  contextId?: string | null;
  fieldKey?: string;
  label: string;
  fieldType: CustomFieldType;
  required?: boolean;
  options?: string[];
  sortOrder?: number;
};

function companyPath(companyId: string, resource: string): string {
  return `/organization/companies/${companyId}/${resource}`;
}

// Custom fields (generalized form builder)
export function listCustomFields(
  companyId: string,
  entityType?: CustomFieldEntityType,
): Promise<CustomFieldDefinitionRecord[]> {
  const query = entityType ? `?entityType=${encodeURIComponent(entityType)}` : '';
  return tenantApiRequest<CustomFieldDefinitionRecord[]>(
    `${companyPath(companyId, 'custom-fields')}${query}`,
  );
}

export function createCustomField(
  companyId: string,
  input: CreateCustomFieldInput,
): Promise<CustomFieldDefinitionRecord> {
  return tenantApiRequest<CustomFieldDefinitionRecord>(
    companyPath(companyId, 'custom-fields'),
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateCustomField(
  companyId: string,
  id: string,
  input: Partial<CreateCustomFieldInput> & { isActive?: boolean },
): Promise<CustomFieldDefinitionRecord> {
  return tenantApiRequest<CustomFieldDefinitionRecord>(
    `${companyPath(companyId, 'custom-fields')}/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function deleteCustomField(companyId: string, id: string): Promise<void> {
  return tenantApiRequest<void>(
    `${companyPath(companyId, 'custom-fields')}/${id}`,
    { method: 'DELETE' },
  );
}

// Document types
export function listDocumentTypes(
  companyId: string,
): Promise<DocumentTypeRecord[]> {
  return tenantApiRequest<DocumentTypeRecord[]>(
    companyPath(companyId, 'document-types'),
  );
}

export function createDocumentType(
  companyId: string,
  input: {
    name: string;
    description?: string | null;
    scope?: 'employee' | 'company';
    requiresVerification?: boolean;
    tracksExpiry?: boolean;
    fields?: DocumentTypeFieldSchema[];
  },
): Promise<DocumentTypeRecord> {
  return tenantApiRequest<DocumentTypeRecord>(
    companyPath(companyId, 'document-types'),
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export function updateDocumentType(
  companyId: string,
  id: string,
  input: Partial<{
    name: string;
    description: string | null;
    scope: 'employee' | 'company';
    requiresVerification: boolean;
    tracksExpiry: boolean;
    isActive: boolean;
  }>,
): Promise<DocumentTypeRecord> {
  return tenantApiRequest<DocumentTypeRecord>(
    `${companyPath(companyId, 'document-types')}/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function replaceDocumentTypeFields(
  companyId: string,
  id: string,
  fields: DocumentTypeFieldSchema[],
): Promise<DocumentTypeRecord> {
  return tenantApiRequest<DocumentTypeRecord>(
    `${companyPath(companyId, 'document-types')}/${id}/fields`,
    { method: 'PUT', body: JSON.stringify(fields) },
  );
}

export function deleteDocumentType(companyId: string, id: string): Promise<void> {
  return tenantApiRequest<void>(
    `${companyPath(companyId, 'document-types')}/${id}`,
    { method: 'DELETE' },
  );
}
