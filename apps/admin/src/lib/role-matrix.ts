import type { PermissionAction, PermissionModuleDefinition, RolePermission } from '@hrm/shared-types';
import { rolesCopy } from './roles-copy';

/** Grants keyed as `module:action`. */
export type GrantSet = ReadonlySet<string>;

export const ACTION_ORDER: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'finalize'];
export const SENSITIVE_ACTIONS: ReadonlySet<PermissionAction> = new Set(['approve', 'finalize']);

export const grantKey = (module: string, action: PermissionAction) => `${module}:${action}`;

export function splitGrantKey(key: string): RolePermission {
  const [module, action] = key.split(':');
  return { module, action: action as PermissionAction };
}

export const toGrantSet = (permissions: RolePermission[]): Set<string> =>
  new Set(permissions.map((permission) => grantKey(permission.module, permission.action)));

export const toPermissions = (grants: GrantSet): RolePermission[] => [...grants].sort().map(splitGrantKey);

// ---------------------------------------------------------------------------
// Module grouping
// ---------------------------------------------------------------------------

type GroupKey = keyof typeof rolesCopy.moduleGroups;

const MODULE_GROUPS: Array<{ key: GroupKey; modules: string[] }> = [
  { key: 'people', modules: ['employee', 'leave', 'attendance'] },
  { key: 'payroll', modules: ['payroll', 'contractors'] },
  { key: 'talent', modules: ['recruitment', 'performance', 'training'] },
  { key: 'experience', modules: ['engagement', 'employee_relations', 'health_safety', 'support'] },
  { key: 'admin', modules: ['settings', 'audit'] },
];

export interface ModuleGroup {
  key: string;
  label: string;
  modules: PermissionModuleDefinition[];
}

/** Grantable modules in display groups; modules added to the platform later land in Administration. */
export function groupModules(definitions: PermissionModuleDefinition[]): ModuleGroup[] {
  const grantable = definitions.filter((definition) => definition.grantable);
  const placed = new Set(MODULE_GROUPS.flatMap((group) => group.modules));
  return MODULE_GROUPS.map((group) => ({
    key: group.key,
    label: rolesCopy.moduleGroups[group.key],
    modules: [
      ...group.modules.flatMap((key) => grantable.filter((definition) => definition.key === key)),
      ...(group.key === 'admin' ? grantable.filter((definition) => !placed.has(definition.key)) : []),
    ],
  })).filter((group) => group.modules.length > 0);
}

export const moduleLabel = (key: string) => rolesCopy.modules[key]?.label ?? key;

// ---------------------------------------------------------------------------
// Editing rules
// ---------------------------------------------------------------------------

export type CanGrant = (module: string, action: PermissionAction) => boolean;

/**
 * Whether a cell can be switched on: the editor must hold the permission, and — because every
 * other action implies View — must be able to grant View too if the role lacks it.
 */
export function canAdd(grants: GrantSet, module: string, action: PermissionAction, canGrant: CanGrant): boolean {
  if (!canGrant(module, action)) return false;
  return action === 'view' || grants.has(grantKey(module, 'view')) || canGrant(module, 'view');
}

export function toggleGrant(grants: GrantSet, module: string, action: PermissionAction, on: boolean): Set<string> {
  const next = new Set(grants);
  if (on) {
    next.add(grantKey(module, action));
    if (action !== 'view') next.add(grantKey(module, 'view'));
  } else if (action === 'view') {
    for (const key of grants) if (key.startsWith(`${module}:`)) next.delete(key);
  } else {
    next.delete(grantKey(module, action));
  }
  return next;
}

export function setRow(
  grants: GrantSet,
  definition: PermissionModuleDefinition,
  on: boolean,
  canGrant: CanGrant,
): Set<string> {
  let next = new Set(grants);
  if (!on) return toggleGrant(next, definition.key, 'view', false);
  for (const action of definition.actions) {
    if (canAdd(next, definition.key, action, canGrant)) next = toggleGrant(next, definition.key, action, true);
  }
  return next;
}

export function setColumn(
  grants: GrantSet,
  definitions: PermissionModuleDefinition[],
  action: PermissionAction,
  on: boolean,
  canGrant: CanGrant,
): Set<string> {
  let next = new Set(grants);
  for (const definition of definitions) {
    if (!definition.actions.includes(action)) continue;
    if (!on) next = toggleGrant(next, definition.key, action, false);
    else if (canAdd(next, definition.key, action, canGrant)) next = toggleGrant(next, definition.key, action, true);
  }
  return next;
}

export type ToggleState = 'on' | 'off' | 'mixed';

export function rowState(grants: GrantSet, definition: PermissionModuleDefinition): ToggleState {
  const held = definition.actions.filter((action) => grants.has(grantKey(definition.key, action))).length;
  return held === 0 ? 'off' : held === definition.actions.length ? 'on' : 'mixed';
}

export function columnState(grants: GrantSet, definitions: PermissionModuleDefinition[], action: PermissionAction): ToggleState {
  const applicable = definitions.filter((definition) => definition.actions.includes(action));
  const held = applicable.filter((definition) => grants.has(grantKey(definition.key, action))).length;
  return held === 0 ? 'off' : held === applicable.length ? 'on' : 'mixed';
}

export function diffGrants(before: GrantSet, after: GrantSet): { added: string[]; removed: string[] } {
  return {
    added: [...after].filter((key) => !before.has(key)).sort(),
    removed: [...before].filter((key) => !after.has(key)).sort(),
  };
}

// ---------------------------------------------------------------------------
// Validation (mirrors the API so most problems surface inline)
// ---------------------------------------------------------------------------

export type RoleNameError = 'nameRequired' | 'nameTooShort' | 'nameTooLong' | 'nameReserved' | 'nameTaken';

export function validateRoleName(
  name: string,
  roles: Array<{ id: string; name: string; isSystem: boolean }>,
  excludeRoleId?: string,
): RoleNameError | null {
  const trimmed = name.trim();
  if (!trimmed) return 'nameRequired';
  if (trimmed.length < 2) return 'nameTooShort';
  if (trimmed.length > 100) return 'nameTooLong';
  const lower = trimmed.toLowerCase();
  const clash = roles.find((role) => role.id !== excludeRoleId && role.name.trim().toLowerCase() === lower);
  if (clash) return clash.isSystem ? 'nameReserved' : 'nameTaken';
  if (Object.keys(rolesCopy.systemRoleDescriptions).some((systemName) => systemName.toLowerCase() === lower)) {
    return 'nameReserved';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export type RoleScope = 'team' | 'self' | null;

/** Row-level scoping for default roles (ROLES_PERMISSIONS.md §5), enforced in queries, not permissions. */
export function roleScope(role: { name: string; isSystem: boolean; dataScope?: string }): RoleScope {
  if (role.dataScope === 'team') return 'team';
  if (role.isSystem && role.name === 'Employee') return 'self';
  return null;
}

/** Actions held on a module in §3 order, e.g. "view, create, edit"; null when none. */
export function moduleActions(grants: GrantSet, module: string): PermissionAction[] {
  return ACTION_ORDER.filter((action) => grants.has(grantKey(module, action)));
}

export function describeGrant(key: string): string {
  const { module, action } = splitGrantKey(key);
  return `${moduleLabel(module)} · ${rolesCopy.actions[action] ?? action}`;
}
