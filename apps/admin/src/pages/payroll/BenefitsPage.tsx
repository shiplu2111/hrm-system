import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  HeartPulse,
  ShieldCheck,
  PiggyBank,
  Smile,
  Activity,
  Users,
  CheckCircle2,
  UserPlus,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { useCompany } from '@/context/CompanyContext';
import { listEmployees } from '@/lib/employees-api';
import {
  BENEFIT_CATEGORY_LABELS,
  BENEFIT_PLAN_STATUS_LABELS,
  createBenefitEnrollment,
  DEPENDENT_RELATIONSHIP_LABELS,
  getBenefitsSummary,
  listBenefitPlans,
} from '@/lib/benefits-api';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  BenefitAdminSummary,
  BenefitDependentRelationship,
  BenefitPlanRecord,
  EmployeeRecord,
} from '@hrm/shared-types';

function getPlanIcon(category: string) {
  switch (category) {
    case 'health_insurance':
      return <HeartPulse className="h-5 w-5 text-rose-500" />;
    case 'life_insurance':
      return <ShieldCheck className="h-5 w-5 text-accent-500" />;
    case 'dental_vision':
      return <Smile className="h-5 w-5 text-sky-500" />;
    case 'wellness':
      return <Activity className="h-5 w-5 text-purple-500" />;
    default:
      return <PiggyBank className="h-5 w-5 text-success-500" />;
  }
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(value);
}

function planStatusLabel(plan: BenefitPlanRecord): string {
  if (plan.inOpenEnrollment) {
    return 'Open Enrollment';
  }
  return BENEFIT_PLAN_STATUS_LABELS[plan.status] ?? plan.status;
}

function planStatusTone(
  plan: BenefitPlanRecord,
): 'success' | 'accent' | 'neutral' {
  if (plan.inOpenEnrollment) return 'accent';
  if (plan.status === 'active') return 'success';
  return 'neutral';
}

export function BenefitsPage() {
  const { companyId } = useCompany();
  const [plans, setPlans] = useState<BenefitPlanRecord[]>([]);
  const [summary, setSummary] = useState<BenefitAdminSummary | null>(null);
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<BenefitPlanRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [enrolledSuccess, setEnrolledSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState('');
  const [depName, setDepName] = useState('');
  const [relationship, setRelationship] = useState<BenefitDependentRelationship>('spouse');
  const [depDob, setDepDob] = useState('');
  const [beneficiaryShare, setBeneficiaryShare] = useState('100');

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [planRows, summaryRow, employeeRows] = await Promise.all([
        listBenefitPlans(companyId),
        getBenefitsSummary(companyId),
        listEmployees(companyId),
      ]);
      setPlans(planRows);
      setSummary(summaryRow);
      setEmployees(employeeRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load benefits data');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const totalEnrolled = useMemo(
    () => plans.reduce((sum, plan) => sum + plan.enrolledCount, 0),
    [plans],
  );

  const openEnrollModal = (plan: BenefitPlanRecord) => {
    setSelectedPlan(plan);
    setEmployeeId(employees[0]?.id ?? '');
    setDepName('');
    setRelationship('spouse');
    setDepDob('');
    setBeneficiaryShare('100');
    setFormError(null);
    setEnrolledSuccess(false);
    setEnrollModalOpen(true);
  };

  const handleEnrollSubmit = async () => {
    if (!companyId || !selectedPlan || !employeeId) {
      setFormError('Select an employee to enroll.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const enrollmentType = selectedPlan.inOpenEnrollment
        ? 'open_enrollment'
        : 'admin';
      const effectiveFrom =
        summary?.openEnrollmentPeriod?.endDate ??
        new Date().toISOString().slice(0, 10);

      await createBenefitEnrollment(companyId, {
        employeeId,
        benefitPlanId: selectedPlan.id,
        openEnrollmentPeriodId: summary?.openEnrollmentPeriod?.id,
        enrollmentType,
        effectiveFrom,
        employeeContributionAmount: selectedPlan.employeeContributionAmount,
        beneficiarySharePercent:
          selectedPlan.category === 'life_insurance'
            ? Number(beneficiaryShare)
            : undefined,
        dependents: depName.trim()
          ? [
              {
                fullName: depName.trim(),
                relationship,
                dateOfBirth: depDob || undefined,
                beneficiarySharePercent: Number(beneficiaryShare) || undefined,
              },
            ]
          : undefined,
      });

      setEnrolledSuccess(true);
      await loadData();
      setTimeout(() => {
        setEnrolledSuccess(false);
        setEnrollModalOpen(false);
      }, 1500);
    } catch (err) {
      setFormError(
        err instanceof ApiError ? err.message : 'Enrollment failed. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading benefits…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="rounded-xl border border-error-200 bg-error-50 dark:bg-error-950/30 p-4 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Benefits Administration</h1>
          <p className="text-sm text-secondary mt-0.5">
            Health and life insurance plans, open enrollment, and dependent coverage — separate from superannuation.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => plans[0] && openEnrollModal(plans[0])}
          disabled={plans.length === 0}
        >
          <UserPlus className="h-4 w-4" /> Enroll Employee
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">
              {summary?.activePlanCount ?? plans.length} Corporate Plans
            </div>
            <div className="text-xs text-secondary mt-0.5">Active benefit packages</div>
          </div>
          {summary?.openEnrollmentPeriod ? (
            <Badge tone="accent">Open Enrollment</Badge>
          ) : (
            <Badge tone="neutral">No active OE window</Badge>
          )}
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-success-600 dark:text-success-400">
              {totalEnrolled} Active Enrollments
            </div>
            <div className="text-xs text-secondary mt-0.5">
              {summary?.dependentCoverageCount ?? 0} dependents covered
            </div>
          </div>
          <Badge tone="success">Live</Badge>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(summary?.monthlyEmployerSubsidy ?? 0)} / mo
            </div>
            <div className="text-xs text-secondary mt-0.5">Employer subsidy (active enrollments)</div>
          </div>
          <Badge tone="neutral">Employer co-pay</Badge>
        </div>
      </div>

      {summary?.openEnrollmentPeriod && (
        <div className="rounded-xl border border-accent-200 bg-accent-50 dark:bg-accent-950/20 p-4 text-sm">
          <strong>{summary.openEnrollmentPeriod.name}</strong> is open through{' '}
          {summary.openEnrollmentPeriod.endDate}. Employees may enroll in linked plans during this window.
        </div>
      )}

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
                    {plan.provider} ·{' '}
                    <span className="font-semibold text-primary">{plan.planTier} tier</span>
                  </div>
                </div>
              </div>
              <Badge tone={planStatusTone(plan)} dot>
                {planStatusLabel(plan)}
              </Badge>
            </CardHeader>

            <CardBody className="space-y-4 pt-0 flex-1 flex flex-col justify-between">
              <p className="text-xs text-secondary leading-relaxed">
                {plan.description ?? BENEFIT_CATEGORY_LABELS[plan.category]}
              </p>

              <div className="surface border border-base rounded-xl p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-secondary">
                  <span>Employer subsidy:</span>
                  <strong className="text-success-600 dark:text-success-400 font-semibold">
                    {plan.employerContributionLabel ??
                      (plan.employerContributionAmount != null
                        ? formatCurrency(plan.employerContributionAmount)
                        : '—')}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-secondary">
                  <span>Employee co-pay:</span>
                  <strong className="text-primary font-semibold">
                    {plan.employeeContributionLabel ??
                      formatCurrency(plan.employeeContributionAmount)}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-secondary">
                  <span>Coverage maximum:</span>
                  <strong className="text-primary font-semibold">
                    {plan.coverageLimitLabel ?? '—'}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-base">
                <div className="flex items-center gap-1.5 text-xs text-secondary">
                  <Users className="h-4 w-4 text-muted" />
                  <span>
                    <strong>{plan.enrolledCount}</strong> enrolled
                    {plan.dependentCount > 0 && (
                      <> · <strong>{plan.dependentCount}</strong> dependents</>
                    )}
                  </span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => openEnrollModal(plan)}>
                  Enroll / Manage
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {plans.length === 0 && (
        <div className="text-center text-sm text-secondary py-12">
          No benefit plans configured for this company yet.
        </div>
      )}

      <Modal
        open={enrollModalOpen}
        onClose={() => setEnrollModalOpen(false)}
        title="Benefit Enrollment"
        description={`Enroll an employee${selectedPlan ? ` in ${selectedPlan.name}` : ''}${depName.trim() ? ' with dependent coverage' : ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEnrollModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void handleEnrollSubmit()} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Enrollment'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Employee</Label>
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.fullName} ({emp.employeeNumber})
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Dependent full name (optional)</Label>
              <Input
                value={depName}
                onChange={(e) => setDepName(e.target.value)}
                placeholder="e.g. Alex Lee"
              />
            </div>
            <div>
              <Label>Relationship</Label>
              <Select
                value={relationship}
                onChange={(e) =>
                  setRelationship(e.target.value as BenefitDependentRelationship)
                }
              >
                {Object.entries(DEPENDENT_RELATIONSHIP_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Dependent date of birth</Label>
              <Input type="date" value={depDob} onChange={(e) => setDepDob(e.target.value)} />
            </div>
            <div>
              <Label>Beneficiary share (%)</Label>
              <Select
                value={beneficiaryShare}
                onChange={(e) => setBeneficiaryShare(e.target.value)}
              >
                <option value="100">100% (Primary)</option>
                <option value="50">50% (Co-beneficiary)</option>
                <option value="25">25%</option>
              </Select>
            </div>
          </div>

          {formError && (
            <div className="p-3 rounded-lg bg-error-50 dark:bg-error-950/40 text-error-700 dark:text-error-300 text-xs">
              {formError}
            </div>
          )}

          {enrolledSuccess && (
            <div className="p-3 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-700 dark:text-success-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Enrollment submitted successfully!
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
