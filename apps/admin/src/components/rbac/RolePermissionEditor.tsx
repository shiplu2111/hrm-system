import { useEffect, useRef } from 'react';
import type { PermissionAction, PermissionModuleDefinition } from '@hrm/shared-types';
import { rolesCopy as copy } from '@/lib/roles-copy';
import {
  ACTION_ORDER,
  canAdd,
  columnState,
  grantKey,
  groupModules,
  rowState,
  setColumn,
  setRow,
  toggleGrant,
  type CanGrant,
  type GrantSet,
  type ToggleState,
} from '@/lib/role-matrix';

interface Props {
  definitions: PermissionModuleDefinition[];
  grants: GrantSet;
  /** Saved grants; cells that differ are highlighted. */
  baseline: GrantSet;
  canGrant: CanGrant;
  readOnly: boolean;
  /** Grants that must stay on (e.g. settings access on the editor's own role). */
  lockedGrants?: GrantSet;
  onChange: (grants: Set<string>) => void;
}

const NO_LOCKS: GrantSet = new Set();

function MatrixCheckbox({
  state,
  disabled,
  label,
  title,
  onChange,
}: {
  state: ToggleState;
  disabled?: boolean;
  label: string;
  title?: string;
  onChange: (on: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'mixed';
  }, [state]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={state === 'on'}
      disabled={disabled}
      aria-label={label}
      title={title}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-strong accent-accent-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

export function RolePermissionEditor({
  definitions,
  grants,
  baseline,
  canGrant,
  readOnly,
  lockedGrants = NO_LOCKS,
  onChange: emit,
}: Props) {
  const onChange = (next: Set<string>) => {
    for (const key of lockedGrants) if (grants.has(key)) next.add(key);
    emit(next);
  };
  const groups = groupModules(definitions);
  const editable = groups.flatMap((group) => group.modules);
  const platformGranted = definitions.filter(
    (definition) => !definition.grantable && ACTION_ORDER.some((action) => grants.has(grantKey(definition.key, action))),
  );

  const renderRow = (definition: PermissionModuleDefinition, locked: boolean) => {
    const meta = copy.modules[definition.key];
    const label = meta?.label ?? definition.key;
    const state = rowState(grants, definition);
    const canFillRow = definition.actions.some(
      (action) => !grants.has(grantKey(definition.key, action)) && canAdd(grants, definition.key, action, canGrant),
    );
    return (
      <tr key={definition.key} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
        <th scope="row" className="text-left font-normal px-4 py-2.5 align-top">
          <div className="text-sm font-medium text-primary">{label}</div>
          {meta?.description ? <div className="text-xs text-muted mt-0.5">{meta.description}</div> : null}
        </th>
        {ACTION_ORDER.map((action) => {
          const key = grantKey(definition.key, action);
          const granted = grants.has(key);
          const used = definition.actions.includes(action);
          const changed = granted !== baseline.has(key);
          const changeTint = changed
            ? granted
              ? 'bg-success-50 dark:bg-success-900/20'
              : 'bg-error-50 dark:bg-error-900/20'
            : '';
          if (!used && !granted) {
            return (
              <td key={action} className="px-2 py-2.5 text-center text-muted" title={copy.editor.notUsed}>
                <span aria-label={copy.editor.notUsed}>·</span>
              </td>
            );
          }
          const addable = canAdd(grants, definition.key, action, canGrant);
          const pinned = granted && lockedGrants.has(key);
          const disabled = readOnly || locked || pinned || (!granted && !addable);
          const hint = copy.actionHints[key];
          const title = pinned
            ? copy.editor.selfWarning
            : !used
              ? copy.editor.notUsedButGranted
              : !granted && !readOnly && !locked && !addable
                ? copy.editor.notHeld
                : hint;
          return (
            <td key={action} className={`px-2 py-2.5 text-center transition-colors ${changeTint}`}>
              <MatrixCheckbox
                state={granted ? 'on' : 'off'}
                disabled={disabled}
                label={`${label}: ${copy.actions[action]}`}
                title={title}
                onChange={(on) => onChange(toggleGrant(grants, definition.key, action, on))}
              />
              {!used ? <span className="sr-only">{copy.editor.notUsedButGranted}</span> : null}
            </td>
          );
        })}
        <td className="px-3 py-2.5 text-center border-l border-base">
          {readOnly || locked ? null : (
            <MatrixCheckbox
              state={state}
              disabled={state === 'off' && !canFillRow}
              label={copy.editor.rowToggle(label)}
              title={copy.editor.rowToggle(label)}
              onChange={() => onChange(setRow(grants, definition, state !== 'on' && canFillRow, canGrant))}
            />
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="sticky top-0 z-10 bg-[rgb(var(--bg-muted))] shadow-[0_1px_0_rgb(var(--border-base))]">
          <tr>
            <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wide w-[38%]">
              {copy.editor.module}
            </th>
            {ACTION_ORDER.map((action: PermissionAction) => {
              const state = columnState(grants, editable, action);
              const canFillColumn = editable.some(
                (definition) =>
                  definition.actions.includes(action) &&
                  !grants.has(grantKey(definition.key, action)) &&
                  canAdd(grants, definition.key, action, canGrant),
              );
              return (
                <th key={action} scope="col" className="px-2 py-2 text-center">
                  <div className="text-xs font-semibold text-secondary uppercase tracking-wide">{copy.actions[action]}</div>
                  {readOnly ? null : (
                    <div className="mt-1 flex justify-center">
                      <MatrixCheckbox
                        state={state}
                        disabled={state === 'off' && !canFillColumn}
                        label={copy.editor.columnToggle(copy.actions[action])}
                        title={copy.editor.columnToggle(copy.actions[action])}
                        onChange={() => onChange(setColumn(grants, editable, action, state !== 'on' && canFillColumn, canGrant))}
                      />
                    </div>
                  )}
                </th>
              );
            })}
            <th scope="col" className="px-3 py-2.5 text-center text-xs font-semibold text-secondary uppercase tracking-wide border-l border-base">
              {readOnly ? null : copy.editor.allActions}
            </th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.key} className="divide-y divide-[rgb(var(--border-base))] border-t border-base">
            <tr className="bg-[rgb(var(--bg-muted))]/50">
              <th colSpan={ACTION_ORDER.length + 2} scope="colgroup" className="text-left px-4 py-1.5 text-xs font-semibold text-muted uppercase tracking-wide">
                {group.label}
              </th>
            </tr>
            {group.modules.map((definition) => renderRow(definition, false))}
          </tbody>
        ))}
        {platformGranted.length > 0 ? (
          <tbody className="divide-y divide-[rgb(var(--border-base))] border-t border-base">
            <tr className="bg-[rgb(var(--bg-muted))]/50">
              <th colSpan={ACTION_ORDER.length + 2} scope="colgroup" className="text-left px-4 py-1.5 text-xs font-semibold text-muted uppercase tracking-wide">
                {copy.editor.platformGroup}
              </th>
            </tr>
            {platformGranted.map((definition) => renderRow(definition, true))}
          </tbody>
        ) : null}
      </table>
    </div>
  );
}
