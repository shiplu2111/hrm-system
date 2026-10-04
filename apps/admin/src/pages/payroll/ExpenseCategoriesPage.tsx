import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, Loader2, Pencil, Plus, Power } from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type { ExpenseCategoryRecord } from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatusPill } from '@/components/ui/StatusPill';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { pathForPage } from '@/config/routes';
import {
  createExpenseCategory,
  listExpenseCategories,
  updateExpenseCategory,
  type ExpenseCategoryInput,
} from '@/lib/expenses-api';
import { formatMoney } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

const thClass = 'text-left px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';
const numThClass = 'text-right px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function CategoriesContent({ companyId }: { companyId: string }) {
  const routerNavigate = useNavigate();
  const { can } = usePermissions();
  const canEdit = can('payroll', 'edit');

  const [categories, setCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategoryRecord | 'new' | null>(null);
  const [toggling, setToggling] = useState<ExpenseCategoryRecord | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCategories(await listExpenseCategories(companyId, false));
    } catch (err) {
      setError(errorText(err, 'Failed to load expense categories'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const inactiveCount = categories.filter((c) => !c.isActive).length;
  const visible = useMemo(
    () => categories.filter((c) => showInactive || c.isActive),
    [categories, showInactive],
  );

  const toggleActive = async () => {
    if (!toggling) return;
    setToggleBusy(true);
    setError(null);
    try {
      const updated = await updateExpenseCategory(toggling.id, { isActive: !toggling.isActive });
      setNotice(`${updated.name} ${updated.isActive ? 'reactivated' : 'deactivated'}.`);
      setToggling(null);
      await load();
    } catch (err) {
      setToggling(null);
      setError(errorText(err, 'Could not update the category'));
    } finally {
      setToggleBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading categories…
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <button
        type="button"
        onClick={() => routerNavigate(pathForPage('expenses'))}
        className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Expense Claims
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Expense Categories & Limits</h1>
          <p className="text-sm text-secondary mt-0.5">
            What employees can claim, how much, and whether a receipt is required.
          </p>
        </div>
        {canEdit ? (
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> New category
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-4 py-3 text-sm text-success-700 dark:text-success-300">
          {notice}
        </div>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          Limits are checked when a claim is created and again when it is submitted. The monthly limit applies per
          employee and counts their pending, approved and reimbursed claims dated in the same month. Changing a limit
          does not reopen claims already in approval; approvers see a warning if a claim no longer fits.
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-secondary">
          {categories.length - inactiveCount} active {categories.length - inactiveCount === 1 ? 'category' : 'categories'}
          {inactiveCount ? ` · ${inactiveCount} inactive` : ''}
        </p>
        {inactiveCount ? (
          <label className="inline-flex items-center gap-2 text-sm text-secondary">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-base"
            />
            Show inactive
          </label>
        ) : null}
      </div>

      <Card>
        <CardBody className="p-0">
          {visible.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-primary">No expense categories yet</p>
              <p className="mt-1 text-sm text-secondary">
                Employees need at least one active category before they can claim expenses.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className={thClass}>Category</th>
                    <th className={numThClass}>Per claim</th>
                    <th className={numThClass}>Per employee / month</th>
                    <th className={thClass}>Receipt</th>
                    <th className={numThClass}>Claimed this month</th>
                    <th className={numThClass}>Claims</th>
                    <th className={thClass}>Status</th>
                    {canEdit ? <th className="px-4 py-2.5" /> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {visible.map((cat) => (
                    <tr key={cat.id} className={cat.isActive ? undefined : 'opacity-60'}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-primary">{cat.name}</div>
                        {cat.description ? (
                          <div className="text-xs text-muted line-clamp-1">{cat.description}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-primary">
                        {cat.maxAmountPerClaim != null ? formatMoney(cat.maxAmountPerClaim) : <NoLimit />}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-primary">
                        {cat.maxAmountPerMonth != null ? formatMoney(cat.maxAmountPerMonth) : <NoLimit />}
                      </td>
                      <td className="px-4 py-3 text-secondary">{cat.receiptRequired ? 'Required' : 'Optional'}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap text-secondary">
                        {formatMoney(cat.usage?.monthToDateAmount ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="text-accent-600 hover:underline disabled:text-muted disabled:no-underline"
                          disabled={!cat.usage?.claimCount}
                          onClick={() => routerNavigate(`${pathForPage('expenses')}?category=${cat.id}`)}
                        >
                          {cat.usage?.claimCount ?? 0}
                        </button>
                        {cat.usage?.openClaimCount ? (
                          <div className="text-xs text-muted">{cat.usage.openClaimCount} open</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={cat.isActive ? 'success' : 'neutral'}>
                          {cat.isActive ? 'Active' : 'Inactive'}
                        </StatusPill>
                      </td>
                      {canEdit ? (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setEditing(cat)}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setToggling(cat)}>
                              <Power className="h-3.5 w-3.5" /> {cat.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <CategoryModal
        companyId={companyId}
        category={editing}
        onClose={() => setEditing(null)}
        onSaved={async (saved, created) => {
          setEditing(null);
          setNotice(`${saved.name} ${created ? 'created' : 'saved'}.`);
          await load();
        }}
      />

      <Modal
        open={toggling !== null}
        onClose={() => !toggleBusy && setToggling(null)}
        title={toggling?.isActive ? `Deactivate ${toggling.name}?` : `Activate ${toggling?.name ?? ''}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setToggling(null)} disabled={toggleBusy}>
              Back
            </Button>
            <Button
              variant={toggling?.isActive ? 'danger' : 'primary'}
              onClick={() => void toggleActive()}
              disabled={toggleBusy}
            >
              {toggleBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {toggling?.isActive ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-secondary">
          {toggling?.isActive
            ? `New claims can no longer use this category, and drafts in it can't be submitted. Claims already in approval continue as normal.${
                toggling.usage?.openClaimCount
                  ? ` ${toggling.usage.openClaimCount} open ${toggling.usage.openClaimCount === 1 ? 'claim uses' : 'claims use'} it.`
                  : ''
              }`
            : 'Employees will be able to claim expenses in this category again.'}
        </p>
      </Modal>
    </div>
  );
}

function NoLimit() {
  return <span className="text-muted">No limit</span>;
}

function parseLimit(raw: string): { value: number | null; error: string | null } {
  const text = raw.trim();
  if (!text) return { value: null, error: null };
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return { value: null, error: 'Use a positive amount with at most two decimals.' };
  const value = Number(text);
  if (value <= 0) return { value: null, error: 'Leave blank for no limit, or enter an amount above zero.' };
  return { value, error: null };
}

function CategoryModal({
  companyId,
  category,
  onClose,
  onSaved,
}: {
  companyId: string;
  category: ExpenseCategoryRecord | 'new' | null;
  onClose: () => void;
  onSaved: (saved: ExpenseCategoryRecord, created: boolean) => void | Promise<void>;
}) {
  const isNew = category === 'new';
  const existing = category && category !== 'new' ? category : null;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [perClaim, setPerClaim] = useState('');
  const [perMonth, setPerMonth] = useState('');
  const [receiptRequired, setReceiptRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!category) return;
    setName(existing?.name ?? '');
    setDescription(existing?.description ?? '');
    setPerClaim(existing?.maxAmountPerClaim != null ? String(existing.maxAmountPerClaim) : '');
    setPerMonth(existing?.maxAmountPerMonth != null ? String(existing.maxAmountPerMonth) : '');
    setReceiptRequired(existing?.receiptRequired ?? true);
    setError(null);
    setSaving(false);
  }, [category, existing]);

  const claimLimit = parseLimit(perClaim);
  const monthLimit = parseLimit(perMonth);
  const orderError =
    claimLimit.value != null && monthLimit.value != null && claimLimit.value > monthLimit.value
      ? 'The per-claim limit cannot be higher than the monthly limit.'
      : null;

  const save = async () => {
    if (!name.trim()) {
      setError('Enter a category name.');
      return;
    }
    const problem = claimLimit.error ?? monthLimit.error ?? orderError;
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    const input: ExpenseCategoryInput = {
      name: name.trim(),
      description: description.trim() || null,
      maxAmountPerClaim: claimLimit.value,
      maxAmountPerMonth: monthLimit.value,
      receiptRequired,
    };
    try {
      const saved = existing
        ? await updateExpenseCategory(existing.id, input)
        : await createExpenseCategory(companyId, input);
      await onSaved(saved, !existing);
    } catch (err) {
      setError(errorText(err, 'Could not save the category'));
      setSaving(false);
    }
  };

  return (
    <Modal
      open={category !== null}
      onClose={() => !saving && onClose()}
      title={isNew ? 'New expense category' : `Edit ${existing?.name ?? 'category'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isNew ? 'Create category' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="cat-name">Name *</Label>
          <Input
            id="cat-name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Travel & Accommodation"
          />
        </div>
        <div>
          <Label htmlFor="cat-description">Description</Label>
          <Textarea
            id="cat-description"
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What belongs in this category"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cat-per-claim">Limit per claim</Label>
            <Input
              id="cat-per-claim"
              inputMode="decimal"
              value={perClaim}
              onChange={(e) => setPerClaim(e.target.value)}
              placeholder="No limit"
            />
            {claimLimit.error ? <p className="mt-1 text-xs text-error-600">{claimLimit.error}</p> : null}
          </div>
          <div>
            <Label htmlFor="cat-per-month">Limit per employee per month</Label>
            <Input
              id="cat-per-month"
              inputMode="decimal"
              value={perMonth}
              onChange={(e) => setPerMonth(e.target.value)}
              placeholder="No limit"
            />
            {monthLimit.error ? <p className="mt-1 text-xs text-error-600">{monthLimit.error}</p> : null}
          </div>
        </div>
        {orderError ? <p className="text-xs text-error-600">{orderError}</p> : null}
        <p className="text-xs text-muted">Leave a limit blank for no limit. Amounts are in the claim currency.</p>
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={receiptRequired}
            onChange={(e) => setReceiptRequired(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-base"
          />
          <span>
            <span className="text-primary">Receipt required</span>
            <span className="block text-xs text-muted">Claims can't be submitted until a receipt is attached.</span>
          </span>
        </label>
        {existing?.usage?.openClaimCount ? (
          <p className="rounded-md bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs text-secondary">
            {existing.usage.openClaimCount} open {existing.usage.openClaimCount === 1 ? 'claim uses' : 'claims use'}{' '}
            this category. New limits apply to drafts when they are submitted; claims already in approval keep going
            and show a warning if they no longer fit.
          </p>
        ) : null}
        {error ? <p className="text-sm text-error-600">{error}</p> : null}
      </div>
    </Modal>
  );
}

export function ExpenseCategoriesPage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <CategoriesContent companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
