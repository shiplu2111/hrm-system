/** SECURITY.md §2 — sensitive field views and session management types */

export interface AuthSessionView {
  id: string;
  createdAt: string;
  expiresAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  isCurrent: boolean;
  isRevoked: boolean;
  isExpired: boolean;
}

export interface EmployeeTaxProfileView {
  id: string;
  employeeId: string;
  taxIdNumberMasked: string | null;
  bankAccountNumberMasked: string | null;
  taxSettings: Record<string, unknown>;
  updatedAt: string;
}

export interface RevealedSensitiveField {
  field: 'taxIdNumber' | 'bankAccountNumber';
  value: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface PasswordPolicyView {
  minLength: number;
  maxLength: number;
  requiresUppercase: boolean;
  requiresLowercase: boolean;
  requiresNumber: boolean;
  requiresSpecialCharacter: boolean;
}
