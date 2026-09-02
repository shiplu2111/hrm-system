import { useState } from 'react';
import {
  HandCoins,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  Building,
  Calculator,
  Check,
  X,
  CreditCard,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Progress } from '@/components/ui/Progress';
import { Avatar } from '@/components/ui/Toggle';
import { loanRecords, type LoanRecord } from '@/data/payrollData';

export function LoansPage() {
  const [loans, setLoans] = useState<LoanRecord[]>(loanRecords);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // New Loan Form State
  const [empName, setEmpName] = useState('Sarah Chen');
  const [empId, setEmpId] = useState('EMP-001');
  const [loanType, setLoanType] = useState<LoanRecord['loanType']>('Emergency Advance');
  const [amount, setAmount] = useState(3000);
  const [interest, setInterest] = useState(0);
  const [tenor, setTenor] = useState(6);

  const calculatedEmi = Math.round(
    interest > 0
      ? (amount * (1 + interest / 100)) / tenor
      : amount / tenor
  );

  const handleCreateLoan = () => {
    const newLoan: LoanRecord = {
      id: `loan-${Date.now()}`,
      loanId: `LN-2024-00${loans.length + 1}`,
      employeeId: empId,
      employeeName: empName,
      loanType,
      principalAmount: amount,
      interestRate: interest,
      tenorMonths: tenor,
      monthlyEmi: calculatedEmi,
      disbursedDate: new Date().toISOString().split('T')[0],
      repaidAmount: 0,
      remainingBalance: amount,
      installmentsPaid: 0,
      installmentsTotal: tenor,
      deductFromPayroll: true,
      status: 'Active',
    };
    setLoans((prev) => [newLoan, ...prev]);
    setModalOpen(false);
  };

  const handleApprove = (id: string) => {
    setLoans((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: 'Active' } : l))
    );
  };

  const handleReject = (id: string) => {
    setLoans((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: 'Rejected' } : l))
    );
  };

  const filteredLoans = loans.filter(
    (l) =>
      l.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      l.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      l.loanType.toLowerCase().includes(search.toLowerCase()) ||
      l.loanId.toLowerCase().includes(search.toLowerCase())
  );

  const totalOutstanding = loans
    .filter((l) => l.status === 'Active')
    .reduce((s, l) => s + l.remainingBalance, 0);

  const monthlyRecovered = loans
    .filter((l) => l.status === 'Active')
    .reduce((s, l) => s + l.monthlyEmi, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Loans & Salary Advances</h1>
          <p className="text-sm text-secondary mt-0.5">
            Manage company loans, salary advance requests, and automatic monthly EMI payroll recoveries.
          </p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Grant Loan / Advance
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">${totalOutstanding.toLocaleString()}</div>
            <div className="text-xs text-secondary mt-0.5">Total Outstanding Loan Balance</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center">
            <HandCoins className="h-5 w-5" />
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-success-600 dark:text-success-400">
              ${monthlyRecovered.toLocaleString()} / mo
            </div>
            <div className="text-xs text-secondary mt-0.5">Scheduled Monthly Payroll Recovery</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center">
            <TrendingDown className="h-5 w-5" />
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-warning-600">
              {loans.filter((l) => l.status === 'Pending Approval').length}
            </div>
            <div className="text-xs text-secondary mt-0.5">Pending Advance Requests</div>
          </div>
          <div className="h-10 w-10 rounded-lg bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400 flex items-center justify-center">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Loans Table */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle>Active Loans & Installment Schedules</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search loans by employee, ID..."
              className="pl-8 text-xs h-8"
            />
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Loan ID / Staff
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Loan Type
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Principal & Interest
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Monthly EMI
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Repayment Progress
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
                {filteredLoans.map((loan) => {
                  const progressPct = Math.round(
                    (loan.installmentsPaid / loan.installmentsTotal) * 100
                  );
                  return (
                    <tr key={loan.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={loan.employeeName} size="sm" />
                          <div>
                            <div className="font-semibold text-primary text-sm">{loan.employeeName}</div>
                            <div className="text-xs text-muted font-mono">{loan.loanId} · {loan.employeeId}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-primary font-medium">
                        {loan.loanType}
                      </td>

                      <td className="px-5 py-3.5 text-xs">
                        <div className="font-bold text-primary">${loan.principalAmount.toLocaleString()}</div>
                        <div className="text-[11px] text-muted">{loan.interestRate}% interest · {loan.tenorMonths} mo</div>
                      </td>

                      <td className="px-5 py-3.5 text-xs">
                        <span className="font-semibold text-error-600">-${loan.monthlyEmi} / mo</span>
                        <div className="text-[10px] text-success-600 font-medium">Auto-deducted</div>
                      </td>

                      <td className="px-5 py-3.5 w-48">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted">{loan.installmentsPaid} of {loan.installmentsTotal} paid</span>
                            <span className="font-semibold text-primary">${loan.remainingBalance} left</span>
                          </div>
                          <Progress value={progressPct} />
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <Badge
                          tone={
                            loan.status === 'Active'
                              ? 'success'
                              : loan.status === 'Pending Approval'
                              ? 'warning'
                              : loan.status === 'Fully Paid'
                              ? 'accent'
                              : 'neutral'
                          }
                          dot
                        >
                          {loan.status}
                        </Badge>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {loan.status === 'Pending Approval' ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="primary" size="sm" onClick={() => handleApprove(loan.id)}>
                              <Check className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => handleReject(loan.id)}>
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted font-mono">{loan.disbursedDate}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Modal with Live EMI Calculator */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Grant Loan / Salary Advance"
        description="Configure principal amount, repayment tenor, and automatic payroll EMI recovery."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateLoan}>
              Disburse & Activate EMI
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
              <Label>Loan / Advance Type</Label>
              <Select
                value={loanType}
                onChange={(e) => setLoanType(e.target.value as LoanRecord['loanType'])}
              >
                <option value="Emergency Advance">Emergency Advance</option>
                <option value="Home / Relocation">Home / Relocation</option>
                <option value="Education Assistance">Education Assistance</option>
                <option value="Device Purchase">Device Purchase</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Principal ($)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Annual Interest (%)</Label>
              <Input
                type="number"
                value={interest}
                onChange={(e) => setInterest(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label>Tenor (Months)</Label>
              <Input
                type="number"
                value={tenor}
                onChange={(e) => setTenor(parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* Live Calculated Summary */}
          <div className="surface border border-base rounded-xl p-4 bg-accent-50/20 dark:bg-accent-950/20 text-center space-y-1">
            <div className="text-xs text-secondary">Calculated Monthly Payroll Deduction (EMI)</div>
            <div className="text-2xl font-bold text-primary">${calculatedEmi} / month</div>
            <div className="text-[11px] text-muted">
              Auto-linked to monthly payroll run over {tenor} installment cycles.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

