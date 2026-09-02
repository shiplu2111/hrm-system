import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  BookOpen,
  Check,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Cloud,
  FileSpreadsheet,
  Link2,
  Loader2,
  RefreshCw,
  Settings2,
  Unplug,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';

type Tab = 'mapping' | 'connections' | 'journal';
type Provider = 'Xero' | 'QuickBooks' | 'Tally';
type ConnectionStatus = 'Connected' | 'Needs attention' | 'Not connected';

interface Mapping {
  component: string;
  type: 'Earning' | 'Deduction' | 'Liability';
  glCode: string;
}

interface Connection {
  provider: Provider;
  description: string;
  status: ConnectionStatus;
  lastSync: string;
  company: string;
  color: string;
}

const accounts = [
  { code: '5000', name: 'Payroll Expense' },
  { code: '5010', name: 'Basic Salary Expense' },
  { code: '5020', name: 'Allowances Expense' },
  { code: '5030', name: 'Employer PF Expense' },
  { code: '2100', name: 'Salaries Payable' },
  { code: '2110', name: 'Income Tax Payable' },
  { code: '2120', name: 'Provident Fund Payable' },
  { code: '2130', name: 'Benefits Payable' },
  { code: '1000', name: 'Operating Bank Account' },
];

const initialMappings: Mapping[] = [
  { component: 'Basic Salary', type: 'Earning', glCode: '5010' },
  { component: 'Housing Allowance', type: 'Earning', glCode: '5020' },
  { component: 'Transport Allowance', type: 'Earning', glCode: '5020' },
  { component: 'Income Tax', type: 'Deduction', glCode: '2110' },
  { component: 'Employee PF', type: 'Deduction', glCode: '2120' },
  { component: 'Employer PF', type: 'Liability', glCode: '5030' },
  { component: 'Medical Benefits', type: 'Liability', glCode: '2130' },
];

const connections: Connection[] = [
  { provider: 'Xero', description: 'Cloud accounting for growing teams', status: 'Connected', lastSync: 'Today, 10:42 AM', company: 'Northstar Technologies Ltd.', color: 'bg-sky-500' },
  { provider: 'QuickBooks', description: 'Accounting and financial reporting', status: 'Needs attention', lastSync: '23 Aug 2026, 6:15 PM', company: 'Northstar Technologies Ltd.', color: 'bg-emerald-500' },
  { provider: 'Tally', description: 'ERP and statutory accounting', status: 'Not connected', lastSync: 'Never', company: '—', color: 'bg-indigo-500' },
];

const journalRows = [
  { account: '5010 · Basic Salary Expense', description: 'August 2026 payroll — basic salary', debit: 184250, credit: 0 },
  { account: '5020 · Allowances Expense', description: 'Housing and transport allowances', debit: 42750, credit: 0 },
  { account: '5030 · Employer PF Expense', description: 'Employer provident fund contribution', debit: 12480, credit: 0 },
  { account: '2110 · Income Tax Payable', description: 'Employee tax withheld', debit: 0, credit: 29640 },
  { account: '2120 · Provident Fund Payable', description: 'Employee and employer PF liability', debit: 0, credit: 24960 },
  { account: '2100 · Salaries Payable', description: 'Net employee payroll payable', debit: 0, credit: 184880 },
];

const statusTone: Record<ConnectionStatus, 'success' | 'warning' | 'neutral'> = {
  Connected: 'success',
  'Needs attention': 'warning',
  'Not connected': 'neutral',
};

export function AccountingIntegrationPage() {
  const [tab, setTab] = useState<Tab>('mapping');
  const [mappings, setMappings] = useState(initialMappings);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState<Provider | null>(null);
  const [syncedAt, setSyncedAt] = useState<Record<string, string>>({});
  const [exported, setExported] = useState(false);

  useEffect(() => {
    if (!syncing) return;
    const timer = window.setTimeout(() => {
      setSyncedAt((current) => ({ ...current, [syncing]: 'Just now' }));
      setSyncing(null);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [syncing]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 1800);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const accountName = (code: string) => accounts.find((account) => account.code === code)?.name ?? 'Unmapped';
  const totalDebit = useMemo(() => journalRows.reduce((sum, row) => sum + row.debit, 0), []);
  const totalCredit = useMemo(() => journalRows.reduce((sum, row) => sum + row.credit, 0), []);
  const currency = (value: number) => value ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—';

  const updateMapping = (component: string, glCode: string) => {
    setSaved(false);
    setMappings((current) => current.map((mapping) => mapping.component === component ? { ...mapping, glCode } : mapping));
  };

  const exportJournal = () => {
    const header = 'Account,Description,Debit,Credit';
    const lines = journalRows.map((row) => `"${row.account}","${row.description}",${row.debit},${row.credit}`);
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'payroll-journal-august-2026.csv';
    anchor.click();
    URL.revokeObjectURL(url);
    setExported(true);
    window.setTimeout(() => setExported(false), 1800);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-4 lg:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400"><BookOpen className="h-4 w-4" /></div>
            <h1 className="text-xl font-bold text-primary">Accounting Integration</h1>
          </div>
          <p className="text-sm text-secondary">Map payroll ledgers, manage accounting connections, and review posting entries.</p>
        </div>
        <Badge tone="success" dot>Finance controls active</Badge>
      </div>

      <div className="surface flex gap-1 overflow-x-auto rounded-xl border border-base p-1 shadow-card">
        {([
          ['mapping', 'Chart of accounts', Settings2],
          ['connections', 'Connected software', Cloud],
          ['journal', 'Journal preview', FileSpreadsheet],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`inline-flex min-w-fit flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${tab === id ? 'bg-accent-600 text-white shadow-sm' : 'text-secondary hover:bg-[rgb(var(--bg-hover))] hover:text-primary'}`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'mapping' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
            <div className="flex flex-col justify-between gap-2 border-b border-base px-5 py-4 sm:flex-row sm:items-center">
              <div><h2 className="text-sm font-semibold text-primary">Payroll component mapping</h2><p className="mt-0.5 text-xs text-secondary">Select the general ledger account used when each component is posted.</p></div>
              <Badge tone="accent">{mappings.length} components</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                  <tr><th className="px-5 py-3">Payroll component</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">GL account</th><th className="px-5 py-3">Posting status</th></tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {mappings.map((mapping) => (
                    <tr key={mapping.component} className="hover:bg-[rgb(var(--bg-hover))]">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-primary">{mapping.component}</div>
                        <div className="mt-0.5 text-[11px] text-muted">{mapping.type === 'Earning' ? 'Gross payroll calculation' : mapping.type === 'Deduction' ? 'Employee withholding' : 'Employer contribution'}</div>
                      </td>
                      <td className="px-5 py-3.5"><Badge tone={mapping.type === 'Earning' ? 'success' : mapping.type === 'Deduction' ? 'warning' : 'info'}>{mapping.type}</Badge></td>
                      <td className="min-w-[280px] px-5 py-3.5">
                        <Select value={mapping.glCode} onChange={(event) => updateMapping(mapping.component, event.target.value)}>
                          <option value="">Choose GL account</option>
                          {accounts.map((account) => <option key={account.code} value={account.code}>{account.code} · {account.name}</option>)}
                        </Select>
                      </td>
                      <td className="px-5 py-3.5"><span className={`inline-flex items-center gap-1.5 text-xs font-medium ${mapping.glCode ? 'text-success-600 dark:text-success-400' : 'text-warning-600 dark:text-warning-400'}`}><CheckCircle2 className="h-3.5 w-3.5" />{mapping.glCode ? 'Ready' : 'Action needed'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end border-t border-base px-5 py-4">
              <Button onClick={() => setSaved(true)}>{saved ? <Check className="h-4 w-4" /> : <Settings2 className="h-4 w-4" />}{saved ? 'Mappings saved' : 'Save mappings'}</Button>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="surface rounded-xl border border-base p-5 shadow-card">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400"><Link2 className="h-5 w-5" /></div>
              <h3 className="text-sm font-semibold text-primary">Mapping coverage</h3>
              <div className="mt-2 text-3xl font-bold text-primary">{Math.round((mappings.filter((item) => item.glCode).length / mappings.length) * 100)}%</div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[rgb(var(--bg-muted))]"><div className="h-full rounded-full bg-accent-600" style={{ width: `${(mappings.filter((item) => item.glCode).length / mappings.length) * 100}%` }} /></div>
              <p className="mt-3 text-xs leading-5 text-secondary">All active payroll components should have a ledger account before posting a pay run.</p>
            </div>
            <div className="rounded-xl border border-accent-200 bg-accent-50/70 p-4 dark:border-accent-800 dark:bg-accent-950/30">
              <div className="text-xs font-semibold uppercase tracking-wide text-accent-700 dark:text-accent-300">Selected example</div>
              <div className="mt-2 text-sm font-semibold text-primary">Basic Salary → {mappings[0].glCode}</div>
              <div className="mt-1 text-xs text-secondary">{accountName(mappings[0].glCode)}</div>
            </div>
          </aside>
        </div>
      )}

      {tab === 'connections' && (
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-3">
            {connections.map((connection) => {
              const isSyncing = syncing === connection.provider;
              const lastSync = syncedAt[connection.provider] ?? connection.lastSync;
              return (
                <section key={connection.provider} className="surface rounded-xl border border-base p-5 shadow-card">
                  <div className="flex items-start justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold text-white ${connection.color}`}>{connection.provider.charAt(0)}</div>
                    <Badge tone={statusTone[connection.status]} dot>{connection.status}</Badge>
                  </div>
                  <h2 className="mt-4 text-base font-bold text-primary">{connection.provider}</h2>
                  <p className="mt-1 text-xs text-secondary">{connection.description}</p>
                  <div className="mt-5 space-y-3 border-y border-base py-4 text-xs">
                    <div className="flex items-center justify-between gap-3"><span className="text-muted">Company</span><span className="truncate font-medium text-primary">{connection.company}</span></div>
                    <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-1.5 text-muted"><Clock3 className="h-3.5 w-3.5" /> Last sync</span><span className="font-medium text-primary">{lastSync}</span></div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {connection.status === 'Not connected' ? (
                      <Button className="flex-1"><Link2 className="h-4 w-4" /> Connect</Button>
                    ) : (
                      <>
                        <Button className="flex-1" onClick={() => setSyncing(connection.provider)} disabled={Boolean(syncing)}>
                          {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          {isSyncing ? 'Syncing…' : 'Sync Now'}
                        </Button>
                        <Button variant="secondary" size="icon" aria-label={`Disconnect ${connection.provider}`}><Unplug className="h-4 w-4" /></Button>
                      </>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="surface rounded-xl border border-base p-5 shadow-card">
            <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-success-50 text-success-600 dark:bg-success-950/40 dark:text-success-400"><CheckCircle2 className="h-5 w-5" /></div>
                <div><h3 className="text-sm font-semibold text-primary">Automatic payroll posting</h3><p className="mt-1 text-xs text-secondary">Approved pay runs are queued for review before posting to the connected ledger.</p></div>
              </div>
              <div className="flex items-center gap-2 text-xs text-success-600 dark:text-success-400"><span className="h-2 w-2 rounded-full bg-success-500" /> Integration service operational</div>
            </div>
          </section>
        </div>
      )}

      {tab === 'journal' && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: 'Payroll run', value: 'August 2026', icon: FileSpreadsheet },
              { label: 'Posting date', value: '31 Aug 2026', icon: Clock3 },
              { label: 'Journal total', value: currency(totalDebit), icon: CircleDollarSign },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="surface flex items-center gap-3 rounded-xl border border-base p-4 shadow-card">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400"><Icon className="h-5 w-5" /></div>
                <div><div className="text-xs text-secondary">{label}</div><div className="mt-0.5 text-sm font-bold text-primary">{value}</div></div>
              </div>
            ))}
          </div>

          <section className="surface overflow-hidden rounded-xl border border-base shadow-card">
            <div className="flex flex-col justify-between gap-3 border-b border-base px-5 py-4 sm:flex-row sm:items-center">
              <div><div className="flex items-center gap-2"><h2 className="text-sm font-semibold text-primary">Journal entry preview</h2><Badge tone="neutral">Draft JE-2026-008</Badge></div><p className="mt-1 text-xs text-secondary">Generated from Payroll Run PR-2026-08 · 142 employees</p></div>
              <Button variant="secondary" onClick={exportJournal}>{exported ? <Check className="h-4 w-4" /> : <ArrowDownToLine className="h-4 w-4" />}{exported ? 'CSV exported' : 'Export CSV'}</Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[rgb(var(--bg-muted))] text-left text-[11px] uppercase tracking-wide text-secondary">
                  <tr><th className="px-5 py-3">Account</th><th className="px-5 py-3">Description</th><th className="px-5 py-3 text-right">Debit</th><th className="px-5 py-3 text-right">Credit</th></tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {journalRows.map((row) => (
                    <tr key={row.account}>
                      <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs font-medium text-primary">{row.account}</td>
                      <td className="px-5 py-3.5 text-secondary">{row.description}</td>
                      <td className="px-5 py-3.5 text-right font-mono text-primary">{currency(row.debit)}</td>
                      <td className="px-5 py-3.5 text-right font-mono text-primary">{currency(row.credit)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-strong bg-[rgb(var(--bg-muted))]">
                  <tr><td className="px-5 py-4 font-bold text-primary" colSpan={2}>Balanced totals</td><td className="px-5 py-4 text-right font-mono font-bold text-primary">{currency(totalDebit)}</td><td className="px-5 py-4 text-right font-mono font-bold text-primary">{currency(totalCredit)}</td></tr>
                </tfoot>
              </table>
            </div>
          </section>

          <div className={`flex items-center gap-3 rounded-xl border p-4 ${totalDebit === totalCredit ? 'border-success-200 bg-success-50/70 dark:border-success-800 dark:bg-success-950/30' : 'border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-950/30'}`}>
            {totalDebit === totalCredit ? <CheckCircle2 className="h-5 w-5 text-success-600 dark:text-success-400" /> : <Unplug className="h-5 w-5 text-error-600" />}
            <div><div className="text-sm font-semibold text-primary">{totalDebit === totalCredit ? 'Journal is balanced and ready for review' : 'Journal is out of balance'}</div><div className="mt-0.5 text-xs text-secondary">Debits and credits differ by {currency(Math.abs(totalDebit - totalCredit))}.</div></div>
          </div>
        </div>
      )}
    </div>
  );
}
