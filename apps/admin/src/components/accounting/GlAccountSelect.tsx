import type { GlAccountRecord, GlAccountType } from '@hrm/shared-types';
import { Select } from '@/components/ui/Form';
import {
  GL_ACCOUNT_TYPE_LABELS,
  GL_ACCOUNT_TYPE_ORDER,
  accountOptionLabel,
} from '@/lib/accounting-display';

/** Active accounts grouped by type; the current value stays listed even if it is inactive. */
export function GlAccountSelect({
  accounts,
  value,
  onChange,
  emptyLabel,
  allowEmpty = true,
  types,
  disabled,
  ariaLabel,
}: {
  accounts: GlAccountRecord[];
  value: string;
  onChange: (accountId: string) => void;
  emptyLabel: string;
  allowEmpty?: boolean;
  types?: GlAccountType[];
  disabled?: boolean;
  ariaLabel: string;
}) {
  const current = accounts.find((account) => account.id === value);
  const groups = GL_ACCOUNT_TYPE_ORDER.filter((type) => !types || types.includes(type))
    .map((type) => ({
      type,
      rows: accounts.filter((account) => account.accountType === type && account.isActive),
    }))
    .filter((group) => group.rows.length > 0);
  const currentHidden =
    current && (!current.isActive || (types && !types.includes(current.accountType)));

  return (
    <Select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      <option value="" disabled={!allowEmpty && value !== ''}>
        {emptyLabel}
      </option>
      {currentHidden ? (
        <option value={current.id}>
          {accountOptionLabel(current)}
          {current.isActive ? '' : ' (inactive)'}
        </option>
      ) : null}
      {groups.map((group) => (
        <optgroup key={group.type} label={GL_ACCOUNT_TYPE_LABELS[group.type]}>
          {group.rows.map((account) => (
            <option key={account.id} value={account.id}>
              {accountOptionLabel(account)}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
