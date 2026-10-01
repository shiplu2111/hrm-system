import { Fragment } from 'react';
import { ChevronDown, Workflow } from 'lucide-react';
import type { EmployeeRecord } from '@hrm/shared-types';
import { useAuth } from '@hrm/portal-ui';
import { Dropdown, DropdownDivider, DropdownItem, DropdownSection } from '@/components/ui/Dropdown';
import {
  LIFECYCLE_ACTIONS,
  evaluateActionKind,
  roleCanRecord,
  type LifecycleActionKind,
} from '@/lib/lifecycle-actions';

interface LifecycleActionsMenuProps {
  employee: Pick<EmployeeRecord, 'id' | 'employmentStatus'>;
  onSelect: (kind: LifecycleActionKind) => void;
}

const GROUPS = ['Career', 'Status', 'Exit'] as const;

/** Renders nothing when the signed-in role can't record any lifecycle event. */
export function LifecycleActionsMenu({ employee, onSelect }: LifecycleActionsMenuProps) {
  const { user } = useAuth();

  const visible = LIFECYCLE_ACTIONS.filter((action) => roleCanRecord(user, action.kind));
  if (visible.length === 0) return null;

  return (
    <Dropdown
      width="w-80"
      trigger={
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg font-medium h-9 px-4 text-sm gap-2 surface text-primary border border-base hover:bg-[rgb(var(--bg-hover))] transition-colors"
        >
          <Workflow className="h-4 w-4" /> Lifecycle actions
          <ChevronDown className="h-4 w-4 text-muted" />
        </button>
      }
    >
      {GROUPS.map((group, index) => {
        const items = visible.filter((a) => a.group === group);
        if (items.length === 0) return null;
        return (
          <Fragment key={group}>
            {index > 0 && visible.some((a) => GROUPS.indexOf(a.group) < index) ? (
              <DropdownDivider />
            ) : null}
            <DropdownSection label={group}>
              {items.map((action) => {
                const decision = evaluateActionKind(user, action.kind, employee);
                const Icon = action.icon;
                return (
                  <DropdownItem
                    key={action.kind}
                    icon={
                      <Icon
                        className={`h-4 w-4 ${action.group === 'Exit' && decision.allowed ? 'text-error-600' : ''}`}
                      />
                    }
                    disabled={!decision.allowed}
                    title={decision.allowed ? undefined : decision.message}
                    description={decision.allowed ? action.description : decision.message}
                    onClick={() => onSelect(action.kind)}
                  >
                    {action.label}
                  </DropdownItem>
                );
              })}
            </DropdownSection>
          </Fragment>
        );
      })}
    </Dropdown>
  );
}
