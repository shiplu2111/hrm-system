import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, KeyRound, Pencil, ShieldOff, UserPlus } from 'lucide-react';
import type {
  EmployeePortalAccessState,
  EmployeePortalAccessView,
  EmployeePortalCredentialsResult,
  EmployeePortalRoleOption,
} from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Label, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusPill, type StatusPillTone } from '@/components/ui/StatusPill';
import { useTenant } from '@/context/TenantContext';
import {
  createPortalAccess,
  getPortalAccess,
  listAssignablePortalRoles,
  resetPortalPassword,
  updatePortalAccess,
} from '@/lib/portal-access-api';
import { ApiError } from '@/lib/tenant-api-client';

const EMPLOYEE_ROLE = 'Employee';

function accessStatus(access: EmployeePortalAccessView): { tone: StatusPillTone; label: string } {
  if (!access.isActive) return { tone: 'neutral', label: 'Disabled' };
  if (access.isLocked) return { tone: 'error', label: 'Locked' };
  if (access.mustChangePassword) return { tone: 'warning', label: 'Awaiting first sign-in' };
  return { tone: 'success', label: 'Active' };
}

function portalName(roleName: string): string {
  return roleName === EMPLOYEE_ROLE ? 'Employee Portal' : 'Company Admin portal';
}

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-primary">{children}</span>
    </div>
  );
}

function CopyButton({
  value,
  label,
  text = 'Copy',
}: {
  value: string;
  label: string;
  text?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Button variant="secondary" size="sm" onClick={() => void copy()} aria-label={label}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : text}
    </Button>
  );
}

function CredentialsDialog({
  credentials,
  employeeName,
  tenantSubdomain,
  onClose,
}: {
  credentials: EmployeePortalCredentialsResult | null;
  employeeName: string;
  tenantSubdomain: string | null;
  onClose: () => void;
}) {
  if (!credentials) return null;
  const { access, temporaryPassword } = credentials;
  const message = [
    `Hi ${employeeName}, your HR login is ready.`,
    `Portal: ${portalName(access.roleName)}`,
    tenantSubdomain ? `Organization: ${tenantSubdomain}` : null,
    `Email: ${access.email}`,
    `Temporary password: ${temporaryPassword}`,
    'You will be asked to choose your own password when you first sign in.',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <Modal
      open
      onClose={onClose}
      title="Share these sign-in details"
      description={`${employeeName} signs in to the ${portalName(access.roleName)}.`}
      footer={
        <div className="flex justify-end gap-2">
          <CopyButton value={message} label="Copy full message" text="Copy message" />
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border border-warning-200 dark:border-warning-800 bg-warning-50 dark:bg-warning-900/30 px-3 py-2 text-sm text-warning-800 dark:text-warning-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
          <span>
            This password is shown only once. Share it privately — the employee must replace it
            the first time they sign in.
          </span>
        </div>

        <dl className="space-y-3">
          {tenantSubdomain ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <dt className="text-xs text-muted">Organization</dt>
                <dd className="text-sm text-primary font-mono">{tenantSubdomain}</dd>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <dt className="text-xs text-muted">Email</dt>
              <dd className="text-sm text-primary font-mono truncate">{access.email}</dd>
            </div>
            <CopyButton value={access.email} label="Copy email" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <dt className="text-xs text-muted">Temporary password</dt>
              <dd className="text-lg text-primary font-mono tracking-wider">{temporaryPassword}</dd>
            </div>
            <CopyButton value={temporaryPassword} label="Copy temporary password" />
          </div>
        </dl>
      </div>
    </Modal>
  );
}

function blockedMessage(state: EmployeePortalAccessState): string | null {
  if (state.manageBlockedReason === 'self') {
    return 'This is your own login. Change your password from your account menu instead.';
  }
  if (state.manageBlockedReason === 'role_privilege') {
    return 'This login has permissions beyond your own, so only a higher role can change it.';
  }
  return null;
}

export function EmployeePortalAccessTab({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const canEdit = usePermission('settings', 'edit');
  const { current: tenant } = useTenant();
  const [state, setState] = useState<EmployeePortalAccessState | null>(null);
  const [roles, setRoles] = useState<EmployeePortalRoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [credentials, setCredentials] = useState<EmployeePortalCredentialsResult | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'disable' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [accessState, roleOptions] = await Promise.all([
        getPortalAccess(employeeId),
        listAssignablePortalRoles(),
      ]);
      setState(accessState);
      setRoles(roleOptions);
      setEmail(accessState.access?.email ?? accessState.suggestedEmail ?? '');
      setRoleId(
        accessState.access?.roleId ??
          roleOptions.find((r) => r.name === EMPLOYEE_ROLE)?.id ??
          '',
      );
    } catch (err) {
      setError(errorText(err, 'Failed to load portal access'));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyAccess = (access: EmployeePortalAccessView) => {
    setState((prev) => (prev ? { ...prev, access, manageBlockedReason: null } : prev));
    setEmail(access.email);
    setRoleId(access.roleId);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const result = await createPortalAccess(employeeId, { email: email.trim(), roleId });
      applyAccess(result.access);
      setCredentials(result);
    } catch (err) {
      setFormError(errorText(err, 'Could not create the login'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!state?.access) return;
    setSaving(true);
    setFormError(null);
    try {
      const updated = await updatePortalAccess(employeeId, {
        email: email.trim(),
        roleId,
      });
      applyAccess(updated);
      setEditing(false);
    } catch (err) {
      setFormError(errorText(err, 'Could not save changes'));
    } finally {
      setSaving(false);
    }
  };

  const handleEnable = async () => {
    setSaving(true);
    setFormError(null);
    try {
      applyAccess(await updatePortalAccess(employeeId, { isActive: true }));
    } catch (err) {
      setFormError(errorText(err, 'Could not enable the login'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardBody className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-9 w-full max-w-md" />
        </CardBody>
      </Card>
    );
  }

  if (error || !state) {
    return (
      <Card>
        <CardBody className="flex items-center justify-between gap-4">
          <p className="text-sm text-error-600">{error ?? 'Failed to load portal access'}</p>
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </CardBody>
      </Card>
    );
  }

  const { access } = state;
  const blocked = blockedMessage(state);
  const manageable = canEdit && !blocked;
  const selectedRole = roles.find((r) => r.id === roleId);
  const roleSelect = (
    <div>
      <Label htmlFor="portal-role">Role</Label>
      <Select
        id="portal-role"
        value={roleId}
        onChange={(e) => setRoleId(e.target.value)}
        required
      >
        <option value="" disabled>
          Select a role
        </option>
        {roles.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </Select>
      {selectedRole ? (
        <p className="text-xs text-muted mt-1">
          Signs in to the {portalName(selectedRole.name)}.
        </p>
      ) : null}
    </div>
  );
  const emailField = (
    <div>
      <Label htmlFor="portal-email">Login email</Label>
      <Input
        id="portal-email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="off"
        maxLength={254}
        required
      />
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>Portal access</CardTitle>
          {access ? (
            <StatusPill tone={accessStatus(access).tone}>{accessStatus(access).label}</StatusPill>
          ) : null}
        </CardHeader>
        <CardBody className="space-y-5">
          {blocked ? <p className="text-sm text-secondary">{blocked}</p> : null}

          {!access ? (
            <>
              <p className="text-sm text-secondary">
                {employeeName} has no login yet. Create one to issue a temporary password — they
                will be asked to set their own password the first time they sign in.
              </p>
              {!state.canGrant ? (
                <p className="text-sm text-secondary">
                  Terminated employees cannot be given portal access.
                </p>
              ) : manageable ? (
                <form onSubmit={(e) => void handleCreate(e)} className="space-y-4 max-w-md">
                  {emailField}
                  {roleSelect}
                  {formError ? (
                    <p role="alert" className="text-sm text-error-600">
                      {formError}
                    </p>
                  ) : null}
                  <Button type="submit" disabled={saving || !email.trim() || !roleId}>
                    <UserPlus className="h-4 w-4" />
                    {saving ? 'Creating…' : 'Create login'}
                  </Button>
                </form>
              ) : !canEdit ? (
                <p className="text-sm text-secondary">
                  You need Settings edit permission to create logins.
                </p>
              ) : null}
            </>
          ) : editing ? (
            <form onSubmit={(e) => void handleSaveEdit(e)} className="space-y-4 max-w-md">
              {emailField}
              {roleSelect}
              <p className="text-xs text-muted">
                Changing the role signs the employee out of all devices.
              </p>
              {formError ? (
                <p role="alert" className="text-sm text-error-600">
                  {formError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving || !email.trim() || !roleId}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditing(false);
                    setFormError(null);
                    setEmail(access.email);
                    setRoleId(access.roleId);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoRow label="Login email">
                  <span className="font-mono">{access.email}</span>
                </InfoRow>
                <InfoRow label="Role">{access.roleName}</InfoRow>
                <InfoRow label="Portal">{portalName(access.roleName)}</InfoRow>
                <InfoRow label="Last sign-in">{formatDateTime(access.lastLoginAt)}</InfoRow>
                <InfoRow label="Login created">{formatDateTime(access.createdAt)}</InfoRow>
              </div>

              {!state.canGrant && access.isActive ? (
                <p className="text-sm text-warning-700 dark:text-warning-300">
                  This employee is terminated but their login is still enabled. Disable it to
                  block sign-in.
                </p>
              ) : null}

              {formError ? (
                <p role="alert" className="text-sm text-error-600">
                  {formError}
                </p>
              ) : null}

              {manageable ? (
                <div className="flex flex-wrap gap-2">
                  {access.isActive ? (
                    <>
                      {state.canGrant ? (
                        <Button variant="secondary" onClick={() => setConfirm('reset')}>
                          <KeyRound className="h-4 w-4" /> Reset password
                        </Button>
                      ) : null}
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setFormError(null);
                          setEditing(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirm('disable')}>
                        <ShieldOff className="h-4 w-4" /> Disable login
                      </Button>
                    </>
                  ) : state.canGrant ? (
                    <Button onClick={() => void handleEnable()} disabled={saving}>
                      {saving ? 'Enabling…' : 'Enable login'}
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirm === 'reset'}
        title="Reset password?"
        description={`${employeeName} will be signed out of all devices and must sign in with a new temporary password.`}
        confirmLabel="Reset password"
        tone="primary"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          const result = await resetPortalPassword(employeeId);
          applyAccess(result.access);
          setConfirm(null);
          setCredentials(result);
        }}
      />
      <ConfirmDialog
        open={confirm === 'disable'}
        title="Disable login?"
        description={`${employeeName} will be signed out and won't be able to sign in until the login is enabled again.`}
        confirmLabel="Disable login"
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          applyAccess(await updatePortalAccess(employeeId, { isActive: false }));
          setConfirm(null);
        }}
      />
      <CredentialsDialog
        credentials={credentials}
        employeeName={employeeName}
        tenantSubdomain={tenant?.subdomain ?? null}
        onClose={() => setCredentials(null)}
      />
    </>
  );
}
