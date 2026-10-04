import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HeartPulse,
  ShieldCheck,
  PiggyBank,
  Smile,
  Activity,
  Users,
  UserPlus,
  Loader2,
  AlertTriangle,
  Settings2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCompany } from '@/context/CompanyContext';
import { pathForPage } from '@/config/routes';
import {
  BENEFIT_CATEGORY_LABELS,
  BENEFIT_PLAN_STATUS_LABELS,
  getBenefitsSummary,
  listBenefitOpenEnrollments,
  listBenefitPlans,
} from '@/lib/benefits-api';
import { dependentNoun, dependentRuleSummary } from '@/lib/benefits-display';
import { formatDate, todayIso } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';
import type {
  BenefitAdminSummary,
  BenefitOpenEnrollmentPeriodRecord,
  BenefitPlanRecord,
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
): 'success' | 'accent' | 'neutral' | 'warning' {
  if (plan.inOpenEnrollment) return 'accent';
  if (plan.status === 'active') return 'success';
  if (plan.status === 'draft') return 'warning';
  return 'neutral';
}

export function BenefitsPage() {
  const routerNavigate = useNavigate();
  const { companyId, loading: companyLoading, error: companyError } = useCompany();
  const [plans, setPlans] = useState<BenefitPlanRecord[]>([]);
  const [summary, setSummary] = useState<BenefitAdminSummary | null>(null);
  const [periods, setPeriods] = useState<BenefitOpenEnrollmentPeriodRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [planRows, summaryRow, periodRows] = await Promise.all([
        listBenefitPlans(companyId),
        getBenefitsSummary(companyId),
        listBenefitOpenEnrollments(companyId),
      ]);
      setPlans(planRows);
      setSummary(summaryRow);
      setPeriods(periodRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load benefits data');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (companyLoading || (companyId && loading)) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading benefits…
      </div>
    );
  }

  const pageError = companyError ?? error ?? (companyId ? null : 'No company found for this tenant.');
  if (pageError) {
    return (
      <div className="p-6 max-w-[1400px] mx-auto">
        <div className="rounded-xl border border-error-200 bg-error-50 dark:bg-error-950/30 p-4 text-sm text-error-700 dark:text-error-300">
          {pageError}
        </div>
      </div>
    );
  }

  const today = todayIso();
  const acceptingPeriod = periods.find((p) => p.acceptingEnrollments) ?? null;
  const stalePeriod = periods.find((p) => p.status === 'open' && !p.acceptingEnrollments && p.endDate < today) ?? null;
  const shownPlans = plans.filter((p) => p.status !== 'inactive');
  const enrollmentsPath = pathForPage('benefit-enrollments');

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Benefits Administration</h1>
          <p className="text-sm text-secondary mt-0.5">
            Health and life insurance plans, open enrollment, and dependent coverage. Superannuation contribution
            rates are under Payroll → Superannuation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => routerNavigate(pathForPage('benefit-plans'))}>
            <Settings2 className="h-4 w-4" /> Benefit Plans
          </Button>
          <Button variant="primary" onClick={() => routerNavigate(enrollmentsPath)}>
            <UserPlus className="h-4 w-4" /> Benefit Enrollments
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-bold text-primary">
              {summary?.activePlanCount ?? 0} Active Plans
            </div>
            <div className="text-xs text-secondary mt-0.5">Plans employees can enroll in</div>
          </div>
          {acceptingPeriod ? (
            <Badge tone="accent">Open Enrollment</Badge>
          ) : (
            <Badge tone="neutral">No open window</Badge>
          )}
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-bold text-success-600 dark:text-success-400">
              {summary?.activeEnrollmentCount ?? 0} Active Enrollments
            </div>
            <div className="text-xs text-secondary mt-0.5">
              {summary?.dependentCoverageCount ?? 0} dependents and beneficiaries
            </div>
          </div>
          <Badge tone="success">Live</Badge>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(summary?.monthlyEmployerSubsidy ?? 0)} / mo
            </div>
            <div className="text-xs text-secondary mt-0.5">Employer cost of active enrollments</div>
          </div>
          <Badge tone="neutral">Employer co-pay</Badge>
        </div>
      </div>

      {acceptingPeriod ? (
        <div className="rounded-xl border border-accent-200 bg-accent-50 dark:bg-accent-950/20 p-4 text-sm">
          <strong>{acceptingPeriod.name}</strong> is open until {formatDate(acceptingPeriod.endDate)}. Employees can be
          enrolled in its {acceptingPeriod.planIds.length} linked {acceptingPeriod.planIds.length === 1 ? 'plan' : 'plans'}{' '}
          as an open enrollment.
        </div>
      ) : stalePeriod ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning-200 bg-warning-50 dark:bg-warning-950/20 p-4 text-sm text-warning-800 dark:text-warning-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{stalePeriod.name}</strong> ended on {formatDate(stalePeriod.endDate)} but is still marked open. It no
            longer accepts enrollments; use a new hire, life event or admin enrollment instead.
          </span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shownPlans.map((plan) => (
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
                <div className="flex items-center justify-between gap-3 text-secondary">
                  <span className="whitespace-nowrap">Who's covered:</span>
                  <strong className="text-primary font-semibold text-right">{dependentRuleSummary(plan)}</strong>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-base">
                <div className="flex items-center gap-1.5 text-xs text-secondary">
                  <Users className="h-4 w-4 text-muted" />
                  <span>
                    <strong>{plan.enrolledCount}</strong> enrolled
                    {plan.dependentCount > 0 && (
                      <> · <strong>{plan.dependentCount}</strong> {dependentNoun(plan, plan.dependentCount !== 1)}</>
                    )}
                  </span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    routerNavigate(plan.enrolledCount ? `${enrollmentsPath}?plan=${plan.id}` : enrollmentsPath)
                  }
                >
                  {plan.enrolledCount ? 'View enrollments' : 'Enroll employees'}
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {shownPlans.length === 0 && (
        <div className="text-center text-sm text-secondary py-12">
          No benefit plans configured for this company yet.{' '}
          <button
            type="button"
            className="text-accent-600 hover:underline"
            onClick={() => routerNavigate(pathForPage('benefit-plans'))}
          >
            Create one
          </button>
          .
        </div>
      )}
    </div>
  );
}
