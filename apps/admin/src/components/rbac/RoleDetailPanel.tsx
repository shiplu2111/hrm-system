import { useEffect, useMemo, useState } from 'react';
import { Copy, Info, Lock, ShieldCheck, Trash2, Users } from 'lucide-react';
import type { PermissionModuleDefinition, RoleDataScope, TenantRoleRecord } from '@hrm/shared-types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Form';
import { FieldError } from '@/components/ui/FieldError';
import { StatusPill } from '@/components/ui/StatusPill';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { RolePermissionEditor } from '@/components/rbac/RolePermissionEditor';
import { RoleChangeSummary } from '@/components/rbac/RoleChangeSummary';
import { createRole, deleteRole, updateRole } from '@/lib/roles-api';
import { rolesCopy as copy } from '@/lib/roles-copy';
import {
  diffGrants,
  grantKey,
  roleScope,
  toGrantSet,
  toPermissions,
  validateRoleName,
  type CanGrant,
} from '@/lib/role-matrix';

export interface NewRoleDraft {
  name: string;
  grants: Set<string>;
  /** Template permissions left out because the editor doesn't hold them. */
  omitted: number;
  dataScope: RoleDataScope;
}

interface Props {
  /** Null while creating a new role. */
  role: TenantRoleRecord | null;
  newDraft: NewRoleDraft | null;
  roles: TenantRoleRecord[];
  definitions: PermissionModuleDefinition[];
  canGrant: CanGrant;
  /** Team-scoped editors can't grant company-wide data access. */
  actorOrgWide: boolean;
  permissions: { create: boolean; edit: boolean; delete: boolean };
  currentRoleId: string | null;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: (role: TenantRoleRecord, created: boolean) => void;
  onDeleted: (role: TenantRoleRecord) => void;
  onDuplicate: (role: TenantRoleRecord) => void;
  onCancelCreate: () => void;
}

const SELF_LOCKED = new Set([grantKey('settings', 'view'), grantKey('settings', 'edit')]);
const EMPTY = new Set<string>();

export function RoleDetailPanel({
  role,
  newDraft,
  roles,
  definitions,
  canGrant,
  actorOrgWide,
  permissions,
  currentRoleId,
  onDirtyChange,
  onSaved,
  onDeleted,
  onDuplicate,
  onCancelCreate,
}: Props) {
  const creating = role === null;
  const baseline = useMemo(() => (role ? toGrantSet(role.permissions) : EMPTY), [role]);
  const [name, setName] = useState(role?.name ?? newDraft?.name ?? '');
  const [grants, setGrants] = useState<Set<string>>(() => (role ? toGrantSet(role.permissions) : new Set(newDraft?.grants)));
  const baselineScope: RoleDataScope = role?.dataScope ?? newDraft?.dataScope ?? 'all';
  const [dataScope, setDataScope] = useState<RoleDataScope>(baselineScope);
  const [submitted, setSubmitted] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isSystem = role?.isSystem ?? false;
  const editable = creating ? permissions.create : !isSystem && permissions.edit;
  const isOwnRole = !!role && role.id === currentRoleId;
  const scope = role ? roleScope(role) : null;

  const trimmedName = name.trim();
  const renamed = !creating && !!role && trimmedName !== role.name;
  const scopeChanged = !creating && dataScope !== baselineScope;
  const { added, removed } = diffGrants(baseline, grants);
  const dirty = creating || renamed || scopeChanged || added.length > 0 || removed.length > 0;
  const nameError = creating || renamed ? validateRoleName(name, roles, role?.id) : null;
  const emptyError = grants.size === 0;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);

  const discard = () => {
    if (creating) {
      onCancelCreate();
      return;
    }
    setName(role.name);
    setGrants(toGrantSet(role.permissions));
    setDataScope(baselineScope);
    setSubmitted(false);
  };

  const requestSave = () => {
    setSubmitted(true);
    if (nameError || emptyError) return;
    setReviewOpen(true);
  };

  const save = async () => {
    const saved = creating
      ? await createRole({ name: trimmedName, permissions: toPermissions(grants), dataScope })
      : await updateRole(role.id, {
          ...(renamed ? { name: trimmedName } : {}),
          ...(scopeChanged ? { dataScope } : {}),
          ...(added.length > 0 || removed.length > 0 ? { permissions: toPermissions(grants) } : {}),
        });
    onSaved(saved, creating);
  };

  const description = role
    ? role.isSystem
      ? copy.systemRoleDescriptions[role.name] ?? ''
      : copy.customRoleDescription
    : copy.create.description;

  return (
    <Card className="overflow-hidden min-w-0">
      <div className="px-5 py-4 border-b border-base space-y-3">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editable ? (
              <div className="max-w-sm">
                <label htmlFor="role-name" className="sr-only">
                  {copy.editor.nameLabel}
                </label>
                <Input
                  id="role-name"
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!nameError && (submitted || renamed)}
                  className="text-base font-semibold h-9"
                />
                {nameError && (submitted || name !== (role?.name ?? newDraft?.name)) ? (
                  <FieldError message={copy.editor[nameError]} />
                ) : null}
              </div>
            ) : (
              <h2 className="text-base font-semibold text-primary">{role?.name}</h2>
            )}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-secondary">
              {role ? (
                <StatusPill tone={isSystem ? 'neutral' : 'accent'}>{isSystem ? copy.badges.system : copy.badges.custom}</StatusPill>
              ) : null}
              {isOwnRole ? <StatusPill tone="success">{copy.badges.yours}</StatusPill> : null}
              {role ? (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" aria-hidden /> {copy.users(role.userCount)}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {copy.grants(grants.size)}
              </span>
              {scope ? (
                <span title={copy.scope[scope === 'team' ? 'teamHint' : 'selfHint']}>
                  · {copy.scope[scope]} — {copy.scope[scope === 'team' ? 'teamHint' : 'selfHint']}
                </span>
              ) : null}
            </div>
            {description ? <p className="mt-1.5 text-sm text-secondary">{description}</p> : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {role && permissions.create ? (
              <Button variant="secondary" size="sm" onClick={() => onDuplicate(role)}>
                <Copy className="h-3.5 w-3.5" /> {copy.editor.duplicate}
              </Button>
            ) : null}
            {role && !isSystem && permissions.delete ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                disabled={role.userCount > 0}
                title={role.userCount > 0 ? copy.editor.deleteBlocked(role.userCount) : copy.editor.delete}
                aria-label={copy.editor.delete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {isSystem ? (
          <div className="flex items-start gap-2 text-sm text-secondary bg-[rgb(var(--bg-muted))] border border-base rounded-lg px-3 py-2">
            <Lock className="h-4 w-4 shrink-0 mt-0.5 text-muted" aria-hidden />
            <span>
              <span className="font-medium text-primary">{copy.editor.readOnlyTitle}.</span> {copy.editor.readOnlyBody}
            </span>
          </div>
        ) : null}
        {isOwnRole && editable ? (
          <p className="flex items-start gap-2 text-sm text-secondary">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted" aria-hidden />
            {copy.editor.selfWarning}
          </p>
        ) : null}
        {editable ? (
          <div className="max-w-sm">
            <label htmlFor="role-data-scope" className="block text-xs font-medium text-secondary mb-1">
              {copy.scope.fieldLabel}
            </label>
            <Select
              id="role-data-scope"
              value={dataScope}
              onChange={(e) => setDataScope(e.target.value as RoleDataScope)}
            >
              <option value="all" disabled={!actorOrgWide}>
                {copy.scope.options.all}
              </option>
              <option value="team">{copy.scope.options.team}</option>
            </Select>
            <p className="mt-1 text-xs text-muted">{actorOrgWide ? copy.scope.fieldHint : copy.scope.notHeld}</p>
          </div>
        ) : null}
        {creating && newDraft && newDraft.omitted > 0 ? (
          <p className="flex items-start gap-2 text-sm text-warning-700 dark:text-warning-300">
            <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            {copy.editor.omitted(newDraft.omitted)}
          </p>
        ) : null}
      </div>

      <div className="max-h-[62vh] overflow-y-auto">
        <RolePermissionEditor
          definitions={definitions}
          grants={grants}
          baseline={baseline}
          canGrant={canGrant}
          readOnly={!editable}
          lockedGrants={isOwnRole ? SELF_LOCKED : undefined}
          onChange={setGrants}
        />
      </div>

      {editable ? (
        <div className="sticky bottom-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-t border-base surface">
          <div className="text-sm text-secondary min-h-[1.25rem]">
            {submitted && emptyError ? (
              <span className="text-error-600">{copy.editor.permissionRequired}</span>
            ) : !creating && dirty ? (
              copy.editor.unsaved(added.length, removed.length) ||
              (scopeChanged ? copy.scope.changed(copy.scope.options[baselineScope], copy.scope.options[dataScope]) : copy.editor.renamedOnly)
            ) : (
              <span className="text-xs text-muted">{copy.editor.viewRequired}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={discard} disabled={!dirty}>
              {copy.editor.discard}
            </Button>
            <Button variant="primary" onClick={requestSave} disabled={!dirty}>
              {creating ? copy.editor.create : copy.editor.save}
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={reviewOpen}
        tone="primary"
        title={creating ? copy.review.createTitle(trimmedName) : copy.review.title(role.name)}
        confirmLabel={creating ? copy.review.confirmCreate : copy.review.confirm}
        description={
          <RoleChangeSummary
            added={added}
            removed={removed}
            userCount={role?.userCount ?? 0}
            rename={renamed && role ? { from: role.name, to: trimmedName } : undefined}
            scopeChange={
              scopeChanged
                ? { from: copy.scope.options[baselineScope], to: copy.scope.options[dataScope] }
                : undefined
            }
          />
        }
        onConfirm={save}
        onClose={() => setReviewOpen(false)}
      />
      {role ? (
        <ConfirmDialog
          open={deleteOpen}
          title={copy.deleteDialog.title(role.name)}
          confirmLabel={copy.deleteDialog.confirm}
          description={copy.deleteDialog.body}
          onConfirm={async () => {
            await deleteRole(role.id);
            onDeleted(role);
          }}
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}
    </Card>
  );
}
