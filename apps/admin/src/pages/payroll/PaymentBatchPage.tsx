import { useState } from 'react';
import {
  Download,
  Building,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  FileCode,
  Search,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import {
  paymentBatches,
  paymentItems,
  type PaymentBatch,
  type PaymentItem,
} from '@/data/payrollData';

export function PaymentBatchPage() {
  const [batches] = useState<PaymentBatch[]>(paymentBatches);
  const [items, setItems] = useState<PaymentItem[]>(paymentItems);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Sent' | 'Pending' | 'Failed'>('All');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('NACHA');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleRetry = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: 'Sent', errorMessage: undefined }
          : item
      )
    );
  };

  const handleExportFile = () => {
    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
      setExportModalOpen(false);
    }, 2000);
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      item.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      item.bankName.toLowerCase().includes(search.toLowerCase()) ||
      item.referenceNumber.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalAmount = items.reduce((s, i) => s + i.amount, 0);
  const sentCount = items.filter((i) => i.status === 'Sent').length;
  const failedCount = items.filter((i) => i.status === 'Failed').length;
  const pendingCount = items.filter((i) => i.status === 'Pending').length;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Payment Batches & Bank Disbursals</h1>
          <p className="text-sm text-secondary mt-0.5">
            Generate NACHA / SEPA direct transfer files, track ACH payments, and resolve failed transfers.
          </p>
        </div>
        <Button variant="primary" onClick={() => setExportModalOpen(true)}>
          <Download className="h-4 w-4" /> Generate Bank Transfer File
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0">
            <Building className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">${totalAmount.toLocaleString()}</div>
            <div className="text-xs text-secondary">Batch Total Disbursal</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{sentCount}</div>
            <div className="text-xs text-secondary">Successfully Settled</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{pendingCount}</div>
            <div className="text-xs text-secondary">Pending Processing</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-error-600">{failedCount}</div>
            <div className="text-xs text-secondary">Failed / Needs Retry</div>
          </div>
        </div>
      </div>

      {/* Active Batches List */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Disbursal Batches</CardTitle>
          <Badge tone="accent">Silicon Valley Bank (Direct Integration)</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Batch #
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Period Name
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Target Bank
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Format
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-primary">
                      {batch.batchNumber}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-primary">{batch.periodName}</td>
                    <td className="px-5 py-3.5 text-xs text-secondary">{batch.bankName}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone="neutral">{batch.format}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-xs font-bold text-primary">
                      ${batch.totalAmount.toLocaleString()} ({batch.totalEmployees} staff)
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={batch.status === 'Settled' ? 'success' : 'warning'} dot>
                        {batch.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Payment Items Detail Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle>Itemized Disbursal Status</CardTitle>
            <p className="text-xs text-secondary mt-0.5">
              Individual employee transactions, bank accounts, and settlement reference IDs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search staff, account, ref..."
                className="pl-8 text-xs h-8"
              />
            </div>

            <div className="flex items-center gap-1">
              {(['All', 'Sent', 'Pending', 'Failed'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    statusFilter === st
                      ? 'bg-accent-600 text-white'
                      : 'surface border border-base text-secondary hover:text-primary'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Bank Account Details
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Reference #
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Status / Error
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={item.employeeName} size="sm" />
                        <div>
                          <div className="font-semibold text-primary text-sm">{item.employeeName}</div>
                          <div className="text-xs text-muted font-mono">{item.employeeId}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-secondary">
                      <div className="font-medium text-primary">{item.bankName}</div>
                      <div className="font-mono text-muted">{item.accountNumber} · Routing: {item.routingOrIfsc}</div>
                    </td>

                    <td className="px-5 py-3.5 font-bold text-primary text-sm">
                      ${item.amount.toLocaleString()}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-xs text-secondary">
                      {item.referenceNumber}
                    </td>

                    <td className="px-5 py-3.5">
                      <div>
                        <Badge
                          tone={
                            item.status === 'Sent'
                              ? 'success'
                              : item.status === 'Pending'
                              ? 'warning'
                              : 'error'
                          }
                          dot
                        >
                          {item.status}
                        </Badge>
                        {item.errorMessage && (
                          <div className="text-[11px] text-error-600 font-medium mt-1">
                            {item.errorMessage}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      {item.status === 'Failed' ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleRetry(item.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Retry Payout
                        </Button>
                      ) : (
                        <span className="text-xs text-muted">Settled</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Export Modal */}
      <Modal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        title="Generate Bank Disbursal File"
        description="Select banking protocol for bulk payroll transfer export."
        footer={
          <>
            <Button variant="secondary" onClick={() => setExportModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleExportFile}>
              <Download className="h-4 w-4" /> Download Export
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Banking Protocol / File Format</Label>
            <Select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
              <option value="NACHA">NACHA Automated Clearing House (.ach)</option>
              <option value="SEPA XML">ISO 20022 SEPA XML (pain.001.001.03)</option>
              <option value="CSV">Standard Bank CSV Formatted File</option>
              <option value="BACS">UK BACS Payment Format</option>
            </Select>
          </div>

          <div className="surface border border-base rounded-xl p-3 bg-accent-50/20 dark:bg-accent-950/20 text-xs space-y-1">
            <div className="font-semibold text-primary flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-accent-500" /> Cryptographic Checksum Included
            </div>
            <p className="text-secondary">
              File will be generated with SHA-256 batch integrity hash and company originator ID (EIN-98-401928).
            </p>
          </div>

          {downloadSuccess && (
            <div className="p-3 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-700 dark:text-success-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> NACHA File Generated & Download Started!
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

