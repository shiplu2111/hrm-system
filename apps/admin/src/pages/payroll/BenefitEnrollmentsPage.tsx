import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  HeartPulse,
  Loader2,
  PiggyBank,
  Plus,
  Search,
  ShieldCheck,
  Smile,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type {
  BenefitDependentRelationship,
  BenefitEnrollmentRecord,
  BenefitEnrollmentType,
  BenefitOpenEnrollmentPeriodRecord,
  BenefitPlanCategory,
  BenefitPlanRecord,
  EmployeeRecord,
} from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatusPill, type StatusPillTone } from '@/components/ui/StatusPill';
import { Avatar } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { pathForPage } from '@/config/routes';
import { listEmployees } from '@/lib/employees-api';
import {
  addBenefitEnrollmentDependent,
  BENEFIT_CATEGORY_LABELS,
  cancelBenefitEnrollment,
  createBenefitEnrollment,
  DEPENDENT_RELATIONSHIP_LABELS,
  ENROLLMENT_STATUS_LABELS,
  ENROLLMENT_TYPE_LABELS,
  listBenefitEnrollments,
  listBenefitOpenEnrollments,
  listBenefitPlans,
  removeBenefitEnrollmentDependent,
} from '@/lib/benefits-api';
import {
  activeDependents,
  beneficiaryShareTotal,
  dependentNoun,
  dependentRuleSummary,
  isLifePlan,
  matchRelationship,
  RELATIONSHIP_ORDER,
  relationshipAllowed,
} from '@/lib/benefits-display';
import { addDaysIso, formatDate, formatMoney, formatRate, MONEY_PATTERN, todayIso } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

type EnrolledFilter = 'all' | 'enrolled' | 'not_enrolled';

const ENROLLMENT_TONES: Record<BenefitEnrollmentRecord['status'], StatusPillTone> = {
  pending: 'warning',
  active: 'success',
  cancelled: 'neutral',
  terminated: 'neutral',
};

const NEW_HIRE_WINDOW_DAYS = 31;

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function PlanIcon({ category }: { category?: BenefitPlanCategory }) {
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

function ageOn(dateOfBirth: string, today: string): number {
  const [by, bm, bd] = dateOfBirth.slice(0, 10).split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(`${toIso.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${fromIso.slice(0, 10)}T00:00:00Z`).getTime()) /
      86_400_000,
  );
}

function sharePercentError(raw: string): string | null {
  const text = raw.trim();
  if (!text) return 'Enter a share.';
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return 'Use a percentage with at most two decimals.';
  const n = Number(text);
  if (n <= 0 || n > 100) return 'A share must be above 0% and at most 100%.';
  return null;
}

function EnrollmentsContent({ companyId }: { companyId: string }) {
  const routerNavigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = usePermissions();
  const canCreate = can('payroll', 'create');
  const canEdit = can('payroll', 'edit');

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [plans, setPlans] = useState<BenefitPlanRecord[]>([]);
  const [periods, setPeriods] = useState<BenefitOpenEnrollmentPeriodRecord[]>([]);
  const [enrollments, setEnrollments] = useState<BenefitEnrollmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [enrolledFilter, setEnrolledFilter] = useState<EnrolledFilter>('all');

  const selectedId = searchParams.get('employee');
  const planFilterId = searchParams.get('plan');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [employeeRows, planRows, periodRows, enrollmentRows] = await Promise.all([
        listEmployees(companyId),
        listBenefitPlans(companyId),
        listBenefitOpenEnrollments(companyId),
        listBenefitEnrollments(companyId),
      ]);
      setEmployees(employeeRows);
      setPlans(planRows);
      setPeriods(periodRows);
      setEnrollments(enrollmentRows);
    } catch (err) {
      setError(errorText(err, 'Failed to load benefit enrollments'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const setParam = (key: 'employee' | 'plan', value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: key === 'plan' });
  };

  const enrollmentsByEmployee = useMemo(() => {
    const map = new Map<string, BenefitEnrollmentRecord[]>();
    for (const row of enrollments) {
      const list = map.get(row.employeeId) ?? [];
      list.push(row);
      map.set(row.employeeId, list);
    }
    return map;
  }, [enrollments]);

  const planFilter = plans.find((p) => p.id === planFilterId) ?? null;

  const listed = useMemo(() => {
    const term = search.trim().toLowerCase();
    return employees
      .map((employee) => {
        const rows = enrollmentsByEmployee.get(employee.id) ?? [];
        return { employee, rows, active: rows.filter((r) => r.status === 'active') };
      })
      .filter(({ employee, rows }) => employee.employmentStatus !== 'terminated' || rows.length > 0)
      .filter(({ active }) => {
        if (enrolledFilter === 'enrolled') return active.length > 0;
        if (enrolledFilter === 'not_enrolled') return active.length === 0;
        return true;
      })
      .filter(({ active }) => !planFilterId || active.some((r) => r.benefitPlanId === planFilterId))
      .filter(
        ({ employee }) =>
          !term ||
          employee.fullName.toLowerCase().includes(term) ||
          employee.employeeNumber.toLowerCase().includes(term),
      )
      .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName));
  }, [employees, enrollmentsByEmployee, enrolledFilter, planFilterId, search]);

  const enrolledEmployeeCount = useMemo(
    () => new Set(enrollments.filter((r) => r.status === 'active').map((r) => r.employeeId)).size,
    [enrollments],
  );

  const selected = employees.find((e) => e.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading benefit enrollments…
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-[1400px] mx-auto">
      <button
        type="button"
        onClick={() => routerNavigate(pathForPage('benefits'))}
        className="inline-flex items-center gap-1.5 text-sm text-secondary hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Benefits
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Benefit Enrollments</h1>
          <p className="text-sm text-secondary mt-0.5">
            Each employee's health, life and other cover, the family members it includes, and what it costs.
          </p>
        </div>
        <Button variant="secondary" onClick={() => routerNavigate(pathForPage('benefit-plans'))}>
          Manage plans
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-4 py-3 text-sm text-success-700 dark:text-success-300">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="self-start">
          <CardBody className="p-0">
            <div className="space-y-3 border-b border-base p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-primary">Employees</span>
                <span className="text-xs text-muted">{enrolledEmployeeCount} enrolled</span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name or ID…"
                  className="pl-9"
                  aria-label="Search employees"
                />
              </div>
              <Select
                value={enrolledFilter}
                onChange={(e) => setEnrolledFilter(e.target.value as EnrolledFilter)}
                aria-label="Enrollment filter"
              >
                <option value="all">All employees</option>
                <option value="enrolled">Enrolled in a plan</option>
                <option value="not_enrolled">Not enrolled</option>
              </Select>
              {planFilter ? (
                <div className="flex items-center justify-between gap-2 rounded-md bg-accent-50 px-2.5 py-1.5 text-xs text-accent-700 dark:bg-accent-950/40 dark:text-accent-300">
                  <span className="truncate">Enrolled in {planFilter.name}</span>
                  <button type="button" onClick={() => setParam('plan', null)} aria-label="Clear plan filter">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
            <div className="max-h-[calc(100vh-330px)] min-h-[200px] overflow-y-auto scrollbar-thin">
              {listed.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-secondary">No employees match.</p>
              ) : (
                <ul className="divide-y divide-[rgb(var(--border-base))]">
                  {listed.map(({ employee, active }) => (
                    <li key={employee.id}>
                      <button
                        type="button"
                        onClick={() => setParam('employee', employee.id)}
                        className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          employee.id === selectedId
                            ? 'bg-accent-50 dark:bg-accent-950/30'
                            : 'hover:bg-[rgb(var(--bg-hover))]'
                        }`}
                      >
                        <Avatar name={employee.fullName} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-primary">{employee.fullName}</div>
                          <div className="truncate text-xs text-muted">
                            {employee.employeeNumber}
                            {employee.department?.name ? ` · ${employee.department.name}` : ''}
                          </div>
                        </div>
                        {employee.employmentStatus === 'terminated' ? (
                          <span className="text-xs text-muted">Terminated</span>
                        ) : active.length ? (
                          <span className="rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700 dark:bg-success-900/30 dark:text-success-300">
                            {active.length} {active.length === 1 ? 'plan' : 'plans'}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">None</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>

        {selected ? (
          <EmployeeBenefits
            key={selected.id}
            employee={selected}
            enrollments={enrollmentsByEmployee.get(selected.id) ?? []}
            plans={plans}
            periods={periods}
            canCreate={canCreate}
            canEdit={canEdit}
            onChanged={async (message) => {
              setNotice(message);
              await load();
            }}
          />
        ) : (
          <Card>
            <CardBody className="flex min-h-[320px] flex-col items-center justify-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-50 dark:bg-accent-950/40">
                <Users className="h-6 w-6 text-accent-600 dark:text-accent-400" />
              </div>
              <p className="text-sm font-medium text-primary">Select an employee</p>
              <p className="mt-1 max-w-sm text-sm text-secondary">
                Pick someone from the list to see their cover, add family members, or enroll them in a plan.
              </p>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function EmployeeBenefits({
  employee,
  enrollments,
  plans,
  periods,
  canCreate,
  canEdit,
  onChanged,
}: {
  employee: EmployeeRecord;
  enrollments: BenefitEnrollmentRecord[];
  plans: BenefitPlanRecord[];
  periods: BenefitOpenEnrollmentPeriodRecord[];
  canCreate: boolean;
  canEdit: boolean;
  onChanged: (message: string) => Promise<void>;
}) {
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [cancelling, setCancelling] = useState<BenefitEnrollmentRecord | null>(null);
  const [removing, setRemoving] = useState<{
    enrollment: BenefitEnrollmentRecord;
    dependentId: string;
    name: string;
  } | null>(null);

  const active = enrollments.filter((e) => e.status === 'active' || e.status === 'pending');
  const history = enrollments.filter((e) => e.status === 'cancelled' || e.status === 'terminated');
  const terminated = employee.employmentStatus === 'terminated';
  const planById = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  const enrollablePlans = plans.filter(
    (p) => p.status === 'active' && !active.some((e) => e.benefitPlanId === p.id),
  );

  const employeeCost = active.reduce((sum, e) => sum + e.monthlyEmployeeCost, 0);
  const employerCost = active.reduce((sum, e) => sum + (e.monthlyEmployerCost ?? 0), 0);
  const coveredCount = active
    .filter((e) => !isLifePlan({ category: e.benefitPlanCategory }))
    .reduce((sum, e) => sum + activeDependents(e).length, 0);

  const enrollDisabledReason = terminated
    ? 'Terminated employees cannot be enrolled.'
    : enrollablePlans.length === 0
      ? plans.some((p) => p.status === 'active')
        ? 'Already enrolled in every active plan.'
        : 'There are no active plans to enroll in.'
      : null;

  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={employee.fullName} size="lg" />
            <div className="min-w-0">
              <div className="text-base font-semibold text-primary truncate">{employee.fullName}</div>
              <div className="text-xs text-muted">
                {employee.employeeNumber}
                {employee.designation?.name ? ` · ${employee.designation.name}` : ''}
                {employee.department?.name ? ` · ${employee.department.name}` : ''} · Hired{' '}
                {formatDate(employee.hireDate)}
              </div>
            </div>
          </div>
          {canCreate ? (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button variant="primary" onClick={() => setEnrollOpen(true)} disabled={Boolean(enrollDisabledReason)}>
                <UserPlus className="h-4 w-4" /> Enroll in a plan
              </Button>
              {enrollDisabledReason ? <span className="text-xs text-muted">{enrollDisabledReason}</span> : null}
            </div>
          ) : null}
        </CardBody>
      </Card>

      {active.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Figure label="Employee pays" value={`${formatMoney(employeeCost)} / mo`} />
          <Figure label="Employer pays" value={`${formatMoney(employerCost)} / mo`} />
          <Figure
            label="Family members covered"
            value={String(coveredCount)}
            hint={coveredCount === 1 ? 'dependent' : 'dependents'}
          />
        </div>
      ) : null}

      {active.length === 0 ? (
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-sm font-medium text-primary">Not enrolled in any plan</p>
            <p className="mt-1 text-sm text-secondary">
              {terminated
                ? 'This employee has left the company.'
                : 'Use “Enroll in a plan” to add health, life or other cover.'}
            </p>
          </CardBody>
        </Card>
      ) : (
        active.map((enrollment) => (
          <EnrollmentCard
            key={enrollment.id}
            enrollment={enrollment}
            plan={planById.get(enrollment.benefitPlanId) ?? null}
            canCreate={canCreate}
            canEdit={canEdit}
            onCancel={() => setCancelling(enrollment)}
            onRemoveDependent={(dependentId, name) => setRemoving({ enrollment, dependentId, name })}
            onChanged={onChanged}
          />
        ))
      )}

      {history.length ? (
        <Card>
          <CardBody className="p-0">
            <div className="border-b border-base px-4 py-3 text-sm font-semibold text-primary">Past enrollments</div>
            <ul className="divide-y divide-[rgb(var(--border-base))]">
              {history.map((e) => (
                <li key={e.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-primary">{e.benefitPlanName ?? 'Plan'}</div>
                    <div className="text-xs text-muted">
                      {formatDate(e.effectiveFrom)} – {formatDate(e.effectiveTo)} · {ENROLLMENT_TYPE_LABELS[e.enrollmentType]}
                      {e.notes ? ` · ${e.notes}` : ''}
                    </div>
                  </div>
                  <StatusPill tone={ENROLLMENT_TONES[e.status]}>{ENROLLMENT_STATUS_LABELS[e.status]}</StatusPill>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <EnrollModal
        open={enrollOpen}
        employee={employee}
        plans={enrollablePlans}
        periods={periods}
        onClose={() => setEnrollOpen(false)}
        onEnrolled={async (record) => {
          setEnrollOpen(false);
          await onChanged(`${employee.fullName} enrolled in ${record.benefitPlanName ?? 'the plan'}.`);
        }}
      />

      <CancelEnrollmentModal
        enrollment={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={async (record) => {
          setCancelling(null);
          await onChanged(
            `${record.benefitPlanName ?? 'Coverage'} for ${employee.fullName} ends on ${formatDate(record.effectiveTo)}.`,
          );
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? ''}?`}
        confirmLabel="Remove"
        description={
          removing
            ? `${removing.name} will no longer be ${
                isLifePlan({ category: removing.enrollment.benefitPlanCategory })
                  ? 'a beneficiary of'
                  : 'covered by'
              } ${removing.enrollment.benefitPlanName ?? 'this plan'}. The record is kept in the audit log.`
            : null
        }
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return;
          await removeBenefitEnrollmentDependent(removing.enrollment.id, removing.dependentId);
          await onChanged(`${removing.name} removed from ${removing.enrollment.benefitPlanName ?? 'the plan'}.`);
        }}
      />
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface rounded-xl border border-base p-3">
      <div className="text-xs text-secondary">{label}</div>
      <div className="mt-0.5 text-lg font-semibold text-primary">
        {value} {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
      </div>
    </div>
  );
}

function EnrollmentCard({
  enrollment,
  plan,
  canCreate,
  canEdit,
  onCancel,
  onRemoveDependent,
  onChanged,
}: {
  enrollment: BenefitEnrollmentRecord;
  plan: BenefitPlanRecord | null;
  canCreate: boolean;
  canEdit: boolean;
  onCancel: () => void;
  onRemoveDependent: (dependentId: string, name: string) => void;
  onChanged: (message: string) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const life = isLifePlan({ category: enrollment.benefitPlanCategory });
  const deps = activeDependents(enrollment);
  const shareTotal = beneficiaryShareTotal(deps);
  const today = todayIso();
  const perDependent = plan?.dependentContributionAmount ?? 0;
  const baseCost = enrollment.employeeContributionAmount ?? 0;

  const addBlockedReason = !plan
    ? null
    : !plan.allowsDependents
      ? `${plan.name} doesn't cover ${dependentNoun(plan, true)}.`
      : plan.maxDependents != null && deps.length >= plan.maxDependents
        ? `The plan covers at most ${plan.maxDependents} ${dependentNoun(plan, plan.maxDependents !== 1)}.`
        : life && shareTotal >= 100
          ? 'Beneficiary shares already add up to 100%.'
          : null;

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--bg-muted))]">
              <PlanIcon category={enrollment.benefitPlanCategory} />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-primary">{enrollment.benefitPlanName}</span>
                <StatusPill tone={ENROLLMENT_TONES[enrollment.status]}>
                  {ENROLLMENT_STATUS_LABELS[enrollment.status]}
                </StatusPill>
                {plan?.status === 'inactive' ? <StatusPill tone="neutral">Plan inactive</StatusPill> : null}
              </div>
              <div className="text-xs text-muted mt-0.5">
                {enrollment.benefitPlanProvider} · {enrollment.benefitPlanTier} ·{' '}
                {enrollment.benefitPlanCategory ? BENEFIT_CATEGORY_LABELS[enrollment.benefitPlanCategory] : ''}
              </div>
              <div className="text-xs text-secondary mt-1">
                {enrollment.effectiveFrom > today ? 'Starts' : 'Since'} {formatDate(enrollment.effectiveFrom)}
                {enrollment.effectiveTo ? ` until ${formatDate(enrollment.effectiveTo)}` : ''} ·{' '}
                {ENROLLMENT_TYPE_LABELS[enrollment.enrollmentType]}
              </div>
            </div>
          </div>
          {canEdit ? (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel coverage
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-lg bg-[rgb(var(--bg-muted))] px-4 py-3 text-sm sm:grid-cols-2">
          <div>
            <div className="text-xs text-secondary">Employee pays</div>
            <div className="font-semibold text-primary">{formatMoney(enrollment.monthlyEmployeeCost)} / mo</div>
            {perDependent && deps.length ? (
              <div className="text-xs text-muted">
                {formatMoney(baseCost)} + {deps.length} × {formatMoney(perDependent)} per dependent
              </div>
            ) : null}
          </div>
          <div>
            <div className="text-xs text-secondary">Employer pays</div>
            <div className="font-semibold text-primary">
              {enrollment.monthlyEmployerCost != null ? `${formatMoney(enrollment.monthlyEmployerCost)} / mo` : '—'}
            </div>
          </div>
        </div>

        {enrollment.notes ? <p className="text-xs text-secondary">Notes: {enrollment.notes}</p> : null}

        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-primary">
              {life ? 'Beneficiaries' : 'Covered dependents'}
              {plan ? <span className="ml-2 text-xs font-normal text-muted">{dependentRuleSummary(plan)}</span> : null}
            </h4>
            {canCreate && !adding ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdding(true)}
                disabled={Boolean(addBlockedReason)}
                title={addBlockedReason ?? undefined}
              >
                <Plus className="h-3.5 w-3.5" /> Add {life ? 'beneficiary' : 'dependent'}
              </Button>
            ) : null}
          </div>

          {deps.length === 0 && !adding ? (
            <p className="text-sm text-secondary">
              {life
                ? 'No beneficiaries nominated yet.'
                : plan?.allowsDependents === false
                  ? 'This plan covers the employee only.'
                  : 'Employee only — no family members on this cover.'}
            </p>
          ) : deps.length ? (
            <div className="overflow-x-auto rounded-lg border border-base">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base text-left text-xs text-secondary">
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Relationship</th>
                    <th className="px-3 py-2 font-medium">Date of birth</th>
                    {life ? <th className="px-3 py-2 text-right font-medium">Share</th> : null}
                    {canEdit ? <th className="px-3 py-2" /> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {deps.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2 text-primary">{d.fullName}</td>
                      <td className="px-3 py-2 text-secondary">{DEPENDENT_RELATIONSHIP_LABELS[d.relationship]}</td>
                      <td className="px-3 py-2 text-secondary whitespace-nowrap">
                        {d.dateOfBirth ? `${formatDate(d.dateOfBirth)} (age ${ageOn(d.dateOfBirth, today)})` : '—'}
                      </td>
                      {life ? (
                        <td className="px-3 py-2 text-right text-primary">
                          {d.beneficiarySharePercent != null ? `${formatRate(d.beneficiarySharePercent)}%` : '—'}
                        </td>
                      ) : null}
                      {canEdit ? (
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => onRemoveDependent(d.id, d.fullName)}
                            className="inline-flex items-center gap-1 text-xs text-secondary hover:text-error-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {life && deps.length ? (
            <p
              className={`mt-2 text-xs ${
                shareTotal === 100 ? 'text-muted' : 'text-warning-700 dark:text-warning-300'
              }`}
            >
              Shares total {formatRate(shareTotal)}%
              {shareTotal < 100 ? ` — ${formatRate(Math.round((100 - shareTotal) * 100) / 100)}% of the payout is not assigned.` : '.'}
            </p>
          ) : null}

          {adding && plan ? (
            <AddDependentForm
              enrollment={enrollment}
              plan={plan}
              shareTotal={shareTotal}
              onClose={() => setAdding(false)}
              onAdded={async (name) => {
                setAdding(false);
                await onChanged(`${name} added to ${enrollment.benefitPlanName ?? 'the plan'}.`);
              }}
            />
          ) : null}
        </div>
      </CardBody>
    </Card>
  );
}

function AddDependentForm({
  enrollment,
  plan,
  shareTotal,
  onClose,
  onAdded,
}: {
  enrollment: BenefitEnrollmentRecord;
  plan: BenefitPlanRecord;
  shareTotal: number;
  onClose: () => void;
  onAdded: (name: string) => Promise<void>;
}) {
  const life = isLifePlan(plan);
  const options = RELATIONSHIP_ORDER.filter((r) => relationshipAllowed(plan, r));
  const remaining = Math.round((100 - shareTotal) * 100) / 100;
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState<BenefitDependentRelationship>(options[0] ?? 'other');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [share, setShare] = useState(life ? String(remaining) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!fullName.trim()) {
      setError('Enter their full name.');
      return;
    }
    if (dateOfBirth && dateOfBirth > todayIso()) {
      setError('The date of birth cannot be in the future.');
      return;
    }
    if (life) {
      const shareError = sharePercentError(share);
      if (shareError) {
        setError(shareError);
        return;
      }
      if (Number(share) > remaining) {
        setError(`Only ${formatRate(remaining)}% of the payout is left to assign.`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await addBenefitEnrollmentDependent(enrollment.id, {
        fullName: fullName.trim(),
        relationship,
        dateOfBirth: dateOfBirth || undefined,
        beneficiarySharePercent: life ? Number(share) : undefined,
      });
      await onAdded(fullName.trim());
    } catch (err) {
      setError(errorText(err, 'Could not add them'));
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-base p-3">
      <div className={`grid grid-cols-1 gap-3 ${life ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
        <div>
          <Label htmlFor={`dep-name-${enrollment.id}`}>Full name *</Label>
          <Input
            id={`dep-name-${enrollment.id}`}
            maxLength={120}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor={`dep-rel-${enrollment.id}`}>Relationship</Label>
          <Select
            id={`dep-rel-${enrollment.id}`}
            value={relationship}
            onChange={(e) => setRelationship(e.target.value as BenefitDependentRelationship)}
          >
            {options.map((r) => (
              <option key={r} value={r}>
                {DEPENDENT_RELATIONSHIP_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`dep-dob-${enrollment.id}`}>Date of birth</Label>
          <Input
            id={`dep-dob-${enrollment.id}`}
            type="date"
            max={todayIso()}
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
          />
        </div>
        {life ? (
          <div>
            <Label htmlFor={`dep-share-${enrollment.id}`}>Share (%) *</Label>
            <Input
              id={`dep-share-${enrollment.id}`}
              inputMode="decimal"
              value={share}
              onChange={(e) => setShare(e.target.value)}
            />
          </div>
        ) : null}
      </div>
      {!life && plan.dependentContributionAmount ? (
        <p className="text-xs text-muted">
          Adds {formatMoney(plan.dependentContributionAmount)} a month to the employee's cost.
        </p>
      ) : null}
      {error ? <p className="text-sm text-error-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" onClick={() => void submit()} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Add {life ? 'beneficiary' : 'dependent'}
        </Button>
      </div>
    </div>
  );
}

interface DependentRow {
  key: number;
  fullName: string;
  relationship: BenefitDependentRelationship;
  dateOfBirth: string;
  share: string;
}

function dependentRowsProblem(plan: BenefitPlanRecord, rows: DependentRow[], today: string): string | null {
  const life = isLifePlan(plan);
  const noun = dependentNoun(plan, true);
  if (plan.maxDependents != null && rows.length > plan.maxDependents) {
    return `${plan.name} covers at most ${plan.maxDependents} ${noun}.`;
  }
  const seen = new Set<string>();
  for (const row of rows) {
    const name = row.fullName.trim();
    if (!name) return `Enter a name for each ${dependentNoun(plan)}, or remove the empty row.`;
    const key = name.toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) return `${name} is listed twice.`;
    seen.add(key);
    if (!relationshipAllowed(plan, row.relationship)) {
      return `${plan.name} doesn't cover a ${DEPENDENT_RELATIONSHIP_LABELS[row.relationship].toLowerCase()}.`;
    }
    if (row.dateOfBirth && row.dateOfBirth > today) return `${name}'s date of birth cannot be in the future.`;
    if (life) {
      const shareError = sharePercentError(row.share);
      if (shareError) return `${name}: ${shareError}`;
    }
  }
  if (!life && rows.filter((r) => r.relationship === 'spouse' || r.relationship === 'domestic_partner').length > 1) {
    return 'Only one spouse or domestic partner can be covered.';
  }
  if (life) {
    const total = beneficiaryShareTotal(rows.map((r) => ({ beneficiarySharePercent: Number(r.share) || 0 })));
    if (total > 100) return `Beneficiary shares add up to ${formatRate(total)}%; the total cannot exceed 100%.`;
  }
  return null;
}

function EnrollModal({
  open,
  employee,
  plans,
  periods,
  onClose,
  onEnrolled,
}: {
  open: boolean;
  employee: EmployeeRecord;
  plans: BenefitPlanRecord[];
  periods: BenefitOpenEnrollmentPeriodRecord[];
  onClose: () => void;
  onEnrolled: (record: BenefitEnrollmentRecord) => Promise<void>;
}) {
  const today = todayIso();
  const hireDate = employee.hireDate.slice(0, 10);
  const recentHire = daysBetween(hireDate, today) <= NEW_HIRE_WINDOW_DAYS;
  const [planId, setPlanId] = useState('');
  const [enrollmentType, setEnrollmentType] = useState<BenefitEnrollmentType>('admin');
  const [effectiveFrom, setEffectiveFrom] = useState(today);
  const [contribution, setContribution] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<DependentRow[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = plans.find((p) => p.id === planId) ?? null;
  const life = plan ? isLifePlan(plan) : false;
  const openPeriod = plan
    ? (periods.find((p) => p.acceptingEnrollments && p.planIds.includes(plan.id)) ?? null)
    : null;
  const staleOpenPeriod = periods.find((p) => p.status === 'open' && !p.acceptingEnrollments && p.endDate < today);

  const selectPlan = (id: string) => {
    const next = plans.find((p) => p.id === id) ?? null;
    setPlanId(id);
    setContribution(next ? String(next.employeeContributionAmount) : '');
    setRows([]);
    setError(null);
    const period = next ? periods.find((p) => p.acceptingEnrollments && p.planIds.includes(next.id)) : null;
    setEnrollmentType(period ? 'open_enrollment' : recentHire ? 'new_hire' : 'admin');
    setEffectiveFrom(recentHire && !period ? hireDate : hireDate > today ? hireDate : today);
  };

  useEffect(() => {
    if (!open) return;
    setPlanId('');
    setEnrollmentType('admin');
    setEffectiveFrom(hireDate > today ? hireDate : today);
    setContribution('');
    setNotes('');
    setRows([]);
    setSaving(false);
    setError(null);
  }, [open, hireDate, today]);

  const options = plan ? RELATIONSHIP_ORDER.filter((r) => relationshipAllowed(plan, r)) : [];
  const canAddRow = Boolean(
    plan?.allowsDependents && (plan.maxDependents == null || rows.length < plan.maxDependents),
  );

  const addRow = (seed?: Partial<DependentRow>) => {
    if (!plan) return;
    const remaining = 100 - beneficiaryShareTotal(rows.map((r) => ({ beneficiarySharePercent: Number(r.share) || 0 })));
    setRows((cur) => [
      ...cur,
      {
        key: nextKey,
        fullName: '',
        relationship: options[0] ?? 'other',
        dateOfBirth: '',
        share: life ? String(Math.max(0, Math.round(remaining * 100) / 100)) : '',
        ...seed,
      },
    ]);
    setNextKey((k) => k + 1);
  };

  const updateRow = (key: number, patch: Partial<DependentRow>) =>
    setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const profileSuggestions = useMemo(() => {
    if (!plan?.allowsDependents) return [];
    const listed = new Set(rows.map((r) => r.fullName.trim().toLowerCase()));
    return (employee.personalInfo?.dependents ?? [])
      .filter((d) => d.name && !listed.has(d.name.trim().toLowerCase()))
      .map((d) => ({ ...d, relationship: matchRelationship(d.relationship) ?? 'other' }))
      .filter((d) => relationshipAllowed(plan, d.relationship));
  }, [employee.personalInfo, plan, rows]);

  const contributionValue = MONEY_PATTERN.test(contribution.trim()) ? Number(contribution) : null;
  const projectedCost =
    contributionValue != null ? contributionValue + rows.length * (plan?.dependentContributionAmount ?? 0) : null;
  const shareTotal = life
    ? beneficiaryShareTotal(rows.map((r) => ({ beneficiarySharePercent: Number(r.share) || 0 })))
    : 0;

  const submit = async () => {
    if (!plan) {
      setError('Choose a plan.');
      return;
    }
    if (!effectiveFrom) {
      setError('Choose when coverage starts.');
      return;
    }
    if (effectiveFrom < hireDate) {
      setError(`Coverage cannot start before the hire date (${formatDate(hireDate)}).`);
      return;
    }
    if (contributionValue == null) {
      setError('Enter the employee contribution with at most two decimals (0 if they pay nothing).');
      return;
    }
    if (enrollmentType === 'life_event' && !notes.trim()) {
      setError('Describe the life event, for example marriage or the birth of a child.');
      return;
    }
    const problem = dependentRowsProblem(plan, rows, today);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const record = await createBenefitEnrollment(employee.companyId, {
        employeeId: employee.id,
        benefitPlanId: plan.id,
        enrollmentType,
        openEnrollmentPeriodId: enrollmentType === 'open_enrollment' ? openPeriod?.id : undefined,
        effectiveFrom,
        employeeContributionAmount: contributionValue,
        notes: notes.trim() || undefined,
        dependents: rows.map((r) => ({
          fullName: r.fullName.trim(),
          relationship: r.relationship,
          dateOfBirth: r.dateOfBirth || undefined,
          beneficiarySharePercent: life ? Number(r.share) : undefined,
        })),
      });
      await onEnrolled(record);
    } catch (err) {
      setError(errorText(err, 'Enrollment failed'));
      setSaving(false);
    }
  };

  const typeOptions: Array<{ value: BenefitEnrollmentType; hint: string; disabled?: string }> = [
    {
      value: 'open_enrollment',
      hint: openPeriod ? `${openPeriod.name}, until ${formatDate(openPeriod.endDate)}` : '',
      disabled: openPeriod
        ? undefined
        : plan
          ? 'No open enrollment window is running for this plan.'
          : 'Choose a plan first.',
    },
    {
      value: 'new_hire',
      hint: `Hired ${formatDate(hireDate)}${recentHire ? '' : ' — more than a month ago'}`,
    },
    { value: 'life_event', hint: 'Marriage, a new child or another qualifying change' },
    { value: 'admin', hint: 'Any other change made by HR' },
  ];

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      size="lg"
      title={`Enroll ${employee.fullName}`}
      description="Choose a plan, when cover starts, and who else it covers."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={saving || !plan}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Enroll
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <Label htmlFor="enroll-plan">Plan *</Label>
          <Select id="enroll-plan" value={planId} onChange={(e) => selectPlan(e.target.value)}>
            <option value="">Choose a plan…</option>
            {(['health_insurance', 'life_insurance', 'dental_vision', 'wellness', 'other'] as const).map((c) => {
              const group = plans.filter((p) => p.category === c);
              return group.length ? (
                <optgroup key={c} label={BENEFIT_CATEGORY_LABELS[c]}>
                  {group.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.provider} ({p.planTier})
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
          </Select>
          {plan ? (
            <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 rounded-lg bg-[rgb(var(--bg-muted))] px-3 py-2 text-xs text-secondary sm:grid-cols-2">
              <span>
                Employee pays <strong className="text-primary">{formatMoney(plan.employeeContributionAmount)}</strong>{' '}
                / mo
                {plan.dependentContributionAmount
                  ? ` + ${formatMoney(plan.dependentContributionAmount)} per dependent`
                  : ''}
              </span>
              <span>
                Employer pays{' '}
                <strong className="text-primary">
                  {plan.employerContributionAmount != null ? formatMoney(plan.employerContributionAmount) : '—'}
                </strong>{' '}
                / mo
              </span>
              <span className="sm:col-span-2">
                {dependentRuleSummary(plan)}
                {plan.coverageLimitLabel ? ` · Coverage ${plan.coverageLimitLabel}` : ''}
              </span>
            </div>
          ) : null}
        </div>

        <div>
          <Label>Reason for enrollment *</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {typeOptions.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                  opt.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                } ${enrollmentType === opt.value ? 'border-accent-500 bg-accent-50/50 dark:bg-accent-950/20' : 'border-base'}`}
              >
                <input
                  type="radio"
                  name="enroll-type"
                  className="mt-0.5"
                  checked={enrollmentType === opt.value}
                  disabled={Boolean(opt.disabled)}
                  onChange={() => setEnrollmentType(opt.value)}
                />
                <span className="min-w-0">
                  <span className="text-primary">{ENROLLMENT_TYPE_LABELS[opt.value]}</span>
                  <span className="block text-xs text-muted">{opt.disabled ?? opt.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {staleOpenPeriod ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-warning-700 dark:text-warning-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {staleOpenPeriod.name} ended on {formatDate(staleOpenPeriod.endDate)} but has not been closed, so it no
              longer accepts enrollments.
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="enroll-from">Coverage starts *</Label>
            <Input
              id="enroll-from"
              type="date"
              min={hireDate}
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="enroll-contribution">Employee contribution / mo *</Label>
            <Input
              id="enroll-contribution"
              inputMode="decimal"
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              disabled={!plan}
            />
            {plan && contributionValue !== plan.employeeContributionAmount && contributionValue != null ? (
              <p className="mt-1 text-xs text-muted">
                Plan default is {formatMoney(plan.employeeContributionAmount)}.
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <Label htmlFor="enroll-notes">{enrollmentType === 'life_event' ? 'Life event *' : 'Notes'}</Label>
          <Textarea
            id="enroll-notes"
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={enrollmentType === 'life_event' ? 'e.g. Married on 12 Sep 2026' : 'Optional'}
          />
        </div>

        {plan ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-primary">{life ? 'Beneficiaries' : 'Dependents'}</h3>
                <p className="text-xs text-muted">
                  {plan.allowsDependents
                    ? dependentRuleSummary(plan)
                    : `${plan.name} covers the employee only.`}
                </p>
              </div>
              {canAddRow ? (
                <Button variant="outline" size="sm" onClick={() => addRow()}>
                  <Plus className="h-3.5 w-3.5" /> Add {life ? 'beneficiary' : 'dependent'}
                </Button>
              ) : null}
            </div>

            {profileSuggestions.length && canAddRow ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted">From the employee profile:</span>
                {profileSuggestions.map((d) => (
                  <button
                    key={d.name}
                    type="button"
                    onClick={() =>
                      addRow({
                        fullName: d.name,
                        relationship: d.relationship,
                        dateOfBirth: d.dateOfBirth?.slice(0, 10) ?? '',
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-base px-2.5 py-1 text-secondary hover:border-accent-500 hover:text-primary"
                  >
                    <Plus className="h-3 w-3" /> {d.name} ({DEPENDENT_RELATIONSHIP_LABELS[d.relationship].toLowerCase()})
                  </button>
                ))}
              </div>
            ) : null}

            {rows.map((row) => (
              <div
                key={row.key}
                className={`grid grid-cols-1 items-end gap-2 rounded-lg border border-base p-3 ${
                  life ? 'sm:grid-cols-[1.4fr_1fr_1fr_0.7fr_auto]' : 'sm:grid-cols-[1.4fr_1fr_1fr_auto]'
                }`}
              >
                <div>
                  <Label>Full name</Label>
                  <Input
                    maxLength={120}
                    value={row.fullName}
                    onChange={(e) => updateRow(row.key, { fullName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Relationship</Label>
                  <Select
                    value={row.relationship}
                    onChange={(e) =>
                      updateRow(row.key, { relationship: e.target.value as BenefitDependentRelationship })
                    }
                  >
                    {options.map((r) => (
                      <option key={r} value={r}>
                        {DEPENDENT_RELATIONSHIP_LABELS[r]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Date of birth</Label>
                  <Input
                    type="date"
                    max={today}
                    value={row.dateOfBirth}
                    onChange={(e) => updateRow(row.key, { dateOfBirth: e.target.value })}
                  />
                </div>
                {life ? (
                  <div>
                    <Label>Share %</Label>
                    <Input
                      inputMode="decimal"
                      value={row.share}
                      onChange={(e) => updateRow(row.key, { share: e.target.value })}
                    />
                  </div>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRows((cur) => cur.filter((r) => r.key !== row.key))}
                  aria-label="Remove row"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {life && rows.length ? (
              <p className={`text-xs ${shareTotal > 100 ? 'text-error-600' : shareTotal < 100 ? 'text-warning-700 dark:text-warning-300' : 'text-muted'}`}>
                Shares total {formatRate(shareTotal)}%
                {shareTotal < 100 ? ' — the rest of the payout is not assigned yet.' : shareTotal > 100 ? ' — reduce them to 100% or less.' : '.'}
              </p>
            ) : null}
          </div>
        ) : null}

        {plan && projectedCost != null ? (
          <div className="rounded-lg border border-base px-3 py-2 text-sm text-secondary">
            Employee will pay <strong className="text-primary">{formatMoney(projectedCost)}</strong> a month
            {rows.length && plan.dependentContributionAmount
              ? ` (${formatMoney(contributionValue)} + ${rows.length} × ${formatMoney(plan.dependentContributionAmount)})`
              : ''}
            . Payroll does not deduct this automatically yet.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg bg-error-50 dark:bg-error-950/40 px-3 py-2 text-sm text-error-700 dark:text-error-300">
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function CancelEnrollmentModal({
  enrollment,
  onClose,
  onCancelled,
}: {
  enrollment: BenefitEnrollmentRecord | null;
  onClose: () => void;
  onCancelled: (record: BenefitEnrollmentRecord) => Promise<void>;
}) {
  const today = todayIso();
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enrollment) return;
    const latest = enrollment.effectiveTo && enrollment.effectiveTo < today ? enrollment.effectiveTo : today;
    setEndDate(latest);
    setReason('');
    setSaving(false);
    setError(null);
  }, [enrollment, today]);

  if (!enrollment) return null;

  const notStarted = enrollment.effectiveFrom > today;
  const neverStarts = endDate < enrollment.effectiveFrom;
  const life = isLifePlan({ category: enrollment.benefitPlanCategory });
  const depCount = activeDependents(enrollment).length;

  const submit = async () => {
    if (!endDate) {
      setError('Choose the last day of cover.');
      return;
    }
    if (enrollment.effectiveTo && endDate > enrollment.effectiveTo) {
      setError(`Cover already ends on ${formatDate(enrollment.effectiveTo)}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const record = await cancelBenefitEnrollment(enrollment.id, {
        endDate,
        reason: reason.trim() || undefined,
      });
      await onCancelled(record);
    } catch (err) {
      setError(errorText(err, 'Could not cancel the enrollment'));
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      size="sm"
      title={`Cancel ${enrollment.benefitPlanName ?? 'coverage'}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Back
          </Button>
          <Button variant="danger" onClick={() => void submit()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Cancel coverage
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="cancel-end">Last day of cover</Label>
          <Input
            id="cancel-end"
            type="date"
            min={addDaysIso(enrollment.effectiveFrom, -1)}
            max={enrollment.effectiveTo ?? undefined}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted">
            {neverStarts || notStarted
              ? `Cover was due to start on ${formatDate(enrollment.effectiveFrom)}; cancelling before then means it never starts.`
              : depCount
                ? `Cover for ${depCount} ${life ? (depCount === 1 ? 'beneficiary' : 'beneficiaries') : depCount === 1 ? 'dependent' : 'dependents'} ends on the same day.`
                : 'The enrollment moves to past enrollments.'}
          </p>
        </div>
        <div>
          <Label htmlFor="cancel-reason">Reason</Label>
          <Textarea
            id="cancel-reason"
            rows={2}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Employee opted out, moved to partner's cover"
          />
        </div>
        {error ? <p className="text-sm text-error-600">{error}</p> : null}
      </div>
    </Modal>
  );
}

export function BenefitEnrollmentsPage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <EnrollmentsContent companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
