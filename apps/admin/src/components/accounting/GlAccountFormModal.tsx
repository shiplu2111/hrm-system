import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { GlAccountRecord, GlAccountType } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { createGlAccount, updateGlAccount } from '@/lib/accounting-api';
import { GL_ACCOUNT_TYPE_LABELS, GL_ACCOUNT_TYPE_ORDER } from '@/lib/accounting-display';
import { ApiError } from '@/lib/tenant-api-client';

export function GlAccountFormModal({
  open,
  companyId,
  account,
  onClose,
  onSaved,
}: {
  open: boolean;
  companyId: string;
  /** Edit this account; create a new one when null */
  account: GlAccountRecord | null;
  onClose: () => void;
  onSaved: (account: GlAccountRecord, created: boolean) => void;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<GlAccountType>('expense');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode(account?.code ?? '');
    setName(account?.name ?? '');
    setAccountType(account?.accountType ?? 'expense');
    setError(null);
  }, [open, account]);

  const trimmedCode = code.trim();
  const trimmedName = name.trim();
  const unchanged =
    account != null &&
    trimmedCode === account.code &&
    trimmedName === account.name &&
    accountType === account.accountType;

  const submit = async () => {
    if (!trimmedCode || !trimmedName) {
      setError('Enter an account code and name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = account
        ? await updateGlAccount(account.id, {
            ...(trimmedCode !== account.code ? { code: trimmedCode } : {}),
            ...(trimmedName !== account.name ? { name: trimmedName } : {}),
            ...(accountType !== account.accountType ? { accountType } : {}),
          })
        : await createGlAccount(companyId, { code: trimmedCode, name: trimmedName, accountType });
      onSaved(saved, account == null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={account ? `Edit ${account.code}` : 'Add GL account'}
      description={
        account
          ? 'Changes apply to journal previews and future exports. Past exports keep the code and name they were exported with.'
          : 'Use the same code as the account in your accounting software so imported journals land in the right place.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || unchanged}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {account ? 'Save account' : 'Add account'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {error ? (
          <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-3 py-2 text-sm text-error-700 dark:text-error-300">
            {error}
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
          <div>
            <Label htmlFor="gl-account-code">Code</Label>
            <Input
              id="gl-account-code"
              value={code}
              maxLength={30}
              onChange={(event) => setCode(event.target.value)}
              placeholder="6100"
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor="gl-account-name">Name</Label>
            <Input
              id="gl-account-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="Sales salaries"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="gl-account-type">Type</Label>
          <Select
            id="gl-account-type"
            value={accountType}
            onChange={(event) => setAccountType(event.target.value as GlAccountType)}
          >
            {GL_ACCOUNT_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {GL_ACCOUNT_TYPE_LABELS[type]}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-xs text-muted">
            Wages and employer super post to expense accounts; tax, deductions, net pay and super payable post to
            liability accounts.
          </p>
        </div>
        <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
      </form>
    </Modal>
  );
}
