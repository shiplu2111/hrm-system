import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { ASSET_CONDITIONS, type EmployeeAssetAssignmentRecord } from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { returnAsset } from '@/lib/assets-api';
import { formatAssetDate, todayIsoDate } from '@/lib/assets-display';
import { ApiError } from '@/lib/tenant-api-client';

export interface ReturnableAsset {
  id: string;
  name: string;
  assetTag: string;
  holderName: string | null;
  assignedAt: string | null;
  conditionOnAssign: string | null;
}

interface ReturnAssetModalProps {
  open: boolean;
  onClose: () => void;
  asset: ReturnableAsset | null;
  /** Links the return to this offboarding step; otherwise the register picks the matching step. */
  offboardingTaskId?: string;
  onReturned: (assignment: EmployeeAssetAssignmentRecord) => void | Promise<void>;
}

export function ReturnAssetModal({ open, onClose, asset, offboardingTaskId, onReturned }: ReturnAssetModalProps) {
  const [form, setForm] = useState({ returnedAt: todayIsoDate(), condition: 'Good', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm({ returnedAt: todayIsoDate(), condition: 'Good', notes: '' });
    setError(null);
  }, [open, asset?.id]);

  const today = todayIsoDate();
  const assignedOn = asset?.assignedAt ? asset.assignedAt.slice(0, 10) : undefined;

  const submit = async () => {
    if (!asset) return;
    if (form.returnedAt > today) {
      setError('The return date cannot be in the future.');
      return;
    }
    if (assignedOn && form.returnedAt && form.returnedAt < assignedOn) {
      setError('The return date cannot be before the asset was assigned.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const assignment = await returnAsset(asset.id, {
        returnedAt: form.returnedAt || undefined,
        conditionOnReturn: form.condition || undefined,
        notes: form.notes.trim() || undefined,
        offboardingTaskId,
      });
      await onReturned(assignment);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to return asset');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={asset ? `Return ${asset.name}` : 'Return asset'}
      description="The asset goes back to available stock. Matching offboarding steps update automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={saving || !asset}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm return
          </Button>
        </>
      }
    >
      {asset ? (
        <div className="space-y-4">
          {error ? (
            <div className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : null}
          <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs">
            <dt className="text-muted">Asset</dt>
            <dd className="text-primary">
              {asset.name} <span className="font-mono text-muted">· {asset.assetTag}</span>
            </dd>
            <dt className="text-muted">Held by</dt>
            <dd className="text-primary">{asset.holderName ?? '—'}</dd>
            <dt className="text-muted">Since</dt>
            <dd className="text-primary">
              {formatAssetDate(asset.assignedAt)}
              {asset.conditionOnAssign ? ` · handed over as "${asset.conditionOnAssign}"` : ''}
            </dd>
          </dl>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="return-date">Returned on</Label>
              <Input
                id="return-date"
                type="date"
                min={assignedOn}
                max={today}
                value={form.returnedAt}
                onChange={(e) => setForm({ ...form, returnedAt: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="return-condition">Condition on return</Label>
              <Select
                id="return-condition"
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
              >
                {ASSET_CONDITIONS.filter((condition) => condition !== 'New').map((condition) => (
                  <option key={condition} value={condition}>
                    {condition}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="return-notes">Notes</Label>
            <Textarea
              id="return-notes"
              rows={2}
              maxLength={1000}
              value={form.notes}
              placeholder="Charger included, screen scratch…"
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
