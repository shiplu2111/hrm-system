import { useState } from 'react';
import {
  HeartPulse,
  ShieldCheck,
  PiggyBank,
  Smile,
  Activity,
  Plus,
  Users,
  CheckCircle2,
  Building,
  ArrowRight,
  UserPlus,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { benefitPlans, type BenefitPlan } from '@/data/payrollData';

export function BenefitsPage() {
  const [plans, setPlans] = useState<BenefitPlan[]>(benefitPlans);
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BenefitPlan | null>(null);

  // Dependent Form State
  const [empName, setEmpName] = useState('Sarah Chen (EMP-001)');
  const [depName, setDepName] = useState('');
  const [relationship, setRelationship] = useState('Spouse');
  const [depDob, setDepDob] = useState('1992-05-14');
  const [beneficiaryShare, setBeneficiaryShare] = useState('100%');
  const [enrolledSuccess, setEnrolledSuccess] = useState(false);

  const openEnrollModal = (plan: BenefitPlan) => {
    setSelectedPlan(plan);
    setDepName('');
    setRelationship('Spouse');
    setBeneficiaryShare('100%');
    setEnrollModalOpen(true);
  };

  const handleEnrollSubmit = () => {
    if (selectedPlan) {
      setPlans((prev) =>
        prev.map((p) =>
          p.id === selectedPlan.id ? { ...p, enrolledCount: p.enrolledCount + 1 } : p
        )
      );
    }
    setEnrolledSuccess(true);
    setTimeout(() => {
      setEnrolledSuccess(false);
      setEnrollModalOpen(false);
    }, 1500);
  };

  const getPlanIcon = (category: string) => {
    switch (category) {
      case 'Health Insurance':
        return <HeartPulse className="h-5 w-5 text-rose-500" />;
      case 'Life Insurance':
        return <ShieldCheck className="h-5 w-5 text-accent-500" />;
      case 'Retirement 401(k)':
        return <PiggyBank className="h-5 w-5 text-success-500" />;
      case 'Dental & Vision':
        return <Smile className="h-5 w-5 text-sky-500" />;
      default:
        return <Activity className="h-5 w-5 text-purple-500" />;
    }
  };

  const totalEnrolled = plans.reduce((s, p) => s + p.enrolledCount, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Benefits & Superannuation Plans</h1>
          <p className="text-sm text-secondary mt-0.5">
            Corporate health coverage, retirement matching, and family dependent enrollments.
          </p>
        </div>
        <Button variant="primary" onClick={() => openEnrollModal(plans[0])}>
          <UserPlus className="h-4 w-4" /> Enroll Dependent
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">{plans.length} Corporate Plans</div>
            <div className="text-xs text-secondary mt-0.5">Active Benefit Packages</div>
          </div>
          <Badge tone="accent">Open Enrollment</Badge>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-success-600 dark:text-success-400">
              {totalEnrolled} Active Subscriptions
            </div>
            <div className="text-xs text-secondary mt-0.5">Covered Employees & Dependents</div>
          </div>
          <Badge tone="success">96% Opt-in Rate</Badge>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">$124,500 / mo</div>
            <div className="text-xs text-secondary mt-0.5">Total Employer Subsidy Contribution</div>
          </div>
          <Badge tone="neutral">Employer Co-pay</Badge>
        </div>
      </div>

      {/* Benefit Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className="hover:shadow-card-hover transition-shadow flex flex-col justify-between">
            <CardHeader className="pb-3 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-[rgb(var(--bg-muted))] flex items-center justify-center shrink-0">
                  {getPlanIcon(plan.category)}
                </div>
                <div>
                  <CardTitle className="text-sm font-bold">{plan.name}</CardTitle>
                  <div className="text-xs text-secondary font-medium mt-0.5">
                    {plan.provider} · <span className="font-semibold text-primary">{plan.planTier} Tier</span>
                  </div>
                </div>
              </div>
              <Badge tone={plan.status === 'Active' ? 'success' : 'accent'} dot>
                {plan.status}
              </Badge>
            </CardHeader>

            <CardBody className="space-y-4 pt-0 flex-1 flex flex-col justify-between">
              <p className="text-xs text-secondary leading-relaxed">{plan.description}</p>

              <div className="surface border border-base rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-secondary">
                  <span>Employer Subsidy:</span>
                  <strong className="text-success-600 dark:text-success-400 font-semibold">
                    {plan.employerContribution}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-secondary">
                  <span>Employee Co-Pay:</span>
                  <strong className="text-primary font-semibold">{plan.employeeContribution}</strong>
                </div>
                <div className="flex items-center justify-between text-secondary">
                  <span>Coverage Maximum:</span>
                  <strong className="text-primary font-semibold">{plan.coverageLimit}</strong>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-base">
                <div className="flex items-center gap-1.5 text-xs text-secondary">
                  <Users className="h-4 w-4 text-muted" />
                  <span><strong>{plan.enrolledCount}</strong> staff enrolled</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => openEnrollModal(plan)}>
                  Enroll / Manage
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Dependent Enrollment Modal */}
      <Modal
        open={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        title="Dependent Benefit Coverage Enrollment"
        description={`Add family dependents for ${selectedPlan?.name || 'Benefit Plan'}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEnrollModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleEnrollSubmit}>
              Submit Enrollment
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Employee</Label>
            <Select value={empName} onChange={(e) => setEmpName(e.target.value)}>
              <option>Sarah Chen (EMP-001)</option>
              <option>Marcus Johnson (EMP-002)</option>
              <option>Lisa Wang (EMP-005)</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Dependent Full Name</Label>
              <Input
                value={depName}
                onChange={(e) => setDepName(e.target.value)}
                placeholder="e.g. David Chen"
              />
            </div>
            <div>
              <Label>Relationship</Label>
              <Select value={relationship} onChange={(e) => setRelationship(e.target.value)}>
                <option>Spouse</option>
                <option>Child</option>
                <option>Parent</option>
                <option>Domestic Partner</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date of Birth</Label>
              <Input
                type="date"
                value={depDob}
                onChange={(e) => setDepDob(e.target.value)}
              />
            </div>
            <div>
              <Label>Beneficiary Allocation Share</Label>
              <Select
                value={beneficiaryShare}
                onChange={(e) => setBeneficiaryShare(e.target.value)}
              >
                <option>100% (Primary)</option>
                <option>50% (Co-beneficiary)</option>
                <option>25%</option>
              </Select>
            </div>
          </div>

          {enrolledSuccess && (
            <div className="p-3 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-700 dark:text-success-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Dependent Coverage Successfully Enrolled!
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

