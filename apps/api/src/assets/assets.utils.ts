import type {
  CompanyAssetRecord,
  EmployeeAssetAssignmentRecord,
} from '@hrm/shared-types';
import type {
  CompanyAsset,
  EmployeeAssetAssignment,
} from '@prisma/client';
import { Prisma } from '@prisma/client';

export function formatDateValue(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export function formatDateTimeValue(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

export function formatMoney(value: Prisma.Decimal | null | undefined): string | null {
  if (value == null) return null;
  return value.toFixed(2);
}

type AssetRow = CompanyAsset & {
  assignments?: Array<
    EmployeeAssetAssignment & {
      employee?: { firstName: string; lastName: string };
    }
  >;
};

type AssignmentRow = EmployeeAssetAssignment & {
  asset?: { name: string; assetTag: string };
  employee?: { firstName: string; lastName: string };
};

export function toAssetRecord(row: AssetRow): CompanyAssetRecord {
  const activeAssignment = row.assignments?.find((a) => a.status === 'active');
  return {
    id: row.id,
    companyId: row.companyId,
    name: row.name,
    assetTag: row.assetTag,
    category: row.category,
    serialNumber: row.serialNumber,
    purchaseDate: formatDateValue(row.purchaseDate),
    warrantyExpiryDate: formatDateValue(row.warrantyExpiryDate),
    purchaseValue: formatMoney(row.purchaseValue),
    currency: row.currency,
    status: row.status,
    notes: row.notes,
    assignedEmployeeId: activeAssignment?.employeeId ?? null,
    assignedEmployeeName: activeAssignment?.employee
      ? `${activeAssignment.employee.firstName} ${activeAssignment.employee.lastName}`.trim()
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAssignmentRecord(row: AssignmentRow): EmployeeAssetAssignmentRecord {
  return {
    id: row.id,
    assetId: row.assetId,
    assetName: row.asset?.name ?? '',
    assetTag: row.asset?.assetTag ?? '',
    employeeId: row.employeeId,
    employeeName: row.employee
      ? `${row.employee.firstName} ${row.employee.lastName}`.trim()
      : '',
    status: row.status,
    assignedAt: row.assignedAt.toISOString(),
    returnedAt: formatDateTimeValue(row.returnedAt),
    conditionOnAssign: row.conditionOnAssign,
    conditionOnReturn: row.conditionOnReturn,
    notes: row.notes,
    offboardingTaskId: row.offboardingTaskId,
    onboardingTaskId: row.onboardingTaskId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
