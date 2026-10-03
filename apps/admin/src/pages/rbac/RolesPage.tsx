import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Plus, Search, Users, X } from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type { PermissionCatalog, TenantRoleRecord } from '@hrm/shared-types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Form';
import { StatusPill } from '@/components/ui/StatusPill';
import { OrgErrorBanner, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { CreateRoleModal } from '@/components/rbac/CreateRoleModal';
import { RoleDetailPanel, type NewRoleDraft } from '@/components/rbac/RoleDetailPanel';
import { RoleMatrixOverview } from '@/components/rbac/RoleMatrixOverview';
import { useNav } from '@/context/NavContext';
import { pathForPage } from '@/config/routes';
import { getPermissionCatalog, listRoles } from '@/lib/roles-api';
import { rolesCopy as copy } from '@/lib/roles-copy';
import { roleScope, toGrantSet, type CanGrant } from '@/lib/role-matrix';
import { ApiError } from '@/lib/tenant-api-client';

const SYSTEM_ORDER = Object.keys(copy.systemRoleDescriptions);

function sortRoles(roles: TenantRoleRecord[]): TenantRoleRecord[] {
  const rank = (role: TenantRoleRecord) => {
    const index = SYSTEM_ORDER.indexOf(role.name);
    return role.isSystem ? (index === -1 ? SYSTEM_ORDER.length : index) : SYSTEM_ORDER.length + 1;
  };
  return [...roles].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

export function RolesPage() {
  const { current, navigate: navigatePage } = useNav();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, can } = usePermissions();
  const view = current === 'rbac-matrix' ? 'matrix' : 'roles';

  const [roles, setRoles] = useState<TenantRoleRecord[] | null>(null);
  const [catalog, setCatalog] = useState<PermissionCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState<NewRoleDraft | null>(null);
  const [createModal, setCreateModal] = useState<{ templateId: string | null } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const permissions = {
    create: can('settings', 'create'),
    edit: can('settings', 'edit'),
    delete: can('settings', 'delete'),
  };
  const canGrant = useCallback<CanGrant>((module, action) => can(module, action), [can]);
  const actorOrgWide = user?.dataScope !== 'team';

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [roleList, permissionCatalog] = await Promise.all([listRoles(), getPermissionCatalog()]);
      setRoles(sortRoles(roleList));
      setCatalog(permissionCatalog);
    } catch (err) {
      setLoadError(err instanceof ApiError || err instanceof Error ? err.message : copy.loadError);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const confirmLeave = () => !dirty || window.confirm(copy.editor.discardConfirm);

  const selected = useMemo(() => {
    if (!roles || creating) return null;
    return roles.find((role) => role.id === searchParams.get('role')) ?? roles[0] ?? null;
  }, [roles, creating, searchParams]);

  const setRoleParam = (id: string | null) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('role', id);
        else next.delete('role');
        return next;
      },
      { replace: true },
    );

  const selectRole = (role: TenantRoleRecord) => {
    if (role.id === selected?.id && !creating) return;
    if (!confirmLeave()) return;
    setCreating(null);
    setRoleParam(role.id);
  };

  const switchView = (next: 'roles' | 'matrix') => {
    if (next === view || (next === 'matrix' && !confirmLeave())) return;
    setCreating(null);
    navigatePage(next === 'matrix' ? 'rbac-matrix' : 'rbac-roles');
  };

  const openFromMatrix = (role: TenantRoleRecord) => navigate(`${pathForPage('rbac-roles')}?role=${role.id}`);

  const startCreate = ({ name, template }: { name: string; template: TenantRoleRecord | null }) => {
    if (!confirmLeave()) return;
    const grantable = new Set(catalog?.moduleDefinitions.filter((definition) => definition.grantable).map((d) => d.key));
    const source = template ? template.permissions : [];
    const kept = source.filter((permission) => grantable.has(permission.module) && canGrant(permission.module, permission.action));
    setCreating({
      name,
      grants: toGrantSet(kept),
      omitted: source.length - kept.length,
      dataScope: actorOrgWide ? template?.dataScope ?? 'all' : 'team',
    });
    setCreateModal(null);
    setNotice(null);
    if (view !== 'roles') navigatePage('rbac-roles');
  };

  const onSaved = (saved: TenantRoleRecord, created: boolean) => {
    setRoles((prev) => sortRoles([...(prev ?? []).filter((role) => role.id !== saved.id), saved]));
    setNotice(created ? copy.editor.created(saved.name) : copy.editor.saved(saved.name));
    setRevision((n) => n + 1);
    if (created) {
      setCreating(null);
      setRoleParam(saved.id);
    }
  };

  const onDeleted = (deleted: TenantRoleRecord) => {
    setRoles((prev) => (prev ?? []).filter((role) => role.id !== deleted.id));
    setNotice(copy.editor.deleted(deleted.name));
    setRoleParam(null);
  };

  const onDirtyChange = useCallback((next: boolean) => setDirty(next), []);

  const query = search.trim().toLowerCase();
  const visible = roles?.filter((role) => !query || role.name.toLowerCase().includes(query)) ?? [];
  const systemRoles = visible.filter((role) => role.isSystem);
  const customRoles = visible.filter((role) => !role.isSystem);

  const renderRoleButton = (role: TenantRoleRecord) => {
    const active = !creating && role.id === selected?.id;
    const scope = roleScope(role);
    return (
      <li key={role.id}>
        <button
          type="button"
          onClick={() => selectRole(role)}
          aria-current={active ? 'true' : undefined}
          className={`w-full text-left px-4 py-2.5 border-l-2 transition-colors ${
            active ? 'border-accent-600 bg-accent-50 dark:bg-accent-950/40' : 'border-transparent hover:bg-[rgb(var(--bg-hover))]'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className={`text-sm font-medium truncate ${active ? 'text-accent-700 dark:text-accent-300' : 'text-primary'}`}>
              {role.name}
            </span>
            {role.id === user?.roleId ? <StatusPill tone="success">{copy.badges.yours}</StatusPill> : null}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
            <Users className="h-3 w-3" aria-hidden />
            {copy.users(role.userCount)}
            {scope ? <span>· {copy.scope[scope]}</span> : null}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{copy.eyebrow}</p>
          <h1 className="text-xl font-bold text-primary">{copy.title}</h1>
          <p className="text-sm text-secondary mt-0.5 max-w-2xl">{copy.description}</p>
        </div>
        {permissions.create && roles ? (
          <Button variant="primary" onClick={() => setCreateModal({ templateId: null })}>
            <Plus className="h-4 w-4" /> {copy.newRole}
          </Button>
        ) : null}
      </div>

      <div role="tablist" aria-label={copy.views.label} className="inline-flex p-1 rounded-lg border border-base surface gap-1">
        {(['roles', 'matrix'] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={entry === view}
            onClick={() => switchView(entry)}
            className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
              entry === view ? 'bg-accent-600 text-white shadow-sm' : 'text-secondary hover:text-primary'
            }`}
          >
            {copy.views[entry]}
          </button>
        ))}
      </div>

      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-700 dark:border-success-900/50 dark:bg-success-900/20 dark:text-success-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1">{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label={copy.dismiss} className="opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {loadError ? (
        <OrgErrorBanner message={loadError} onRetry={() => void load()} />
      ) : !roles || !catalog ? (
        <Card className="overflow-hidden">
          <OrgTableSkeleton columns={6} rows={8} />
        </Card>
      ) : view === 'matrix' ? (
        <RoleMatrixOverview roles={roles} definitions={catalog.moduleDefinitions} onSelect={openFromMatrix} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] items-start">
          <Card className="overflow-hidden lg:sticky lg:top-4">
            <div className="p-3 border-b border-base">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={copy.searchPlaceholder}
                  aria-label={copy.searchPlaceholder}
                  className="pl-8"
                />
              </div>
            </div>
            <nav aria-label={copy.title} className="py-1.5 max-h-[40vh] lg:max-h-[70vh] overflow-y-auto">
              {visible.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">{copy.noMatch}</p>
              ) : (
                <>
                  {systemRoles.length > 0 ? (
                    <>
                      <p className="px-4 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{copy.defaultRoles}</p>
                      <ul>{systemRoles.map(renderRoleButton)}</ul>
                    </>
                  ) : null}
                  <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">{copy.customRoles}</p>
                  {creating ? (
                    <p className="mx-0 px-4 py-2.5 border-l-2 border-accent-600 bg-accent-50 dark:bg-accent-950/40 text-sm font-medium text-accent-700 dark:text-accent-300 truncate">
                      {creating.name}
                    </p>
                  ) : null}
                  {customRoles.length > 0 ? (
                    <ul>{customRoles.map(renderRoleButton)}</ul>
                  ) : !creating ? (
                    <p className="px-4 py-2 text-sm text-muted">{query ? copy.noMatch : copy.noCustomRoles}</p>
                  ) : null}
                </>
              )}
            </nav>
          </Card>

          {creating || selected ? (
            <RoleDetailPanel
              key={creating ? 'new' : `${selected?.id}:${revision}`}
              role={creating ? null : selected}
              newDraft={creating}
              roles={roles}
              definitions={catalog.moduleDefinitions}
              canGrant={canGrant}
              actorOrgWide={actorOrgWide}
              permissions={permissions}
              currentRoleId={user?.roleId ?? null}
              onDirtyChange={onDirtyChange}
              onSaved={onSaved}
              onDeleted={onDeleted}
              onDuplicate={(role) => setCreateModal({ templateId: role.id })}
              onCancelCreate={() => setCreating(null)}
            />
          ) : null}
        </div>
      )}

      {roles ? (
        <CreateRoleModal
          open={createModal !== null}
          roles={roles}
          initialTemplateId={createModal?.templateId}
          onClose={() => setCreateModal(null)}
          onContinue={startCreate}
        />
      ) : null}
    </div>
  );
}
