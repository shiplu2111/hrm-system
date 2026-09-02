import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Download,
  FileText,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';

type ContractStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Draft';
type View = 'directory' | 'profile';
type DirectoryMode = 'cards' | 'table';

interface Vendor {
  id: string;
  name: string;
  category: string;
  status: ContractStatus;
  contact: string;
  email: string;
  phone: string;
  location: string;
  startDate: string;
  expiryDate: string;
  daysLeft: number;
  value: string;
  owner: string;
  service: string;
}

const vendors: Vendor[] = [
  { id: 'VEN-2104', name: 'Northstar IT Services', category: 'Technology', status: 'Active', contact: 'Ethan Brooks', email: 'ethan@northstar-it.com', phone: '+1 415 555 0128', location: 'San Francisco, CA', startDate: '01 Feb 2026', expiryDate: '31 Jan 2027', daysLeft: 159, value: '$148,000', owner: 'Priya Nair', service: 'Managed infrastructure and on-call support' },
  { id: 'VEN-2087', name: 'Apex Facilities Group', category: 'Facilities', status: 'Expiring Soon', contact: 'Sofia Martinez', email: 'sofia@apexfacilities.com', phone: '+1 510 555 0194', location: 'Oakland, CA', startDate: '15 Sep 2025', expiryDate: '14 Sep 2026', daysLeft: 20, value: '$86,400', owner: 'Liam Wilson', service: 'Office maintenance and facilities response' },
  { id: 'VEN-2079', name: 'ClearPath Consulting', category: 'Professional Services', status: 'Active', contact: 'Marcus Lee', email: 'marcus@clearpath.co', phone: '+1 650 555 0172', location: 'San Mateo, CA', startDate: '01 Apr 2026', expiryDate: '31 Mar 2027', daysLeft: 218, value: '$120,000', owner: 'Amina Rahman', service: 'Organizational design and change advisory' },
  { id: 'VEN-2052', name: 'Greenline Catering', category: 'Food & Hospitality', status: 'Expired', contact: 'Nora Adams', email: 'nora@greenlinecatering.com', phone: '+1 408 555 0136', location: 'San Jose, CA', startDate: '01 Aug 2025', expiryDate: '31 Jul 2026', daysLeft: -25, value: '$42,500', owner: 'Maya Patel', service: 'Daily office catering and event service' },
  { id: 'VEN-2041', name: 'Sentinel Security', category: 'Security', status: 'Expiring Soon', contact: 'Owen Carter', email: 'owen@sentinelsecurity.com', phone: '+1 415 555 0161', location: 'San Francisco, CA', startDate: '01 Oct 2025', expiryDate: '30 Sep 2026', daysLeft: 36, value: '$96,000', owner: 'Daniel Kim', service: 'Manned guarding and access monitoring' },
  { id: 'VEN-2118', name: 'Bright Spark Creative', category: 'Marketing', status: 'Draft', contact: 'Chloe Nguyen', email: 'chloe@brightspark.studio', phone: '+1 628 555 0180', location: 'Remote', startDate: '01 Oct 2026', expiryDate: '30 Sep 2027', daysLeft: 401, value: '$64,000', owner: 'Noah Williams', service: 'Brand campaigns and creative production' },
];

const invoices = [
  { id: 'INV-8842', period: 'August 2026', issued: '18 Aug 2026', amount: '$12,333.33', due: '17 Sep 2026', status: 'Scheduled' },
  { id: 'INV-8721', period: 'July 2026', issued: '18 Jul 2026', amount: '$12,333.33', due: '17 Aug 2026', status: 'Paid' },
  { id: 'INV-8605', period: 'June 2026', issued: '18 Jun 2026', amount: '$12,333.33', due: '18 Jul 2026', status: 'Paid' },
  { id: 'INV-8490', period: 'May 2026', issued: '18 May 2026', amount: '$12,333.33', due: '17 Jun 2026', status: 'Paid' },
];

const statusTone: Record<ContractStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  Active: 'success',
  'Expiring Soon': 'warning',
  Expired: 'error',
  Draft: 'neutral',
};

function ExpiryCard({ vendor, onOpen }: { vendor: Vendor; onOpen: () => void }) {
  const urgent = vendor.daysLeft <= 30;
  const expired = vendor.daysLeft < 0;
  const color = expired
    ? 'border-error-200 dark:border-error-800/60 bg-error-50/50 dark:bg-error-950/20'
    : urgent
      ? 'border-warning-200 dark:border-warning-800/60 bg-warning-50/50 dark:bg-warning-950/20'
      : 'border-accent-200 dark:border-accent-800/60 bg-accent-50/40 dark:bg-accent-950/20';
  const iconColor = expired ? 'text-error-600' : urgent ? 'text-warning-600' : 'text-accent-600';

  return (
    <button onClick={onOpen} className={`w-full text-left rounded-xl border p-3 hover:shadow-card-hover transition-all ${color}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className={`h-4 w-4 shrink-0 ${iconColor}`} />
          <div className="min-w-0"><p className="text-sm font-medium text-primary truncate">{vendor.name}</p><p className="text-[11px] text-muted">{vendor.category}</p></div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted shrink-0" />
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div><p className="text-[11px] text-muted">Expires</p><p className="text-xs font-medium text-secondary">{vendor.expiryDate}</p></div>
        <Badge tone={statusTone[vendor.status]}>{expired ? `${Math.abs(vendor.daysLeft)}d overdue` : `${vendor.daysLeft} days`}</Badge>
      </div>
    </button>
  );
}

export function VendorContractorPage() {
  const [view, setView] = useState<View>('directory');
  const [mode, setMode] = useState<DirectoryMode>('cards');
  const [selected, setSelected] = useState(vendors[0]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [status, setStatus] = useState<'All' | ContractStatus>('All');
  const [addOpen, setAddOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<'overview' | 'contract' | 'invoices'>('overview');

  const filtered = useMemo(() => vendors.filter((vendor) => {
    const query = search.toLowerCase();
    return (!query || `${vendor.name} ${vendor.contact} ${vendor.category}`.toLowerCase().includes(query))
      && (category === 'All' || vendor.category === category)
      && (status === 'All' || vendor.status === status);
  }), [category, search, status]);

  const openProfile = (vendor: Vendor) => {
    setSelected(vendor);
    setProfileTab('overview');
    setView('profile');
  };

  if (view === 'profile') {
    return (
      <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
        <button onClick={() => setView('directory')} className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"><ArrowLeft className="h-4 w-4" />Back to vendor directory</button>

        <Card>
          <CardBody className="flex flex-col lg:flex-row lg:items-center gap-5">
            <Avatar name={selected.contact} size="lg" className="h-14 w-14 text-lg" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-primary">{selected.contact}</h1>
                <Badge tone="accent"><UserRound className="h-3 w-3" /> Contractor</Badge>
                <Badge tone={statusTone[selected.status]} dot>{selected.status}</Badge>
                <Badge tone="neutral">{selected.id}</Badge>
              </div>
              <p className="text-sm text-secondary mt-1">{selected.service} · {selected.name}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted">
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{selected.email}</span>
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{selected.phone}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{selected.location}</span>
              </div>
            </div>
            <div className="flex gap-2"><Button variant="secondary">Message</Button><Button>Edit contractor</Button></div>
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Contract value', value: selected.value, note: 'Annual value', icon: CircleDollarSign },
            { label: 'Contract term', value: '12 months', note: `${selected.startDate} – ${selected.expiryDate}`, icon: Calendar },
            { label: 'Payment terms', value: 'Net 30', note: 'Monthly invoicing', icon: Clock3 },
            { label: 'Account owner', value: selected.owner, note: 'Internal contract owner', icon: ShieldCheck },
          ].map((item) => {
            const Icon = item.icon;
            return <Card key={item.label}><CardBody className="p-4"><div className="flex items-center gap-2 text-xs text-muted"><Icon className="h-4 w-4 text-accent-600" />{item.label}</div><p className="text-base font-semibold text-primary mt-2">{item.value}</p><p className="text-[11px] text-muted mt-0.5">{item.note}</p></CardBody></Card>;
          })}
        </div>

        <div className="flex items-center gap-1 border-b border-base">
          {(['overview', 'contract', 'invoices'] as const).map((tab) => (
            <button key={tab} onClick={() => setProfileTab(tab)} className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${profileTab === tab ? 'border-accent-600 text-accent-600' : 'border-transparent text-secondary hover:text-primary'}`}>{tab === 'invoices' ? 'Invoices & payments' : tab}</button>
          ))}
        </div>

        {profileTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card><CardHeader><CardTitle>Contractor information</CardTitle></CardHeader><CardBody className="grid grid-cols-2 gap-4">
              {[['Legal / vendor name', selected.name], ['Category', selected.category], ['Primary contact', selected.contact], ['Vendor ID', selected.id], ['Email', selected.email], ['Phone', selected.phone], ['Location', selected.location], ['Tax status', 'W-9 verified']].map(([label, value]) => <div key={label}><p className="text-xs text-muted">{label}</p><p className="text-sm text-primary mt-0.5">{value}</p></div>)}
            </CardBody></Card>
            <Card><CardHeader><CardTitle>Compliance & access</CardTitle></CardHeader><CardBody className="space-y-3">
              {[['Insurance certificate', 'Verified · expires 12 Dec 2026'], ['Background screening', 'Completed 04 Feb 2026'], ['Data processing agreement', 'Signed 01 Feb 2026'], ['System access review', 'Approved · quarterly review']].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[rgb(var(--bg-muted))]"><div><p className="text-sm font-medium text-primary">{label}</p><p className="text-xs text-muted">{value}</p></div><CheckCircle2 className="h-4 w-4 text-success-600 shrink-0" /></div>)}
            </CardBody></Card>
          </div>
        )}

        {profileTab === 'contract' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2"><CardHeader className="flex items-center justify-between"><div><CardTitle>Contract terms</CardTitle><p className="text-xs text-muted mt-0.5">MSA-2026-{selected.id.slice(-4)} · v2.1</p></div><Button variant="secondary" size="sm"><Download className="h-3.5 w-3.5" /> Download</Button></CardHeader><CardBody className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              {[['Effective date', selected.startDate], ['Expiry date', selected.expiryDate], ['Annual value', selected.value], ['Billing frequency', 'Monthly'], ['Payment terms', 'Net 30'], ['Auto-renewal', 'No'], ['Notice period', '60 days'], ['Currency', 'USD'], ['Governing law', 'California']].map(([label, value]) => <div key={label}><p className="text-xs text-muted">{label}</p><p className="text-sm font-medium text-primary mt-1">{value}</p></div>)}
              <div className="col-span-2 sm:col-span-3 border-t border-base pt-4"><p className="text-xs text-muted">Scope of services</p><p className="text-sm text-secondary mt-1">{selected.service}. Includes monthly service reporting, named account management, defined service levels and quarterly business reviews.</p></div>
            </CardBody></Card>
            <Card><CardHeader><CardTitle>Contract document</CardTitle></CardHeader><CardBody>
              <div className="h-28 rounded-lg bg-accent-50 dark:bg-accent-950/30 flex items-center justify-center"><FileText className="h-10 w-10 text-accent-600" /></div>
              <p className="text-sm font-medium text-primary mt-3">Master Services Agreement.pdf</p><p className="text-xs text-muted mt-0.5">2.4 MB · Signed 01 Feb 2026</p>
              <div className="flex gap-2 mt-4"><Button variant="secondary" size="sm" className="flex-1">Preview</Button><Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button></div>
            </CardBody></Card>
          </div>
        )}

        {profileTab === 'invoices' && (
          <Card>
            <CardHeader className="flex items-center justify-between"><div><CardTitle>Invoices & payments</CardTitle><p className="text-xs text-muted mt-0.5">Current contract year · $49,333.32 billed</p></div><Button size="sm"><Plus className="h-3.5 w-3.5" /> Add invoice</Button></CardHeader>
            <CardBody className="p-0 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="bg-[rgb(var(--bg-muted))] text-[11px] uppercase tracking-wide text-muted"><tr><th className="px-4 py-2.5 font-medium">Invoice</th><th className="px-4 py-2.5 font-medium">Period</th><th className="px-4 py-2.5 font-medium">Issued / due</th><th className="px-4 py-2.5 font-medium">Amount</th><th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5" /></tr></thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">{invoices.map((invoice) => <tr key={invoice.id} className="hover:bg-[rgb(var(--bg-hover))]"><td className="px-4 py-3 text-sm font-medium text-primary">{invoice.id}</td><td className="px-4 py-3 text-xs text-secondary">{invoice.period}</td><td className="px-4 py-3 text-xs"><p className="text-secondary">{invoice.issued}</p><p className="text-muted">Due {invoice.due}</p></td><td className="px-4 py-3 text-sm font-medium text-primary">{invoice.amount}</td><td className="px-4 py-3"><Badge tone={invoice.status === 'Paid' ? 'success' : 'info'} dot>{invoice.status}</Badge></td><td className="px-4 py-3"><Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button></td></tr>)}</tbody>
              </table>
            </CardBody>
          </Card>
        )}
      </div>
    );
  }

  const expiryVendors = vendors.filter((vendor) => vendor.daysLeft <= 60 && vendor.status !== 'Draft').sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center"><Building2 className="h-5 w-5 text-accent-600 dark:text-accent-400" /></div>
          <div><h1 className="text-xl font-bold text-primary">Vendors & Contractors</h1><p className="text-sm text-secondary">External workforce, contracts and payment oversight</p></div>
        </div>
        <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" /> Add vendor</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total vendors', value: vendors.length, note: 'Across 6 categories', icon: Building2, tone: 'text-accent-600' },
          { label: 'Active contracts', value: vendors.filter((vendor) => vendor.status === 'Active').length, note: '$354K annual value', icon: CheckCircle2, tone: 'text-success-600' },
          { label: 'Expiring in 60 days', value: vendors.filter((vendor) => vendor.daysLeft >= 0 && vendor.daysLeft <= 60).length, note: 'Renewal action needed', icon: Clock3, tone: 'text-warning-600' },
          { label: 'Overdue contracts', value: vendors.filter((vendor) => vendor.daysLeft < 0).length, note: 'Immediate attention', icon: AlertTriangle, tone: 'text-error-600' },
        ].map((metric) => {
          const Icon = metric.icon;
          return <Card key={metric.label}><CardBody className="p-4 flex justify-between gap-2"><div><p className="text-xs text-muted">{metric.label}</p><p className="text-2xl font-bold text-primary mt-1">{metric.value}</p><p className="text-[11px] text-secondary">{metric.note}</p></div><Icon className={`h-5 w-5 ${metric.tone}`} /></CardBody></Card>;
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <Card className="xl:col-span-3">
          <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div><CardTitle>Vendor directory</CardTitle><p className="text-xs text-muted mt-0.5">{filtered.length} vendors</p></div>
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vendors..." className="h-8 pl-8 py-0 text-xs" /></div>
              <Select value={category} onChange={(event) => setCategory(event.target.value)} className="h-8 py-0 text-xs w-40"><option>All</option>{Array.from(new Set(vendors.map((vendor) => vendor.category))).map((item) => <option key={item}>{item}</option>)}</Select>
              <Select value={status} onChange={(event) => setStatus(event.target.value as 'All' | ContractStatus)} className="h-8 py-0 text-xs w-36"><option>All</option><option>Active</option><option>Expiring Soon</option><option>Expired</option><option>Draft</option></Select>
              <div className="flex border border-base rounded-lg p-0.5">
                <button onClick={() => setMode('cards')} className={`h-7 w-7 rounded-md flex items-center justify-center ${mode === 'cards' ? 'bg-accent-50 text-accent-600 dark:bg-accent-950/40' : 'text-muted'}`} aria-label="Card view"><LayoutGrid className="h-3.5 w-3.5" /></button>
                <button onClick={() => setMode('table')} className={`h-7 w-7 rounded-md flex items-center justify-center ${mode === 'table' ? 'bg-accent-50 text-accent-600 dark:bg-accent-950/40' : 'text-muted'}`} aria-label="Table view"><List className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </CardHeader>
          {mode === 'cards' ? (
            <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((vendor) => (
                <button key={vendor.id} onClick={() => openProfile(vendor)} className="text-left rounded-xl border border-base p-4 hover:border-accent-400 hover:shadow-card-hover transition-all">
                  <div className="flex items-start gap-3">
                    <Avatar name={vendor.name} size="lg" />
                    <div className="flex-1 min-w-0"><div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-primary truncate">{vendor.name}</p><p className="text-xs text-muted">{vendor.category} · {vendor.id}</p></div><Badge tone={statusTone[vendor.status]} dot>{vendor.status}</Badge></div>
                      <div className="mt-3 pt-3 border-t border-base flex items-center justify-between gap-2"><div><p className="text-xs font-medium text-secondary">{vendor.contact}</p><p className="text-[11px] text-muted">{vendor.email}</p></div><ChevronRight className="h-4 w-4 text-muted" /></div>
                    </div>
                  </div>
                </button>
              ))}
            </CardBody>
          ) : (
            <CardBody className="p-0 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left"><thead className="bg-[rgb(var(--bg-muted))] text-[11px] uppercase tracking-wide text-muted"><tr><th className="px-4 py-2.5 font-medium">Vendor</th><th className="px-4 py-2.5 font-medium">Category</th><th className="px-4 py-2.5 font-medium">Contact</th><th className="px-4 py-2.5 font-medium">Contract</th><th className="px-4 py-2.5" /></tr></thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">{filtered.map((vendor) => <tr key={vendor.id} onClick={() => openProfile(vendor)} className="cursor-pointer hover:bg-[rgb(var(--bg-hover))]"><td className="px-4 py-3"><p className="text-sm font-medium text-primary">{vendor.name}</p><p className="text-xs text-muted">{vendor.id}</p></td><td className="px-4 py-3 text-xs text-secondary">{vendor.category}</td><td className="px-4 py-3"><p className="text-xs text-secondary">{vendor.contact}</p><p className="text-[11px] text-muted">{vendor.email}</p></td><td className="px-4 py-3"><Badge tone={statusTone[vendor.status]} dot>{vendor.status}</Badge></td><td className="px-4 py-3"><ChevronRight className="h-4 w-4 text-muted" /></td></tr>)}</tbody>
              </table>
            </CardBody>
          )}
        </Card>

        <Card>
          <CardHeader><CardTitle>Contract expiry tracker</CardTitle><p className="text-xs text-muted mt-0.5">Due within 60 days or overdue</p></CardHeader>
          <CardBody className="space-y-3">{expiryVendors.map((vendor) => <ExpiryCard key={vendor.id} vendor={vendor} onOpen={() => openProfile(vendor)} />)}
            <div className="pt-2 flex items-center justify-between text-xs"><span className="text-muted">Contract portfolio</span><span className="font-medium text-primary">$556.9K / year</span></div>
          </CardBody>
        </Card>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add vendor or contractor" description="Create a directory record and capture the primary contract details." size="lg" footer={<><Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={() => setAddOpen(false)}>Create vendor</Button></>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><Label>Vendor name</Label><Input placeholder="Registered business name" /></div><div><Label>Category</Label><Select defaultValue=""><option value="" disabled>Select category</option><option>Technology</option><option>Facilities</option><option>Professional Services</option><option>Security</option><option>Marketing</option></Select></div>
          <div><Label>Primary contact</Label><Input placeholder="Contact name" /></div><div><Label>Contact email</Label><Input type="email" placeholder="name@company.com" /></div>
          <div><Label>Contract start</Label><Input type="date" /></div><div><Label>Contract expiry</Label><Input type="date" /></div>
          <div><Label>Annual value</Label><Input placeholder="$0.00" /></div><div><Label>Internal owner</Label><Select defaultValue=""><option value="" disabled>Select owner</option><option>Priya Nair</option><option>Amina Rahman</option><option>Daniel Kim</option></Select></div>
        </div>
      </Modal>
    </div>
  );
}
