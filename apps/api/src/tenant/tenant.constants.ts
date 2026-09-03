/** Prisma models that carry a direct `tenantId` column (RULES.md §1). */
export const TENANT_SCOPED_MODELS = new Set([
  'Company',
  'Employee',
  'User',
  'Role',
  'AuditLog',
  'TenantSetting',
  'Holiday',
]);

export const CLIENT_TENANT_FIELD_NAMES = [
  'tenantId',
  'tenant_id',
  'tenantID',
] as const;
