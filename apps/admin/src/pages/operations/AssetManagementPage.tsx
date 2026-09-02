import { useMemo, useState } from 'react';
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

type AssetStatus = 'Assigned' | 'Available' | 'In repair' | 'Retired';

interface Asset {
  id: string;
  name: string;
  tag: string;
  category: string;
  employee: string | null;
  status: AssetStatus;
  purchased: string;
  warranty: string;
  serial: string;
  value: string;
}

const initialAssets: Asset[] = [
  { id: 'a1', name: 'MacBook Pro 14"', tag: 'AST-LAP-1048', category: 'Laptop', employee: 'Nadia Rahman', status: 'Assigned', purchased: '12 Feb 2025', warranty: '11 Feb 2028', serial: 'C02ZX19QMD6T', value: '$2,399' },
  { id: 'a2', name: 'Dell UltraSharp U2723QE', tag: 'AST-MON-0831', category: 'Monitor', employee: 'Arif Hassan', status: 'Assigned', purchased: '03 Nov 2024', warranty: '02 Nov 2027', serial: 'CN0J7K2L8', value: '$629' },
  { id: 'a3', name: 'Lenovo ThinkPad X1', tag: 'AST-LAP-1056', category: 'Laptop', employee: null, status: 'Available', purchased: '21 May 2025', warranty: '20 May 2028', serial: 'PF4C8J2X', value: '$1,749' },
  { id: 'a4', name: 'iPhone 15', tag: 'AST-MOB-0419', category: 'Mobile', employee: 'Sarah Chen', status: 'Assigned', purchased: '18 Jan 2025', warranty: '17 Jan 2026', serial: 'F2LX91NP3', value: '$899' },
  { id: 'a5', name: 'Logitech Brio 4K', tag: 'AST-ACC-0302', category: 'Accessory', employee: null, status: 'In repair', purchased: '09 Aug 2023', warranty: 'Expired', serial: 'BRI093882', value: '$179' },
  { id: 'a6', name: 'HP EliteBook 840', tag: 'AST-LAP-0722', category: 'Laptop', employee: null, status: 'Retired', purchased: '06 Mar 2021', warranty: 'Expired', serial: '5CG1047JPF', value: '$1,249' },
];

const history = [
  { date: '21 May 2025', title: 'Added to inventory', detail: 'Received from Apex Technology · PO-2025-184', icon: Package },
  { date: '22 May 2025', title: 'Quality inspection passed', detail: 'Checked by IT Operations · Condition: New', icon: CheckCircle2 },
  { date: '23 May 2025', title: 'Security baseline installed', detail: 'Device encrypted and enrolled in endpoint management', icon: ShieldCheck },
];

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

export function AssetManagementPage() {
  const [assets, setAssets] = useState(initialAssets);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState('All');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assetId, setAssetId] = useState('a3');
  const [employee, setEmployee] = useState('Maya Patel');
  const [assignmentDate, setAssignmentDate] = useState('2026-08-25');
  const [notes, setNotes] = useState('New condition; charger and protective sleeve included.');

  const filteredAssets = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      const matchesSearch = !query || [asset.name, asset.tag, asset.category, asset.employee ?? '', asset.serial]
        .some((value) => value.toLowerCase().includes(query));
      return matchesSearch && (category === 'All' || asset.category === category) && (status === 'All' || asset.status === status);
    });
  }, [assets, category, search, status]);

  const assignableAssets = assets.filter((asset) => asset.status === 'Available');

  const handleAssign = () => {
    setAssets((current) => current.map((asset) => (
      asset.id === assetId ? { ...asset, employee, status: 'Assigned' } : asset
    )));
    setAssignOpen(false);
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
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className="surface rounded-xl border border-base shadow-card">
              <div className="flex items-center gap-2 border-b border-base px-5 py-4">
                <History className="h-4 w-4 text-accent-500" />
                <h2 className="text-sm font-semibold text-primary">Asset history</h2>
              </div>
              <div className="p-5">
                {history.map((event, index) => {
                  const Icon = event.icon;
                  return (
                    <div key={event.title} className="relative flex gap-4 pb-6 last:pb-0">
                      {index < history.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-[rgb(var(--border-base))]" />}
                      <div className="z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent-200 bg-accent-50 text-accent-600 dark:border-accent-800 dark:bg-accent-950/40 dark:text-accent-400">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-primary">{event.title}</div>
                        <div className="mt-0.5 text-xs text-secondary">{event.detail}</div>
                        <div className="mt-1 text-[11px] text-muted">{event.date}</div>
                      </div>
                    </div>
                  );
                })}
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

        <AssignAssetModal open={assignOpen} onClose={() => setAssignOpen(false)} assets={assignableAssets} assetId={assetId} setAssetId={setAssetId} employee={employee} setEmployee={setEmployee} assignmentDate={assignmentDate} setAssignmentDate={setAssignmentDate} notes={notes} setNotes={setNotes} onAssign={handleAssign} />
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
        <Button onClick={() => setAssignOpen(true)}><Plus className="h-4 w-4" /> Assign Asset</Button>
      </div>

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
              <option>All</option>{['Laptop', 'Monitor', 'Mobile', 'Accessory'].map((item) => <option key={item}>{item}</option>)}
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

      <AssignAssetModal open={assignOpen} onClose={() => setAssignOpen(false)} assets={assignableAssets} assetId={assetId} setAssetId={setAssetId} employee={employee} setEmployee={setEmployee} assignmentDate={assignmentDate} setAssignmentDate={setAssignmentDate} notes={notes} setNotes={setNotes} onAssign={handleAssign} />
    </div>
  );
}

interface AssignAssetModalProps {
  open: boolean;
  onClose: () => void;
  assets: Asset[];
  assetId: string;
  setAssetId: (value: string) => void;
  employee: string;
  setEmployee: (value: string) => void;
  assignmentDate: string;
  setAssignmentDate: (value: string) => void;
  notes: string;
  setNotes: (value: string) => void;
  onAssign: () => void;
}

function AssignAssetModal({ open, onClose, assets, assetId, setAssetId, employee, setEmployee, assignmentDate, setAssignmentDate, notes, setNotes, onAssign }: AssignAssetModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Assign Asset"
      description="Record custody and prepare an employee acknowledgement."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={onAssign} disabled={!assetId || !employee}>Confirm assignment</Button></>}
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Asset</Label><Select value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">Select available asset</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {asset.tag}</option>)}</Select></div>
          <div><Label>Employee</Label><Select value={employee} onChange={(event) => setEmployee(event.target.value)}>{['Maya Patel', 'Nadia Rahman', 'Arif Hassan', 'Sarah Chen'].map((name) => <option key={name}>{name}</option>)}</Select></div>
        </div>
        <div><Label>Assignment date</Label><Input type="date" value={assignmentDate} onChange={(event) => setAssignmentDate(event.target.value)} /></div>
        <div><Label>Condition and included items</Label><Textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Describe condition, accessories, or existing marks…" /></div>
        <div className="rounded-xl border border-accent-200 bg-accent-50/70 p-4 dark:border-accent-800 dark:bg-accent-950/30">
          <div className="flex gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent-600 dark:text-accent-400" /><div><div className="text-sm font-semibold text-primary">Employee acknowledgement & e-signature</div><p className="mt-1 text-xs leading-5 text-secondary">The employee will receive a secure request to confirm receipt, condition, and responsibility for this asset.</p><div className="mt-3 flex h-14 items-center justify-center rounded-lg border border-dashed border-accent-300 bg-white/60 text-xs font-medium text-accent-700 dark:border-accent-700 dark:bg-slate-900/30 dark:text-accent-300">E-signature placeholder · Sent after assignment</div></div></div>
        </div>
      </div>
    </Modal>
  );
}
