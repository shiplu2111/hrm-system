import { useState } from 'react';
import { AlertCircle, AlertTriangle, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { TrainingCostCategory, TrainingSessionCostRecord, TrainingSessionRecord } from '@hrm/shared-types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Select } from '@/components/ui/Form';
import { Banner, errorMessage } from '@/components/performance/performance-ui';
import { formatCurrencyAmount } from '@/lib/offboarding-display';
import {
  addSessionCost,
  COST_CATEGORY_LABELS,
  deleteSessionCost,
  updateSessionCost,
} from '@/lib/training-api';

const CATEGORIES = Object.keys(COST_CATEGORY_LABELS) as TrainingCostCategory[];

function amountError(value: string): string | null {
  if (value.trim() === '') return 'Enter an amount.';
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0.01) return 'Enter an amount above zero.';
  if (amount > 1e9) return 'Amount is too large.';
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return 'Use at most 2 decimal places.';
  return null;
}

interface Draft {
  category: TrainingCostCategory;
  description: string;
  amount: string;
}

const EMPTY_DRAFT: Draft = { category: 'venue', description: '', amount: '' };

export function SessionCostsCard({
  session,
  canEdit,
  onChanged,
}: {
  session: TrainingSessionRecord;
  canEdit: boolean;
  onChanged: (session: TrainingSessionRecord, message: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Draft>(EMPTY_DRAFT);
  const [deleting, setDeleting] = useState<TrainingSessionCostRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDraftError, setShowDraftError] = useState(false);

  const money = (value: number | null) => (value == null ? '—' : formatCurrencyAmount(value, session.currency));
  const draftError = amountError(draft.amount);
  const editError = amountError(edit.amount);

  const add = async () => {
    setShowDraftError(true);
    if (draftError || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await addSessionCost(session.id, {
        category: draft.category,
        amount: Number(draft.amount),
        description: draft.description.trim() || undefined,
      });
      setDraft(EMPTY_DRAFT);
      setShowDraftError(false);
      onChanged(updated, `${COST_CATEGORY_LABELS[draft.category]} cost added.`);
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t add the cost'));
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editingId || editError || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateSessionCost(editingId, {
        category: edit.category,
        amount: Number(edit.amount),
        description: edit.description.trim() || null,
      });
      setEditingId(null);
      onChanged(updated, 'Cost updated.');
    } catch (err) {
      setError(errorMessage(err, 'Couldn’t update the cost'));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cost: TrainingSessionCostRecord) => {
    setEditingId(cost.id);
    setEdit({ category: cost.category, description: cost.description ?? '', amount: String(cost.amount) });
    setError(null);
  };

  return (
    <section className="surface rounded-xl border border-base shadow-card">
      <div className="border-b border-base px-5 py-3">
        <h3 className="text-sm font-semibold text-primary">Session costs</h3>
        <p className="mt-0.5 text-xs text-secondary">Recorded in {session.currency}, the company currency.</p>
      </div>

      <dl className="grid grid-cols-3 gap-px bg-[rgb(var(--border-base))] border-b border-base">
        {[
          ['Total cost', money(session.totalCost), `${session.costs.length} cost ${session.costs.length === 1 ? 'line' : 'lines'}`],
          [
            'Per attendee',
            money(session.costPerAttendee),
            session.attendedCount > 0 ? `${session.attendedCount} attended` : 'Once attendance is marked',
          ],
          ['Per enrolled', money(session.costPerEnrolled), `${session.enrolledCount} enrolled`],
        ].map(([label, value, hint]) => (
          <div key={label} className="surface px-4 py-3">
            <dt className="text-xs text-secondary">{label}</dt>
            <dd className="mt-1 text-base font-semibold text-primary">{value}</dd>
            <dd className="text-[11px] text-muted">{hint}</dd>
          </div>
        ))}
      </dl>

      <div className="space-y-3 p-4">
        {session.otherCurrencyCosts.length > 0 ? (
          <Banner icon={AlertTriangle} tone="warning">
            {session.otherCurrencyCosts.map((row) => formatCurrencyAmount(row.amount, row.currency)).join(', ')} was
            recorded in another currency and isn’t included in the totals.
          </Banner>
        ) : null}
        {error ? (
          <Banner icon={AlertCircle} tone="error">
            {error}
          </Banner>
        ) : null}

        {session.costs.length === 0 ? (
          <p className="py-2 text-center text-sm text-secondary">No costs recorded yet.</p>
        ) : (
          <ul className="divide-y divide-[rgb(var(--border-base))] rounded-lg border border-base">
            {session.costs.map((cost) =>
              editingId === cost.id ? (
                <li key={cost.id} className="space-y-2 p-3">
                  <div className="grid gap-2 sm:grid-cols-[140px_1fr_120px]">
                    <Select
                      value={edit.category}
                      onChange={(e) => setEdit({ ...edit, category: e.target.value as TrainingCostCategory })}
                      aria-label="Category"
                    >
                      {CATEGORIES.map((value) => (
                        <option key={value} value={value}>
                          {COST_CATEGORY_LABELS[value]}
                        </option>
                      ))}
                    </Select>
                    <Input
                      value={edit.description}
                      maxLength={200}
                      onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                      placeholder="Description"
                      aria-label="Description"
                    />
                    <Input
                      type="number"
                      min={0.01}
                      step={0.01}
                      value={edit.amount}
                      onChange={(e) => setEdit({ ...edit, amount: e.target.value })}
                      aria-label="Amount"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {editError ? <span className="mr-auto text-xs text-error-600">{editError}</span> : null}
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={saving}>
                      <X className="h-3.5 w-3.5" /> Cancel
                    </Button>
                    <Button size="sm" onClick={() => void saveEdit()} disabled={!!editError || saving}>
                      <Check className="h-3.5 w-3.5" /> Save
                    </Button>
                  </div>
                </li>
              ) : (
                <li key={cost.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-primary">{COST_CATEGORY_LABELS[cost.category]}</span>
                    {cost.description ? (
                      <span className="block truncate text-xs text-muted">{cost.description}</span>
                    ) : null}
                  </span>
                  <span
                    className={`font-mono text-sm ${cost.currency === session.currency ? 'text-primary' : 'text-muted line-through'}`}
                    title={cost.currency === session.currency ? undefined : 'Not included in the totals'}
                  >
                    {formatCurrencyAmount(cost.amount, cost.currency)}
                  </span>
                  {canEdit ? (
                    <span className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(cost)}
                        className="rounded p-1 text-muted hover:bg-[rgb(var(--bg-hover))] hover:text-primary"
                        aria-label={`Edit ${COST_CATEGORY_LABELS[cost.category]} cost`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(cost)}
                        className="rounded p-1 text-muted hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-950/30"
                        aria-label={`Delete ${COST_CATEGORY_LABELS[cost.category]} cost`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        )}

        {canEdit ? (
          <form
            className="space-y-2 rounded-lg border border-dashed border-base p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <div className="grid gap-2 sm:grid-cols-[140px_1fr_120px]">
              <Select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as TrainingCostCategory })}
                aria-label="New cost category"
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {COST_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </Select>
              <Input
                value={draft.description}
                maxLength={200}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Description (optional)"
                aria-label="New cost description"
              />
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                placeholder={`Amount (${session.currency})`}
                aria-label="New cost amount"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              {showDraftError && draftError ? (
                <span className="mr-auto text-xs text-error-600">{draftError}</span>
              ) : null}
              <Button size="sm" type="submit" variant="secondary" disabled={saving}>
                <Plus className="h-3.5 w-3.5" /> Add cost
              </Button>
            </div>
          </form>
        ) : null}
      </div>

      <ConfirmDialog
        open={deleting != null}
        title="Delete cost line?"
        description={
          deleting
            ? `${COST_CATEGORY_LABELS[deleting.category]} · ${formatCurrencyAmount(deleting.amount, deleting.currency)} will be removed from this session’s costs.`
            : undefined
        }
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return;
          const updated = await deleteSessionCost(deleting.id);
          onChanged(updated, 'Cost removed.');
        }}
        onClose={() => setDeleting(null)}
      />
    </section>
  );
}
