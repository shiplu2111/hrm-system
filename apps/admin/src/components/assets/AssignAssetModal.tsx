import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import {
  ASSET_CATEGORY_LABELS,
  ASSET_CONDITIONS,
  type AssetCategory,
  type CompanyAssetRecord,
  type EmployeeAssetAssignmentRecord,
} from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { assignAsset, listCompanyAssets } from '@/lib/assets-api';
import { formatAssetValue, todayIsoDate } from '@/lib/assets-display';
import { listEmployees } from '@/lib/employees-api';
import { ApiError } from '@/lib/tenant-api-client';

interface AssignAssetModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  /** Fixed recipient (onboarding tracker); otherwise chosen in the modal. */
  employee?: { id: string; fullName: string } | null;
  /** Fixed asset (register row); otherwise chosen from available assets. */
  asset?: CompanyAssetRecord | null;
  /** Restricts the asset list, e.g. to an onboarding provisioning step's category. */
  category?: AssetCategory | null;
  /** Links the assignment to this onboarding step, which it completes. */
  onboardingTaskId?: string;
  title?: string;
  description?: string;
  onAssigned: (assignment: EmployeeAssetAssignmentRecord) => void | Promise<void>;
}

export function AssignAssetModal({
  open,
  onClose,
  companyId,
  employee,
  asset,
  category,
  onboardingTaskId,
  title,
  description,
  onAssigned,
}: AssignAssetModalProps) {
  const [assets, setAssets] = useState<CompanyAssetRecord[]>([]);
  const [people, setPeople] = useState<Array<{ id: string; fullName: string; employeeNumber: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    assetId: '',
    employeeId: '',
    assignedAt: todayIsoDate(),
    condition: 'Good',
    notes: '',
  });

  const fixedAssetId = asset?.id ?? null;
  const fixedEmployeeId = employee?.id ?? null;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setForm({
      assetId: fixedAssetId ?? '',
      employeeId: fixedEmployeeId ?? '',
      assignedAt: todayIsoDate(),
      condition: 'Good',
      notes: '',
    });
    if (fixedAssetId && fixedEmployeeId) return;

    setLoading(true);
    void Promise.all([
      fixedAssetId
        ? Promise.resolve(null)
        : listCompanyAssets(companyId, { status: 'available', category: category ?? undefined }),
      fixedEmployeeId ? Promise.resolve(null) : listEmployees(companyId),
    ])
      .then(([assetRows, employeeRows]) => {
        if (cancelled) return;
        if (assetRows) {
          setAssets(assetRows);
          setForm((prev) => ({ ...prev, assetId: prev.assetId || assetRows[0]?.id || '' }));
        }
        if (employeeRows) {
          setPeople(
            employeeRows
              .filter((e) => e.employmentStatus !== 'terminated')
              .map((e) => ({ id: e.id, fullName: e.fullName, employeeNumber: e.employeeNumber }))
              .sort((a, b) => a.fullName.localeCompare(b.fullName)),
          );
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, fixedAssetId, fixedEmployeeId, category, companyId]);

  const selectedAsset = asset ?? assets.find((row) => row.id === form.assetId) ?? null;
  const categoryLabel = category ? ASSET_CATEGORY_LABELS[category].toLowerCase() : null;
  const today = todayIsoDate();

  const submit = async () => {
    if (!form.assetId || !form.employeeId) return;
    if (form.assignedAt && form.assignedAt > today) {
      setError('The assignment date cannot be in the future.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const assignment = await assignAsset(form.assetId, {
        employeeId: form.employeeId,
        assignedAt: form.assignedAt || undefined,
        conditionOnAssign: form.condition || undefined,
        notes: form.notes.trim() || undefined,
        onboardingTaskId,
      });
      await onAssigned(assignment);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Failed to assign asset');
    } finally {
      setSaving(false);
    }
  };

  const noAssets = !asset && !loading && assets.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={title ?? (asset ? `Assign ${asset.name}` : 'Assign asset')}
      description={description ?? 'Records who holds the asset, from when, and its condition at hand-over.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() => void submit()}
            disabled={saving || loading || !form.assetId || !form.employeeId}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Confirm assignment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? (
          <div className="flex items-start gap-2 text-sm text-error-700 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center text-sm text-secondary">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
          </div>
        ) : noAssets ? (
          <div className="rounded-lg border border-dashed border-strong px-4 py-6 text-center text-sm text-secondary">
            No available {categoryLabel ?? ''} assets in the register. Add one under Operations → Asset
            Management, or return one first.
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="assign-asset">Asset</Label>
                {asset ? (
                  <div className="text-sm text-primary py-2">
                    {asset.name} <span className="font-mono text-xs text-muted">· {asset.assetTag}</span>
                  </div>
                ) : (
                  <Select
                    id="assign-asset"
                    value={form.assetId}
                    onChange={(e) => setForm({ ...form, assetId: e.target.value })}
                  >
                    {assets.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name} · {row.assetTag}
                        {category ? '' : ` (${ASSET_CATEGORY_LABELS[row.category]})`}
                      </option>
                    ))}
                  </Select>
                )}
                {selectedAsset ? (
                  <p className="text-xs text-muted mt-1">
                    {ASSET_CATEGORY_LABELS[selectedAsset.category]}
                    {selectedAsset.serialNumber ? ` · S/N ${selectedAsset.serialNumber}` : ''}
                    {selectedAsset.purchaseValue
                      ? ` · ${formatAssetValue(selectedAsset.purchaseValue, selectedAsset.currency)}`
                      : ''}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="assign-employee">Employee</Label>
                {employee ? (
                  <div className="text-sm text-primary py-2">{employee.fullName}</div>
                ) : (
                  <Select
                    id="assign-employee"
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                  >
                    <option value="">Select employee</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.fullName} ({person.employeeNumber})
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="assign-date">Assigned on</Label>
                <Input
                  id="assign-date"
                  type="date"
                  max={today}
                  value={form.assignedAt}
                  onChange={(e) => setForm({ ...form, assignedAt: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="assign-condition">Condition at hand-over</Label>
                <Select
                  id="assign-condition"
                  value={form.condition}
                  onChange={(e) => setForm({ ...form, condition: e.target.value })}
                >
                  {ASSET_CONDITIONS.map((condition) => (
                    <option key={condition} value={condition}>
                      {condition}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="assign-notes">Notes</Label>
              <Textarea
                id="assign-notes"
                rows={2}
                maxLength={1000}
                value={form.notes}
                placeholder="Accessories included, existing marks…"
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {onboardingTaskId ? (
              <p className="text-xs text-muted">This completes the onboarding step it was opened from.</p>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}
