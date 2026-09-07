import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  History,
  Laptop,
  Package,
  Plus,
  QrCode,
  Search,
  ShieldCheck,
  UserRound,
  Wrench,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import {
  assignAsset,
  createCompanyAsset,
  listAssetAssignments,
  listCompanyAssets,
  returnAsset,
} from '@/lib/assets-api';
import { listEmployees } from '@/lib/employees-api';
import type { CompanyAssetRecord, EmployeeAssetAssignmentRecord, EmployeeRecord } from '@hrm/shared-types';
import { ApiError } from '@/lib/tenant-api-client';

type AssetStatus = 'Assigned' | 'Available' | 'In repair' | 'Retired';

interface Asset {
  id: string;
  name: string;
  tag: string;
  category: string;
  categoryKey: string;
  employee: string | null;
  employeeId: string | null;
  status: AssetStatus;
  purchased: string;
  warranty: string;
  serial: string;
  value: string;
}

const CATEGORY_OPTIONS = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'monitor', label: 'Monitor' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'phone', label: 'Phone' },
  { value: 'sim', label: 'SIM' },
  { value: 'accessory', label: 'Accessory' },
  { value: 'id_card', label: 'ID Card' },
  { value: 'equipment', label: 'Equipment' },
] as const;


const maintenance = [
  { date: '22 May 2025', service: 'Initial device inspection', provider: 'Internal IT', cost: '$0', status: 'Completed' },
  { date: '18 Jul 2025', service: 'BIOS and firmware update', provider: 'Internal IT', cost: '$0', status: 'Completed' },
];

const statusTone: Record<AssetStatus, 'success' | 'accent' | 'warning' | 'neutral'> = {
  Assigned: 'accent',
  Available: 'success',
  'In repair': 'warning',
  Retired: 'neutral',
};

function mapApiAsset(row: CompanyAssetRecord): Asset {
  const statusMap: Record<string, AssetStatus> = {
    assigned: 'Assigned',
    available: 'Available',
    in_repair: 'In repair',
    retired: 'Retired',
  };
  const categoryMap: Record<string, string> = Object.fromEntries(
    CATEGORY_OPTIONS.map((item) => [item.value, item.label]),
  );
  return {
    id: row.id,
    name: row.name,
    tag: row.assetTag,
    category: categoryMap[row.category] ?? row.category,
    categoryKey: row.category,
    employee: row.assignedEmployeeName,
    employeeId: row.assignedEmployeeId,
    status: statusMap[row.status] ?? 'Available',
    purchased: row.purchaseDate
      ? new Date(`${row.purchaseDate}T00:00:00`).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '—',
    warranty: row.warrantyExpiryDate
      ? new Date(`${row.warrantyExpiryDate}T00:00:00`).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '—',
    serial: row.serialNumber ?? '—',
    value: row.purchaseValue ? `$${row.purchaseValue}` : '—',
  };
}

export function AssetManagementPage() {
  const { companyId } = useCompany();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [assignments, setAssignments] = useState<EmployeeAssetAssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [assetId, setAssetId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [conditionOnAssign, setConditionOnAssign] = useState('New');
  const [conditionOnReturn, setConditionOnReturn] = useState('Good');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [newAsset, setNewAsset] = useState({
    name: '',
    assetTag: '',
    category: 'laptop',
    serialNumber: '',
    purchaseDate: '',
    warrantyExpiryDate: '',
    purchaseValue: '',
  });

  const loadAssets = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [rows, employeeRows] = await Promise.all([
        listCompanyAssets(companyId),
        listEmployees(companyId),
      ]);
      setAssets(rows.map(mapApiAsset));
      setEmployees(employeeRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const loadAssignments = useCallback(async (assetIdToLoad: string) => {
    if (!companyId) return;
    const rows = await listAssetAssignments(companyId, { activeOnly: false });
    setAssignments(rows.filter((row) => row.assetId === assetIdToLoad));
  }, [companyId]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  useEffect(() => {
    if (selectedAsset) {
      void loadAssignments(selectedAsset.id);
    } else {
      setAssignments([]);
    }
  }, [selectedAsset, loadAssignments]);

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesSearch = !query || [asset.name, asset.tag, asset.category, asset.employee ?? '', asset.serial]
        .some((value) => value.toLowerCase().includes(query));
      return matchesSearch && (category === 'All' || asset.category === category) && (status === 'All' || asset.status === status);
    });
  }, [assets, category, search, status]);

  const assignableAssets = assets.filter((asset) => asset.status === 'Available');

  const handleAssign = async () => {
    if (!assetId || !employeeId) return;
    setSaving(true);
    setError(null);
    try {
      await assignAsset(assetId, {
        employeeId,
        assignedAt: assignmentDate,
        conditionOnAssign: conditionOnAssign.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setAssignOpen(false);
      await loadAssets();
      if (selectedAsset?.id === assetId) {
        const refreshed = await listCompanyAssets(companyId!);
        const updated = refreshed.find((row) => row.id === assetId);
        if (updated) setSelectedAsset(mapApiAsset(updated));
        await loadAssignments(assetId);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign asset');
    } finally {
      setSaving(false);
    }
  };

  const handleReturn = async () => {
    if (!selectedAsset) return;
    setSaving(true);
    setError(null);
    try {
      await returnAsset(selectedAsset.id, {
        conditionOnReturn: conditionOnReturn.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setReturnOpen(false);
      setSelectedAsset(null);
      await loadAssets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to return asset');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!companyId || !newAsset.name.trim() || !newAsset.assetTag.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createCompanyAsset(companyId, {
        name: newAsset.name.trim(),
        assetTag: newAsset.assetTag.trim(),
        category: newAsset.category as CompanyAssetRecord['category'],
        serialNumber: newAsset.serialNumber.trim() || undefined,
        purchaseDate: newAsset.purchaseDate || undefined,
        warrantyExpiryDate: newAsset.warrantyExpiryDate || undefined,
        purchaseValue: newAsset.purchaseValue ? Number(newAsset.purchaseValue) : undefined,
      });
      setCreateOpen(false);
      setNewAsset({
        name: '',
        assetTag: '',
        category: 'laptop',
        serialNumber: '',
        purchaseDate: '',
        warrantyExpiryDate: '',
        purchaseValue: '',
      });
      await loadAssets();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create asset');
    } finally {
      setSaving(false);
    }
  };

  if (selectedAsset) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
        <button onClick={() => setSelectedAsset(null)} className="inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-accent-600">
          <ArrowLeft className="h-4 w-4" /> Back to asset inventory
        </button>

        <div className="surface flex flex-col gap-5 rounded-xl border border-base p-5 shadow-card md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400">
              <Laptop className="h-7 w-7" />
            </div>
            <div>
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-primary">{selectedAsset.name}</h1>
                <Badge tone={statusTone[selectedAsset.status]} dot>{selectedAsset.status}</Badge>
              </div>
              <p className="font-mono text-xs text-secondary">{selectedAsset.tag} · S/N {selectedAsset.serial}</p>
            </div>
          </div>
          <Button onClick={() => { setAssetId(selectedAsset.id); setAssignOpen(true); }} disabled={selectedAsset.status !== 'Available'}>
            <UserRound className="h-4 w-4" /> Assign asset
          </Button>
          {selectedAsset.status === 'Assigned' && (
            <Button variant="secondary" onClick={() => setReturnOpen(true)}>
              Return asset
            </Button>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className="surface rounded-xl border border-base shadow-card">
              <div className="flex items-center gap-2 border-b border-base px-5 py-4">
                <History className="h-4 w-4 text-accent-500" />
                <h2 className="text-sm font-semibold text-primary">Asset history</h2>
              </div>
              <div className="p-5">
                {assignments.length === 0 ? (
                  <p className="text-sm text-secondary">No assignment history yet.</p>
                ) : (
                  assignments.map((event, index) => (
                    <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
                      {index < assignments.length - 1 && (
                        <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-[rgb(var(--border-base))]" />
                      )}
                      <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent-200 bg-accent-50 text-accent-600 dark:border-accent-800 dark:bg-accent-950/40 dark:text-accent-400">
                        <Package className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-primary">
                          {event.status === 'active' ? 'Assigned to' : 'Returned by'} {event.employeeName}
                        </div>
                        <div className="mt-0.5 text-xs text-secondary">
                          {event.status === 'active'
                            ? `Condition: ${event.conditionOnAssign ?? '—'}`
                            : `Return condition: ${event.conditionOnReturn ?? '—'}`}
                        </div>
                        <div className="mt-1 text-[11px] text-muted">
                          {new Date(event.status === 'active' ? event.assignedAt : event.returnedAt ?? event.assignedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
              <div className="flex items-center justify-between border-b border-base px-5 py-4">
                <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-accent-500" /><h2 className="text-sm font-semibold text-primary">Maintenance log</h2></div>
                <Button size="sm" variant="secondary"><Plus className="h-3.5 w-3.5" /> Log service</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                    <tr><th className="px-5 py-3">Date</th><th className="px-5 py-3">Service</th><th className="px-5 py-3">Provider</th><th className="px-5 py-3">Cost</th><th className="px-5 py-3">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[rgb(var(--border-base))]">
                    {maintenance.map((item) => (
                      <tr key={item.date + item.service}>
                        <td className="whitespace-nowrap px-5 py-3 text-secondary">{item.date}</td>
                        <td className="px-5 py-3 font-medium text-primary">{item.service}</td>
                        <td className="px-5 py-3 text-secondary">{item.provider}</td>
                        <td className="px-5 py-3 font-mono text-primary">{item.cost}</td>
                        <td className="px-5 py-3"><Badge tone="success">{item.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="space-y-5">
            <section className="surface rounded-xl border border-base p-5 shadow-card">
              <h2 className="mb-4 text-sm font-semibold text-primary">Asset information</h2>
              <dl className="space-y-3 text-sm">
                {[
                  ['Category', selectedAsset.category],
                  ['Purchase date', selectedAsset.purchased],
                  ['Warranty through', selectedAsset.warranty],
                  ['Purchase value', selectedAsset.value],
                  ['Assigned to', selectedAsset.employee ?? 'Unassigned'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-base pb-3 last:border-0 last:pb-0">
                    <dt className="text-secondary">{label}</dt><dd className="text-right font-medium text-primary">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="surface rounded-xl border border-base p-5 text-center shadow-card">
              <div className="mb-4 flex items-center justify-between text-left">
                <div><h2 className="text-sm font-semibold text-primary">QR asset label</h2><p className="mt-0.5 text-xs text-secondary">Ready for 50 × 30 mm print</p></div>
                <Badge tone="accent">Preview</Badge>
              </div>
              <div className="mx-auto w-52 rounded-lg border-2 border-slate-900 bg-white p-3 text-slate-950">
                <div className="flex items-center gap-3">
                  <QrCode className="h-20 w-20 shrink-0" strokeWidth={1.4} />
                  <div className="text-left"><div className="text-xs font-bold">COMPANY ADMIN</div><div className="mt-1 text-[10px] font-semibold">{selectedAsset.tag}</div><div className="mt-1 text-[9px]">{selectedAsset.name}</div></div>
                </div>
              </div>
              <Button className="mt-4 w-full" variant="secondary" size="sm">Print label</Button>
            </section>
          </div>
        </div>

        <AssignAssetModal open={assignOpen} onClose={() => setAssignOpen(false)} assets={assignableAssets} assetId={assetId} setAssetId={setAssetId} employees={employees} employeeId={employeeId} setEmployeeId={setEmployeeId} assignmentDate={assignmentDate} setAssignmentDate={setAssignmentDate} conditionOnAssign={conditionOnAssign} setConditionOnAssign={setConditionOnAssign} notes={notes} setNotes={setNotes} onAssign={() => void handleAssign()} saving={saving} />
        <ReturnAssetModal open={returnOpen} onClose={() => setReturnOpen(false)} conditionOnReturn={conditionOnReturn} setConditionOnReturn={setConditionOnReturn} notes={notes} setNotes={setNotes} onReturn={() => void handleReturn()} saving={saving} />
      </div>
    );
  }

  const assignedCount = assets.filter((asset) => asset.status === 'Assigned').length;
  const availableCount = assets.filter((asset) => asset.status === 'Available').length;
  const expiringCount = assets.filter((asset) => asset.warranty.includes('2026') || asset.warranty === 'Expired').length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div><h1 className="text-xl font-bold text-primary">Asset Management</h1><p className="mt-0.5 text-sm text-secondary">Track company equipment, ownership, warranty, and maintenance.</p></div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Add asset</Button>
          <Button onClick={() => setAssignOpen(true)}><Plus className="h-4 w-4" /> Assign Asset</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-secondary">Loading assets…</div>
      ) : (
      <>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total assets', value: assets.length, icon: Package, color: 'text-accent-600 bg-accent-50 dark:bg-accent-950/40' },
          { label: 'Assigned', value: assignedCount, icon: UserRound, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40' },
          { label: 'Available', value: availableCount, icon: CheckCircle2, color: 'text-success-600 bg-success-50 dark:bg-success-950/40' },
          { label: 'Warranty attention', value: expiringCount, icon: CalendarDays, color: 'text-warning-600 bg-warning-50 dark:bg-warning-950/40' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="surface flex items-center gap-3 rounded-xl border border-base p-4 shadow-card">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}><Icon className="h-5 w-5" /></div>
            <div><div className="text-xl font-bold text-primary">{value}</div><div className="text-xs text-secondary">{label}</div></div>
          </div>
        ))}
      </div>

      <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
        <div className="flex flex-col gap-3 border-b border-base p-4 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search asset, tag, employee, or serial…" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select className="sm:w-40" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option>All</option>{CATEGORY_OPTIONS.map((item) => <option key={item.value}>{item.label}</option>)}
            </Select>
            <Select className="sm:w-40" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option>All</option>{['Assigned', 'Available', 'In repair', 'Retired'].map((item) => <option key={item}>{item}</option>)}
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] font-semibold uppercase tracking-wide text-secondary">
              <tr><th className="px-5 py-3">Asset / tag</th><th className="px-5 py-3">Category</th><th className="px-5 py-3">Employee</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Purchased</th><th className="px-5 py-3">Warranty</th><th className="px-5 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--border-base))]">
              {filteredAssets.map((asset) => (
                <tr key={asset.id} onClick={() => setSelectedAsset(asset)} className="cursor-pointer transition-colors hover:bg-[rgb(var(--bg-hover))]">
                  <td className="px-5 py-3.5"><div className="font-semibold text-primary">{asset.name}</div><div className="mt-0.5 font-mono text-[11px] text-muted">{asset.tag}</div></td>
                  <td className="px-5 py-3.5 text-secondary">{asset.category}</td>
                  <td className="px-5 py-3.5">{asset.employee ? <div className="flex items-center gap-2"><Avatar name={asset.employee} size="sm" /><span className="whitespace-nowrap font-medium text-primary">{asset.employee}</span></div> : <span className="text-muted">Unassigned</span>}</td>
                  <td className="px-5 py-3.5"><Badge tone={statusTone[asset.status]} dot>{asset.status}</Badge></td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-secondary">{asset.purchased}</td>
                  <td className="whitespace-nowrap px-5 py-3.5"><span className={asset.warranty === 'Expired' ? 'text-error-600 dark:text-error-400' : 'text-secondary'}>{asset.warranty}</span></td>
                  <td className="px-5 py-3.5 text-right"><ChevronRight className="ml-auto h-4 w-4 text-muted" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAssets.length === 0 && <div className="p-10 text-center text-sm text-secondary">No assets match these filters.</div>}
        </div>
      </section>
      </>
      )}

      <AssignAssetModal open={assignOpen} onClose={() => setAssignOpen(false)} assets={assignableAssets} assetId={assetId} setAssetId={setAssetId} employees={employees} employeeId={employeeId} setEmployeeId={setEmployeeId} assignmentDate={assignmentDate} setAssignmentDate={setAssignmentDate} conditionOnAssign={conditionOnAssign} setConditionOnAssign={setConditionOnAssign} notes={notes} setNotes={setNotes} onAssign={() => void handleAssign()} saving={saving} />
      <CreateAssetModal open={createOpen} onClose={() => setCreateOpen(false)} newAsset={newAsset} setNewAsset={setNewAsset} onCreate={() => void handleCreate()} saving={saving} />
    </div>
  );
}

interface AssignAssetModalProps {
  open: boolean;
  onClose: () => void;
  assets: Asset[];
  assetId: string;
  setAssetId: (value: string) => void;
  employees: EmployeeRecord[];
  employeeId: string;
  setEmployeeId: (value: string) => void;
  assignmentDate: string;
  setAssignmentDate: (value: string) => void;
  conditionOnAssign: string;
  setConditionOnAssign: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  onAssign: () => void;
  saving: boolean;
}

function AssignAssetModal({ open, onClose, assets, assetId, setAssetId, employees, employeeId, setEmployeeId, assignmentDate, setAssignmentDate, conditionOnAssign, setConditionOnAssign, notes, setNotes, onAssign, saving }: AssignAssetModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Assign Asset"
      description="Record custody, assigned date, and condition."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={onAssign} disabled={!assetId || !employeeId || saving}>Confirm assignment</Button></>}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Asset</Label><Select value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">Select available asset</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.tag}</option>)}</Select></div>
          <div><Label>Employee</Label><Select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Select employee</option>{employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}</Select></div>
        </div>
        <div><Label>Assignment date</Label><Input type="date" value={assignmentDate} onChange={(event) => setAssignmentDate(event.target.value)} /></div>
        <div><Label>Condition on assign</Label><Input value={conditionOnAssign} onChange={(event) => setConditionOnAssign(event.target.value)} placeholder="New, Good, Fair…" /></div>
        <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Accessories included, existing marks…" /></div>
      </div>
    </Modal>
  );
}

interface CreateAssetModalProps {
  open: boolean;
  onClose: () => void;
  newAsset: {
    name: string;
    assetTag: string;
    category: string;
    serialNumber: string;
    purchaseDate: string;
    warrantyExpiryDate: string;
    purchaseValue: string;
  };
  setNewAsset: Dispatch<SetStateAction<CreateAssetModalProps['newAsset']>>;
  onCreate: () => void;
  saving: boolean;
}

function CreateAssetModal({ open, onClose, newAsset, setNewAsset, onCreate, saving }: CreateAssetModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add asset to register"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onCreate} disabled={!newAsset.name.trim() || !newAsset.assetTag.trim() || saving}>
            Create asset
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Name</Label><Input value={newAsset.name} onChange={(e) => setNewAsset((v) => ({ ...v, name: e.target.value }))} /></div>
          <div><Label>Asset tag</Label><Input value={newAsset.assetTag} onChange={(e) => setNewAsset((v) => ({ ...v, assetTag: e.target.value }))} /></div>
        </div>
        <div><Label>Category</Label><Select value={newAsset.category} onChange={(e) => setNewAsset((v) => ({ ...v, category: e.target.value }))}>{CATEGORY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div>
        <div><Label>Serial number</Label><Input value={newAsset.serialNumber} onChange={(e) => setNewAsset((v) => ({ ...v, serialNumber: e.target.value }))} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Purchase date</Label><Input type="date" value={newAsset.purchaseDate} onChange={(e) => setNewAsset((v) => ({ ...v, purchaseDate: e.target.value }))} /></div>
          <div><Label>Warranty expiry</Label><Input type="date" value={newAsset.warrantyExpiryDate} onChange={(e) => setNewAsset((v) => ({ ...v, warrantyExpiryDate: e.target.value }))} /></div>
        </div>
        <div><Label>Purchase value</Label><Input type="number" min={0} value={newAsset.purchaseValue} onChange={(e) => setNewAsset((v) => ({ ...v, purchaseValue: e.target.value }))} /></div>
      </div>
    </Modal>
  );
}

interface ReturnAssetModalProps {
  open: boolean;
  onClose: () => void;
  conditionOnReturn: string;
  setConditionOnReturn: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  onReturn: () => void;
  saving: boolean;
}

function ReturnAssetModal({ open, onClose, conditionOnReturn, setConditionOnReturn, notes, setNotes, onReturn, saving }: ReturnAssetModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Return asset"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onReturn} disabled={saving}>Confirm return</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div><Label>Condition on return</Label><Input value={conditionOnReturn} onChange={(event) => setConditionOnReturn(event.target.value)} placeholder="Good, Fair, Damaged…" /></div>
        <div><Label>Notes</Label><Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
      </div>
    </Modal>
  );
}
