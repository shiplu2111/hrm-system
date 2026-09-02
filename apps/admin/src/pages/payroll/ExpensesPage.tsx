import { useState } from 'react';
import {
  Receipt,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  ArrowRight,
  Check,
  X,
  Clock,
  DollarSign,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { expenseClaims, type ExpenseClaim } from '@/data/payrollData';

export function ExpensesPage() {
  const [claims, setClaims] = useState<ExpenseClaim[]>(expenseClaims);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);

  // New Claim Form State
  const [empName, setEmpName] = useState('Sarah Chen');
  const [empId, setEmpId] = useState('EMP-001');
  const [category, setCategory] = useState<ExpenseClaim['category']>('Travel & Accommodation');
  const [amount, setAmount] = useState(350);
  const [date, setDate] = useState('2024-08-25');
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState('uber_hotel_receipt.pdf');

  const handleCreateClaim = () => {
    const newClaim: ExpenseClaim = {
      id: `exp-${Date.now()}`,
      claimId: `EXP-2024-${100 + claims.length + 1}`,
      employeeId: empId,
      employeeName: empName,
      category,
      amount,
      currency: '$',
      date,
      description: description || 'Business expense for operations.',
      receiptName: receiptFile,
      receiptSize: '850 KB',
      approvalStage: 'Employee Submitted',
      status: 'Pending Manager',
    };
    setClaims((prev) => [newClaim, ...prev]);
    setModalOpen(false);
  };

  const handleManagerApprove = (id: string) => {
    setClaims((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              approvalStage: 'Manager Approved',
              status: 'Pending Finance',
              approvedByManager: 'Sarah Chen (Just now)',
            }
          : c
      )
    );
  };

  const handleFinanceApprove = (id: string) => {
    setClaims((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              approvalStage: 'Finance Approved',
              status: 'Approved for Payroll',
              approvedByFinance: 'Alex Morgan (Just now)',
            }
          : c
      )
    );
  };

  const handleReject = (id: string) => {
    setClaims((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'Rejected' } : c))
    );
  };

  const filteredClaims = claims.filter((c) => {
    const matchesSearch =
      c.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      c.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase()) ||
      c.claimId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalClaimed = claims.reduce((s, c) => s + c.amount, 0);
  const pendingManagerCount = claims.filter((c) => c.status === 'Pending Manager').length;
  const pendingFinanceCount = claims.filter((c) => c.status === 'Pending Finance').length;
  const readyForPayroll = claims.filter((c) => c.status === 'Approved for Payroll').length;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Expense Claims & Reimbursements</h1>
          <p className="text-sm text-secondary mt-0.5">
            Submit business expenses, verify tax receipts, and route approved claims into monthly payroll.
          </p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Submit Expense Claim
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">${totalClaimed.toFixed(2)}</div>
            <div className="text-xs text-secondary">Total Claims Submitted</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{pendingManagerCount}</div>
            <div className="text-xs text-secondary">Pending Manager Review</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{pendingFinanceCount}</div>
            <div className="text-xs text-secondary">Pending Finance Audit</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{readyForPayroll}</div>
            <div className="text-xs text-secondary">Queued for Next Pay Run</div>
          </div>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search claims by employee, claim #, or category..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(['All', 'Pending Manager', 'Pending Finance', 'Approved for Payroll', 'Reimbursed'] as const).map(
            (st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  statusFilter === st
                    ? 'bg-accent-600 text-white shadow-sm'
                    : 'surface border border-base text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
                }`}
              >
                {st}
              </button>
            )
          )}
        </div>
      </div>

      {/* Claims Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Expense Claims & Approval Pipeline</CardTitle>
          <Badge tone="neutral">{filteredClaims.length} Claims</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Claim # / Employee
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Category & Details
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Receipt Attachment
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Approval Pipeline Stage
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filteredClaims.map((claim) => (
                  <tr key={claim.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={claim.employeeName} size="sm" />
                        <div>
                          <div className="font-semibold text-primary text-sm">{claim.employeeName}</div>
                          <div className="text-xs text-muted font-mono">{claim.claimId} · {claim.employeeId}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-xs">
                      <div className="font-semibold text-primary">{claim.category}</div>
                      <div className="text-secondary line-clamp-1">{claim.description}</div>
                      <div className="text-[11px] text-muted mt-0.5">{claim.date}</div>
                    </td>

                    <td className="px-5 py-3.5 font-bold text-primary text-sm">
                      ${claim.amount.toFixed(2)}
                    </td>

                    <td className="px-5 py-3.5 text-xs">
                      <div className="flex items-center gap-1.5 p-1.5 rounded-lg border border-base bg-[rgb(var(--bg-muted))] w-fit">
                        <FileText className="h-3.5 w-3.5 text-accent-500" />
                        <span className="font-mono text-[11px] text-primary truncate max-w-[120px]">
                          {claim.receiptName}
                        </span>
                        <span className="text-[10px] text-muted">({claim.receiptSize})</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-xs">
                      {/* Visual 3-Stage Pipeline Tracker */}
                      <div className="flex items-center gap-1">
                        <span className="px-2 py-0.5 rounded bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-300 text-[10px] font-semibold">
                          1. Submit
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted" />
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            claim.approvalStage === 'Manager Approved' ||
                            claim.approvalStage === 'Finance Approved' ||
                            claim.approvalStage === 'Reimbursed'
                              ? 'bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-300'
                              : 'bg-[rgb(var(--bg-muted))] text-muted'
                          }`}
                        >
                          2. Manager
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted" />
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            claim.approvalStage === 'Finance Approved' ||
                            claim.approvalStage === 'Reimbursed'
                              ? 'bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-300'
                              : 'bg-[rgb(var(--bg-muted))] text-muted'
                          }`}
                        >
                          3. Finance
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge
                        tone={
                          claim.status === 'Reimbursed' || claim.status === 'Approved for Payroll'
                            ? 'success'
                            : claim.status === 'Rejected'
                            ? 'error'
                            : 'warning'
                        }
                        dot
                      >
                        {claim.status}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      {claim.status === 'Pending Manager' && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleManagerApprove(claim.id)}
                          >
                            <Check className="h-3.5 w-3.5" /> Approve
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleReject(claim.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      {claim.status === 'Pending Finance' && (
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleFinanceApprove(claim.id)}
                          >
                            <Check className="h-3.5 w-3.5" /> Queue to Pay
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => handleReject(claim.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      {(claim.status === 'Approved for Payroll' || claim.status === 'Reimbursed') && (
                        <span className="text-xs font-medium text-success-600 dark:text-success-400">
                          ✓ Processed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Submit Claim Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Submit New Expense Claim"
        description="Upload official tax receipts and submit for Manager & Finance sign-off."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateClaim}>
              Submit Claim
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Employee</Label>
              <Select
                value={empName}
                onChange={(e) => {
                  setEmpName(e.target.value);
                  setEmpId(e.target.value === 'Sarah Chen' ? 'EMP-001' : 'EMP-002');
                }}
              >
                <option value="Sarah Chen">Sarah Chen (EMP-001)</option>
                <option value="Marcus Johnson">Marcus Johnson (EMP-002)</option>
                <option value="Lisa Wang">Lisa Wang (EMP-005)</option>
              </Select>
            </div>
            <div>
              <Label>Expense Category</Label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseClaim['category'])}
              >
                <option value="Travel & Accommodation">Travel & Accommodation</option>
                <option value="Meals & Entertainment">Meals & Entertainment</option>
                <option value="Software & Subscriptions">Software & Subscriptions</option>
                <option value="Equipment & Hardware">Equipment & Hardware</option>
                <option value="Training & Certifications">Training & Certifications</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Claim Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Expense Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Business Justification / Description</Label>
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="State client, project, or purpose..."
            />
          </div>

          {/* Receipt Upload Dropzone Simulation */}
          <div className="border-2 border-dashed border-base rounded-xl p-4 text-center space-y-2 hover:border-accent-500/50 transition-colors">
            <Upload className="h-6 w-6 text-accent-500 mx-auto" />
            <div className="text-xs font-semibold text-primary">Upload Receipt / Tax Invoice</div>
            <div className="text-[11px] text-muted">Supports PDF, PNG, JPG up to 10MB</div>
            <div className="text-xs font-mono text-accent-600 font-medium">{receiptFile}</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

