import { useState } from 'react';
import {
  ArrowLeft,
  TrendingUp,
  ArrowRightLeft,
  DollarSign,
  CheckCircle2,
  Ban,
  LogOut,
  RotateCcw,
  FileText,
  Receipt,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { useNav } from '@/context/NavContext';
import { employees } from '@/data/mockData';

type ActionType = 'promotion' | 'transfer' | 'salary-revision' | 'probation' | 'suspension' | 'resignation' | 'rehire' | 'exit-interview' | 'settlement';

const actions: { type: ActionType; label: string; description: string; icon: typeof TrendingUp; tone: string }[] = [
  { type: 'promotion', label: 'Promotion', description: 'Promote employee to a higher role or grade', icon: TrendingUp, tone: 'accent' },
  { type: 'transfer', label: 'Transfer', description: 'Move employee to a different department or location', icon: ArrowRightLeft, tone: 'accent' },
  { type: 'salary-revision', label: 'Salary Revision', description: 'Adjust compensation — increase or decrease', icon: DollarSign, tone: 'success' },
  { type: 'probation', label: 'Probation & Confirmation', description: 'Complete or extend probation period', icon: CheckCircle2, tone: 'success' },
  { type: 'suspension', label: 'Suspension', description: 'Temporarily suspend employee with reason', icon: Ban, tone: 'warning' },
  { type: 'resignation', label: 'Resignation / Termination', description: 'Process exit — voluntary or involuntary', icon: LogOut, tone: 'error' },
  { type: 'rehire', label: 'Rehire', description: 'Re-engage a former employee', icon: RotateCcw, tone: 'accent' },
  { type: 'exit-interview', label: 'Exit Interview', description: 'Conduct and record exit interview', icon: FileText, tone: 'neutral' },
  { type: 'settlement', label: 'Full & Final Settlement', description: 'Calculate earnings vs deductions', icon: Receipt, tone: 'neutral' },
];

function PromotionForm({ onClose }: { onClose?: () => void } = {}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Current Designation</Label>
          <Input defaultValue="Senior Engineering Manager" disabled />
        </div>
        <div>
          <Label>New Designation</Label>
          <Select>
            <option>VP Engineering</option>
            <option>Engineering Director</option>
            <option>Principal Engineer</option>
          </Select>
        </div>
        <div>
          <Label>New Job Level</Label>
          <Select><option>M2 — Director</option><option>L5 — Principal</option></Select>
        </div>
        <div>
          <Label>New Salary Grade</Label>
          <Select><option>G7</option><option>G8</option></Select>
        </div>
        <div>
          <Label>Effective Date</Label>
          <Input type="date" defaultValue="2024-09-01" />
        </div>
        <div>
          <Label>New Department (if changed)</Label>
          <Select><option value="">Same department</option><option>Engineering</option><option>Operations</option></Select>
        </div>
      </div>
      <div>
        <Label>Reason / Notes</Label>
        <Textarea rows={3} placeholder="Promotion justification..." />
      </div>
    </div>
  );
}

function TransferForm({ onClose }: { onClose?: () => void } = {}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Current Department</Label>
          <Input defaultValue="Engineering" disabled />
        </div>
        <div>
          <Label>New Department</Label>
          <Select><option>Operations</option><option>Sales</option><option>Marketing</option></Select>
        </div>
        <div>
          <Label>Current Location</Label>
          <Input defaultValue="San Francisco HQ" disabled />
        </div>
        <div>
          <Label>New Location</Label>
          <Select><option>New York Office</option><option>London Branch</option><option>Singapore Hub</option></Select>
        </div>
        <div>
          <Label>New Manager</Label>
          <Select><option>John Smith</option><option>Marcus Johnson</option></Select>
        </div>
        <div>
          <Label>Effective Date</Label>
          <Input type="date" defaultValue="2024-09-15" />
        </div>
      </div>
      <div>
        <Label>Transfer Reason</Label>
        <Textarea rows={3} placeholder="Business need, employee request..." />
      </div>
    </div>
  );
}

function SalaryRevisionForm() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Current Salary</Label>
          <Input defaultValue="$165,000" disabled />
        </div>
        <div>
          <Label>New Salary</Label>
          <Input type="number" placeholder="180000" />
        </div>
        <div>
          <Label>Currency</Label>
          <Select><option>USD</option><option>EUR</option><option>GBP</option></Select>
        </div>
        <div>
          <Label>Pay Frequency</Label>
          <Select><option>Monthly</option><option>Bi-weekly</option><option>Weekly</option></Select>
        </div>
        <div>
          <Label>Change Type</Label>
          <Select><option>Increase</option><option>Decrease</option><option>Adjustment</option></Select>
        </div>
        <div>
          <Label>Effective Date</Label>
          <Input type="date" defaultValue="2024-09-01" />
        </div>
      </div>
      <div>
        <Label>Justification</Label>
        <Textarea rows={3} placeholder="Annual review, performance bonus..." />
      </div>
    </div>
  );
}

function ProbationForm() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Probation Start</Label>
          <Input type="date" defaultValue="2024-08-01" disabled />
        </div>
        <div>
          <Label>Probation End</Label>
          <Input type="date" defaultValue="2024-11-01" />
        </div>
        <div>
          <Label>Action</Label>
          <Select><option>Confirm Employment</option><option>Extend Probation</option><option>Terminate</option></Select>
        </div>
        <div>
          <Label>Confirmation Date</Label>
          <Input type="date" defaultValue="2024-11-01" />
        </div>
      </div>
      <div>
        <Label>Manager Assessment</Label>
        <Textarea rows={4} placeholder="Performance during probation period..." />
      </div>
    </div>
  );
}

function SuspensionForm() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Start Date</Label>
          <Input type="date" />
        </div>
        <div>
          <Label>End Date (if known)</Label>
          <Input type="date" />
        </div>
        <div>
          <Label>Duration</Label>
          <Select><option>Indefinite</option><option>3 days</option><option>1 week</option><option>2 weeks</option><option>1 month</option></Select>
        </div>
        <div>
          <Label>With Pay?</Label>
          <Select><option>With Pay</option><option>Without Pay</option></Select>
        </div>
      </div>
      <div>
        <Label>Reason</Label>
        <Textarea rows={4} placeholder="Detailed reason for suspension..." />
      </div>
    </div>
  );
}

function ResignationForm() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Exit Type</Label>
          <Select><option>Voluntary Resignation</option><option>Involuntary Termination</option><option>End of Contract</option><option>Retirement</option></Select>
        </div>
        <div>
          <Label>Last Working Day</Label>
          <Input type="date" />
        </div>
        <div>
          <Label>Notice Period</Label>
          <Select><option>60 days</option><option>30 days</option><option>15 days</option><option>Waived</option></Select>
        </div>
        <div>
          <Label>Exit Interview Required?</Label>
          <Select><option>Yes</option><option>No</option></Select>
        </div>
      </div>
      <div>
        <Label>Reason for Leaving</Label>
        <Textarea rows={4} placeholder="Employee stated reason..." />
      </div>
    </div>
  );
}

function RehireForm() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Former Employee</Label>
          <Input defaultValue="Robert Lee (EMP-012)" disabled />
        </div>
        <div>
          <Label>New Designation</Label>
          <Select><option>Senior Software Engineer</option><option>Staff Engineer</option></Select>
        </div>
        <div>
          <Label>Rehire Date</Label>
          <Input type="date" />
        </div>
        <div>
          <Label>Employment Type</Label>
          <Select><option>Full-Time</option><option>Contract</option><option>Part-Time</option></Select>
        </div>
      </div>
      <div>
        <Label>Rehire Notes</Label>
        <Textarea rows={3} placeholder="Previous tenure, performance..." />
      </div>
    </div>
  );
}

function ExitInterviewForm() {
  return (
    <div className="space-y-4">
    <div>
      <Label>Primary reason for leaving?</Label>
      <Select><option>Better opportunity</option><option>Career growth</option><option>Compensation</option><option>Work-life balance</option><option>Relocation</option><option>Other</option></Select>
    </div>
    <div>
      <Label>How was your experience at the company?</Label>
      <Select><option>Very Positive</option><option>Positive</option><option>Neutral</option><option>Negative</option><option>Very Negative</option></Select>
    </div>
    <div>
      <Label>Would you recommend this company as a workplace?</Label>
      <Select><option>Definitely</option><option>Probably</option><option>Not sure</option><option>Probably not</option><option>Definitely not</option></Select>
    </div>
    <div>
      <Label>What did you like most about working here?</Label>
      <Textarea rows={3} />
    </div>
    <div>
      <Label>What could we improve?</Label>
      <Textarea rows={3} />
    </div>
      <div>
        <Label>Additional comments</Label>
        <Textarea rows={2} />
      </div>
    </div>
  );
}

function SettlementSummary() {
  const earnings = [
    { label: 'Salary (Aug 1-15)', amount: '$7,500' },
    { label: 'Unused Leave Encashment (12 days)', amount: '$6,000' },
    { label: 'Performance Bonus (Pro-rated)', amount: '$3,200' },
    { label: 'Gratuity', amount: '$2,800' },
  ];
  const deductions = [
    { label: 'Tax Withholding', amount: '$2,400' },
    { label: 'Notice Period Recovery (5 days)', amount: '$2,500' },
    { label: 'Asset Damage Deduction', amount: '$150' },
    { label: 'Loan / Advance Recovery', amount: '$0' },
  ];
  const totalEarnings = 19500;
  const totalDeductions = 5050;
  const netPayable = totalEarnings - totalDeductions;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="surface border border-base rounded-xl p-4">
          <div className="text-sm font-semibold text-success-700 dark:text-success-300 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Earnings
          </div>
          <div className="space-y-2">
            {earnings.map((e) => (
              <div key={e.label} className="flex items-center justify-between text-sm">
                <span className="text-secondary">{e.label}</span>
                <span className="text-primary font-medium">{e.amount}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-base flex items-center justify-between">
              <span className="text-sm font-semibold text-primary">Total Earnings</span>
              <span className="text-success-600 font-bold">${totalEarnings.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="surface border border-base rounded-xl p-4">
          <div className="text-sm font-semibold text-error-700 dark:text-error-300 mb-3 flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" /> Deductions
          </div>
          <div className="space-y-2">
            {deductions.map((d) => (
              <div key={d.label} className="flex items-center justify-between text-sm">
                <span className="text-secondary">{d.label}</span>
                <span className="text-primary font-medium">{d.amount}</span>
              </div>
            ))}
            <div className="pt-2 border-t border-base flex items-center justify-between">
              <span className="text-sm font-semibold text-primary">Total Deductions</span>
              <span className="text-error-600 font-bold">${totalDeductions.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="surface border-2 border-accent-500/30 rounded-xl p-4 flex items-center justify-between bg-accent-50/50 dark:bg-accent-950/20">
        <div>
          <div className="text-sm font-semibold text-primary">Net Payable Amount</div>
          <div className="text-xs text-muted">To be transferred to employee's bank account</div>
        </div>
        <div className="text-2xl font-bold text-accent-600">${netPayable.toLocaleString()}</div>
      </div>
    </div>
  );
}

export function LifecycleEventsPage() {
  const { navigate } = useNav();
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const emp = employees[0];

  const actionToneClasses: Record<string, string> = {
    accent: 'bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400',
    success: 'bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400',
    warning: 'bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400',
    error: 'bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400',
    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
  };

  const formMap: Record<ActionType, () => JSX.Element> = {
    promotion: PromotionForm,
    transfer: TransferForm,
    'salary-revision': SalaryRevisionForm,
    probation: ProbationForm,
    suspension: SuspensionForm,
    resignation: ResignationForm,
    rehire: RehireForm,
    'exit-interview': ExitInterviewForm,
    settlement: SettlementSummary,
  };

  const modalConfig: Record<ActionType, { title: string; description: string; size: 'md' | 'lg' | 'xl'; cta: string }> = {
    promotion: { title: 'Promote Employee', description: `Promote ${emp.name} to a new role`, size: 'lg', cta: 'Submit Promotion' },
    transfer: { title: 'Transfer Employee', description: `Transfer ${emp.name} to a new department`, size: 'lg', cta: 'Submit Transfer' },
    'salary-revision': { title: 'Salary Revision', description: `Adjust compensation for ${emp.name}`, size: 'lg', cta: 'Submit Revision' },
    probation: { title: 'Probation & Confirmation', description: `Manage probation for ${emp.name}`, size: 'lg', cta: 'Submit Decision' },
    suspension: { title: 'Suspend Employee', description: `Suspend ${emp.name}`, size: 'lg', cta: 'Submit Suspension' },
    resignation: { title: 'Resignation / Termination', description: `Process exit for ${emp.name}`, size: 'lg', cta: 'Submit Exit' },
    rehire: { title: 'Rehire Employee', description: 'Re-engage a former employee', size: 'lg', cta: 'Submit Rehire' },
    'exit-interview': { title: 'Exit Interview', description: `Record exit interview for ${emp.name}`, size: 'lg', cta: 'Save Interview' },
    settlement: { title: 'Full & Final Settlement', description: `Settlement summary for ${emp.name}`, size: 'xl', cta: 'Approve & Process' },
  };

  const config = activeAction ? modalConfig[activeAction] : null;
  const FormComponent = activeAction ? formMap[activeAction] : null;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <button onClick={() => navigate('emp-profile')} className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Profile
      </button>

      {/* Employee context */}
      <Card>
        <CardBody className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300 flex items-center justify-center text-base font-semibold">
            {emp.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-semibold text-primary">{emp.name}</span>
              <Badge tone="neutral">{emp.employeeId}</Badge>
            </div>
            <div className="text-sm text-secondary">{emp.designation} · {emp.department}</div>
          </div>
          <Badge tone="success" dot>{emp.status}</Badge>
        </CardBody>
      </Card>

      <div>
        <h2 className="text-lg font-bold text-primary mb-1">Lifecycle Actions</h2>
        <p className="text-sm text-secondary">Choose an action to perform on this employee. Each action opens a dedicated form.</p>
      </div>

      {/* Action cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Card
              key={action.type}
              className="hover:shadow-card-hover transition-shadow cursor-pointer group"
              onClick={() => setActiveAction(action.type)}
            >
              <CardBody>
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg ${actionToneClasses[action.tone]} flex items-center justify-center shrink-0`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-primary">{action.label}</div>
                    <div className="text-xs text-secondary mt-0.5 leading-relaxed">{action.description}</div>
                  </div>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Action modal */}
      <Modal
        open={activeAction !== null}
        onClose={() => setActiveAction(null)}
        title={config?.title}
        description={config?.description}
        size={config?.size}
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveAction(null)}>Cancel</Button>
            <Button variant={activeAction === 'resignation' || activeAction === 'suspension' ? 'danger' : 'primary'}>
              {config?.cta}
            </Button>
          </>
        }
      >
        {FormComponent && <FormComponent />}
      </Modal>
    </div>
  );
}
