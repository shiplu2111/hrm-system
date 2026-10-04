import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Info, Loader2, Pencil, Plus, Power } from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import type {
  BenefitDependentRelationship,
  BenefitPlanCategory,
  BenefitPlanRecord,
} from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Modal } from '@/components/ui/Modal';
import { StatusPill, type StatusPillTone } from '@/components/ui/StatusPill';
import { Toggle } from '@/components/ui/Toggle';
import { CompanySelector } from '@/components/org/CompanySelector';
import { OrgPageState } from '@/components/org/OrgPageState';
import { pathForPage } from '@/config/routes';
import {
  BENEFIT_CATEGORY_LABELS,
  BENEFIT_PLAN_STATUS_LABELS,
  createBenefitPlan,
  DEPENDENT_RELATIONSHIP_LABELS,
  listBenefitPlans,
  updateBenefitPlan,
  type BenefitPlanInput,
} from '@/lib/benefits-api';
import {
  dependentNoun,
  dependentRuleSummary,
  employerCostText,
  isLifePlan,
  RELATIONSHIP_ORDER,
} from '@/lib/benefits-display';
import { formatMoney, MONEY_PATTERN } from '@/lib/payroll-copy';
import { ApiError } from '@/lib/tenant-api-client';

const thClass = 'text-left px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';
const numThClass = 'text-right px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider';

const CATEGORY_ORDER: BenefitPlanCategory[] = [
  'health_insurance',
  'life_insurance',
  'dental_vision',
  'wellness',
  'other',
];

const STATUS_TONES: Record<BenefitPlanRecord['status'], StatusPillTone> = {
  draft: 'warning',
  active: 'success',
  inactive: 'neutral',
};

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

function PlansContent({ companyId }: { companyId: string }) {
  const routerNavigate = useNavigate();
  const { can } = usePermissions();
  const canCreate = can('payroll', 'create');
  const canEdit = can('payroll', 'edit');

  const [plans, setPlans] = useState<BenefitPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [category, setCategory] = useState<BenefitPlanCategory | 'all'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<BenefitPlanRecord | 'new' | null>(null);
  const [statusChange, setStatusChange] = useState<BenefitPlanRecord | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPlans(await listBenefitPlans(companyId));
    } catch (err) {
      setError(errorText(err, 'Failed to load benefit plans'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const statusVisible = useMemo(
    () => plans.filter((p) => showInactive || p.status !== 'inactive'),
    [plans, showInactive],
  );
  const visible = useMemo(
    () => statusVisible.filter((p) => category === 'all' || p.category === category),
    [statusVisible, category],
  );
  const inactiveCount = plans.filter((p) => p.status === 'inactive').length;
  const categoryCount = (c: BenefitPlanCategory) => statusVisible.filter((p) => p.category === c).length;

  const applyStatusChange = async () => {
    if (!statusChange) return;
    const next = statusChange.status === 'active' ? 'inactive' : 'active';
    setStatusBusy(true);
    setError(null);
    try {
      const updated = await updateBenefitPlan(statusChange.id, { status: next });
      setNotice(`${updated.name} ${next === 'active' ? 'is now active' : 'deactivated'}.`);
      setStatusChange(null);
      await load();
    } catch (err) {
      setStatusChange(null);
      setError(errorText(err, 'Could not change the plan status'));
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-secondary">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading benefit plans…
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
          <h1 className="text-xl font-bold text-primary">Benefit Plans</h1>
          <p className="text-sm text-secondary mt-0.5">
            Health, life and other insurance plans employees can enroll in, what they cost, and who they can cover.
          </p>
        </div>
        {canCreate ? (
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> New plan
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="rounded-lg border border-success-200 bg-success-50 dark:bg-success-950/30 px-4 py-3 text-sm text-success-700 dark:text-success-300">
          {notice}
        </div>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          Costs are monthly. Employees can only be enrolled in active plans; deactivating a plan stops new enrollments
          but keeps existing coverage until it is cancelled. Payroll does not yet deduct employee contributions, so
          the costs here are for reference and reporting.
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Plan category">
          <CategoryTab active={category === 'all'} onClick={() => setCategory('all')} label="All" count={statusVisible.length} />
          {CATEGORY_ORDER.map((c) => (
            <CategoryTab
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
              label={BENEFIT_CATEGORY_LABELS[c]}
              count={categoryCount(c)}
            />
          ))}
        </div>
        {inactiveCount ? (
          <label className="inline-flex items-center gap-2 text-sm text-secondary whitespace-nowrap">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-base"
            />
            Show inactive ({inactiveCount})
          </label>
        ) : null}
      </div>

      <Card>
        <CardBody className="p-0">
          {visible.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-primary">
                {plans.length === 0 ? 'No benefit plans yet' : 'No plans in this view'}
              </p>
              <p className="mt-1 text-sm text-secondary">
                {plans.length === 0
                  ? 'Create a health or life insurance plan, then enroll employees from Benefit Enrollments.'
                  : 'Pick another category or show inactive plans.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                    <th className={thClass}>Plan</th>
                    <th className={numThClass}>Monthly cost</th>
                    <th className={thClass}>Who's covered</th>
                    <th className={numThClass}>Enrolled</th>
                    <th className={thClass}>Status</th>
                    {canEdit ? <th className="px-4 py-2.5" /> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgb(var(--border-base))]">
                  {visible.map((plan) => (
                    <tr key={plan.id} className={plan.status === 'inactive' ? 'opacity-60' : undefined}>
                      <td className="px-4 py-3 min-w-[240px]">
                        <div className="font-medium text-primary">{plan.name}</div>
                        <div className="text-xs text-muted">
                          {category === 'all' ? `${BENEFIT_CATEGORY_LABELS[plan.category]} · ` : ''}
                          {plan.provider} · {plan.planTier}
                        </div>
                        {plan.coverageLimitLabel ? (
                          <div className="text-xs text-muted">Coverage {plan.coverageLimitLabel}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="text-primary">
                          <span className="text-xs text-muted">Employee </span>
                          {formatMoney(plan.employeeContributionAmount)}
                        </div>
                        <div className="text-secondary">
                          <span className="text-xs text-muted">Employer </span>
                          {employerCostText(plan)}
                        </div>
                        {plan.dependentContributionAmount ? (
                          <div className="text-xs text-muted">
                            +{formatMoney(plan.dependentContributionAmount)} per {dependentNoun(plan)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-secondary min-w-[160px]">{dependentRuleSummary(plan)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          className="text-accent-600 hover:underline disabled:text-muted disabled:no-underline"
                          disabled={plan.enrolledCount === 0}
                          onClick={() => routerNavigate(`${pathForPage('benefit-enrollments')}?plan=${plan.id}`)}
                        >
                          {plan.enrolledCount}
                        </button>
                        {plan.dependentCount ? (
                          <div className="text-xs text-muted">
                            {plan.dependentCount} {dependentNoun(plan, plan.dependentCount !== 1)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <StatusPill tone={STATUS_TONES[plan.status]}>
                            {BENEFIT_PLAN_STATUS_LABELS[plan.status]}
                          </StatusPill>
                          {plan.inOpenEnrollment ? (
                            <StatusPill tone="accent">In open enrollment</StatusPill>
                          ) : null}
                        </div>
                      </td>
                      {canEdit ? (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1 whitespace-nowrap">
                            <Button variant="ghost" size="sm" onClick={() => setEditing(plan)}>
                              <Pencil className="h-3.5 w-3.5" /> Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setStatusChange(plan)}
                              title={plan.status === 'active' ? 'Deactivate' : 'Activate'}
                              aria-label={`${plan.status === 'active' ? 'Deactivate' : 'Activate'} ${plan.name}`}
                            >
                              <Power className={`h-4 w-4 ${plan.status === 'active' ? '' : 'text-success-600'}`} />
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <PlanModal
        companyId={companyId}
        plan={editing}
        onClose={() => setEditing(null)}
        onSaved={async (saved, created) => {
          setEditing(null);
          setNotice(`${saved.name} ${created ? 'created' : 'saved'}.`);
          await load();
        }}
      />

      <Modal
        open={statusChange !== null}
        onClose={() => !statusBusy && setStatusChange(null)}
        size="sm"
        title={
          statusChange?.status === 'active'
            ? `Deactivate ${statusChange.name}?`
            : `Activate ${statusChange?.name ?? ''}?`
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusChange(null)} disabled={statusBusy}>
              Back
            </Button>
            <Button
              variant={statusChange?.status === 'active' ? 'danger' : 'primary'}
              onClick={() => void applyStatusChange()}
              disabled={statusBusy}
            >
              {statusBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {statusChange?.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-secondary">
          {statusChange?.status === 'active'
            ? `No one new can enroll in this plan. ${
                statusChange.enrolledCount
                  ? `${statusChange.enrolledCount} ${statusChange.enrolledCount === 1 ? 'employee stays' : 'employees stay'} covered until their enrollment is cancelled.`
                  : 'Nobody is enrolled in it right now.'
              }${statusChange.inOpenEnrollment ? ' It will no longer be offered in the current open enrollment.' : ''}`
            : 'Employees can be enrolled in this plan from today.'}
        </p>
      </Modal>
    </div>
  );
}

function CategoryTab({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
        active
          ? 'bg-accent-600 text-white'
          : 'surface border border-base text-secondary hover:text-primary hover:border-strong'
      }`}
    >
      {label}
      <span className={`text-xs ${active ? 'text-white/80' : 'text-muted'}`}>{count}</span>
    </button>
  );
}

function parseMoney(raw: string, required: boolean): { value: number | null; error: string | null } {
  const text = raw.trim();
  if (!text) return { value: null, error: required ? 'Enter an amount (0 if the employee pays nothing).' : null };
  if (!MONEY_PATTERN.test(text)) return { value: null, error: 'Use a positive amount with at most two decimals.' };
  return { value: Number(text), error: null };
}

function PlanModal({
  companyId,
  plan,
  onClose,
  onSaved,
}: {
  companyId: string;
  plan: BenefitPlanRecord | 'new' | null;
  onClose: () => void;
  onSaved: (saved: BenefitPlanRecord, created: boolean) => void | Promise<void>;
}) {
  const existing = plan && plan !== 'new' ? plan : null;
  const [name, setName] = useState('');
  const [category, setCategory] = useState<BenefitPlanCategory>('health_insurance');
  const [provider, setProvider] = useState('');
  const [planTier, setPlanTier] = useState('');
  const [description, setDescription] = useState('');
  const [coverageLimitLabel, setCoverageLimitLabel] = useState('');
  const [employerAmount, setEmployerAmount] = useState('');
  const [employeeAmount, setEmployeeAmount] = useState('');
  const [employerLabel, setEmployerLabel] = useState('');
  const [employeeLabel, setEmployeeLabel] = useState('');
  const [allowsDependents, setAllowsDependents] = useState(true);
  const [maxDependents, setMaxDependents] = useState('');
  const [eligible, setEligible] = useState<BenefitDependentRelationship[]>([]);
  const [dependentAmount, setDependentAmount] = useState('');
  const [status, setStatus] = useState<'draft' | 'active'>('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!plan) return;
    setName(existing?.name ?? '');
    setCategory(existing?.category ?? 'health_insurance');
    setProvider(existing?.provider ?? '');
    setPlanTier(existing?.planTier ?? '');
    setDescription(existing?.description ?? '');
    setCoverageLimitLabel(existing?.coverageLimitLabel ?? '');
    setEmployerAmount(existing?.employerContributionAmount != null ? String(existing.employerContributionAmount) : '');
    setEmployeeAmount(existing ? String(existing.employeeContributionAmount) : '');
    setEmployerLabel(existing?.employerContributionLabel ?? '');
    setEmployeeLabel(existing?.employeeContributionLabel ?? '');
    setAllowsDependents(existing?.allowsDependents ?? true);
    setMaxDependents(existing?.maxDependents != null ? String(existing.maxDependents) : '');
    setEligible(existing?.eligibleRelationships ?? []);
    setDependentAmount(
      existing?.dependentContributionAmount != null ? String(existing.dependentContributionAmount) : '',
    );
    setStatus('active');
    setError(null);
    setSaving(false);
  }, [plan, existing]);

  const life = isLifePlan({ category });
  const noun = dependentNoun({ category }, true);
  const categoryLocked = Boolean(existing?.hasEnrollments);
  const employer = parseMoney(employerAmount, false);
  const employee = parseMoney(employeeAmount, true);
  const perDependent = parseMoney(dependentAmount, false);
  const maxText = maxDependents.trim();
  const maxValue = maxText ? Number(maxText) : null;
  const maxError =
    maxText && (!/^\d+$/.test(maxText) || maxValue! < 1 || maxValue! > 20)
      ? 'Enter a whole number from 1 to 20, or leave blank for no maximum.'
      : null;

  const toggleRelationship = (r: BenefitDependentRelationship) =>
    setEligible((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const save = async () => {
    if (!name.trim() || !provider.trim() || !planTier.trim()) {
      setError('Enter the plan name, provider and tier.');
      return;
    }
    const problem =
      employer.error ?? employee.error ?? (allowsDependents ? (maxError ?? (life ? null : perDependent.error)) : null);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    const input: BenefitPlanInput = {
      name: name.trim(),
      category,
      provider: provider.trim(),
      planTier: planTier.trim(),
      description: description.trim() || null,
      employerContributionAmount: employer.value,
      employerContributionLabel: employerLabel.trim() || null,
      employeeContributionAmount: employee.value ?? 0,
      employeeContributionLabel: employeeLabel.trim() || null,
      coverageLimitLabel: coverageLimitLabel.trim() || null,
      allowsDependents,
      maxDependents: allowsDependents ? maxValue : null,
      eligibleRelationships: allowsDependents ? eligible : [],
      dependentContributionAmount: allowsDependents && !life ? perDependent.value : null,
      status,
    };
    try {
      let saved: BenefitPlanRecord;
      if (existing) {
        const changes: Partial<BenefitPlanInput> = { ...input };
        delete changes.status;
        if (categoryLocked) delete changes.category;
        saved = await updateBenefitPlan(existing.id, changes);
      } else {
        saved = await createBenefitPlan(companyId, input);
      }
      await onSaved(saved, !existing);
    } catch (err) {
      setError(errorText(err, 'Could not save the plan'));
      setSaving(false);
    }
  };

  return (
    <Modal
      open={plan !== null}
      onClose={() => !saving && onClose()}
      size="lg"
      title={existing ? `Edit ${existing.name}` : 'New benefit plan'}
      description={existing ? undefined : 'Employees can be enrolled once the plan is active.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {existing ? 'Save changes' : status === 'active' ? 'Create and activate' : 'Save as draft'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="plan-name">Plan name *</Label>
              <Input
                id="plan-name"
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Comprehensive Health & Dental"
              />
            </div>
            <div>
              <Label htmlFor="plan-category">Category *</Label>
              <Select
                id="plan-category"
                value={category}
                disabled={categoryLocked}
                onChange={(e) => setCategory(e.target.value as BenefitPlanCategory)}
              >
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {BENEFIT_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
              {categoryLocked ? (
                <p className="mt-1 text-xs text-muted">Locked because employees have been enrolled.</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="plan-tier">Tier *</Label>
              <Input
                id="plan-tier"
                maxLength={40}
                value={planTier}
                onChange={(e) => setPlanTier(e.target.value)}
                placeholder="e.g. Gold, Basic, 2× salary"
              />
            </div>
            <div>
              <Label htmlFor="plan-provider">Provider *</Label>
              <Input
                id="plan-provider"
                maxLength={120}
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="e.g. Medibank, MetLife"
              />
            </div>
            <div>
              <Label htmlFor="plan-coverage">Coverage</Label>
              <Input
                id="plan-coverage"
                maxLength={80}
                value={coverageLimitLabel}
                onChange={(e) => setCoverageLimitLabel(e.target.value)}
                placeholder={life ? 'e.g. 3× annual salary' : 'e.g. $50,000 per year'}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="plan-description">Description</Label>
              <Textarea
                id="plan-description"
                rows={2}
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What the plan covers, waiting periods, exclusions"
              />
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-primary">Monthly cost per employee</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="plan-employee">Employee pays *</Label>
              <Input
                id="plan-employee"
                inputMode="decimal"
                value={employeeAmount}
                onChange={(e) => setEmployeeAmount(e.target.value)}
                placeholder="0.00"
              />
              {employee.error && employeeAmount ? <p className="mt-1 text-xs text-error-600">{employee.error}</p> : null}
            </div>
            <div>
              <Label htmlFor="plan-employer">Employer pays</Label>
              <Input
                id="plan-employer"
                inputMode="decimal"
                value={employerAmount}
                onChange={(e) => setEmployerAmount(e.target.value)}
                placeholder="Not subsidised"
              />
              {employer.error ? <p className="mt-1 text-xs text-error-600">{employer.error}</p> : null}
            </div>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer text-secondary hover:text-primary">Custom display text</summary>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="plan-employee-label">Employee cost label</Label>
                <Input
                  id="plan-employee-label"
                  maxLength={60}
                  value={employeeLabel}
                  onChange={(e) => setEmployeeLabel(e.target.value)}
                  placeholder="e.g. 15% of premium"
                />
              </div>
              <div>
                <Label htmlFor="plan-employer-label">Employer cost label</Label>
                <Input
                  id="plan-employer-label"
                  maxLength={60}
                  value={employerLabel}
                  onChange={(e) => setEmployerLabel(e.target.value)}
                  placeholder="e.g. 85% of premium"
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted">
              Shown on the benefits overview cards instead of the amounts. Costs are still calculated from the amounts.
            </p>
          </details>
        </section>

        <section className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-primary">{life ? 'Beneficiaries' : 'Dependent coverage'}</h3>
              <p className="text-xs text-muted mt-0.5">
                {life
                  ? 'People nominated to receive the payout. Their shares must add up to no more than 100%.'
                  : 'Family members the employee can add to their cover.'}
              </p>
            </div>
            <Toggle
              checked={allowsDependents}
              onChange={setAllowsDependents}
              label={life ? 'Allow beneficiaries' : 'Allow dependents'}
            />
          </div>
          {allowsDependents ? (
            <div className="space-y-4 rounded-lg border border-base p-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="plan-max">Maximum {noun}</Label>
                  <Input
                    id="plan-max"
                    inputMode="numeric"
                    value={maxDependents}
                    onChange={(e) => setMaxDependents(e.target.value)}
                    placeholder="No maximum"
                  />
                  {maxError ? <p className="mt-1 text-xs text-error-600">{maxError}</p> : null}
                </div>
                {!life ? (
                  <div>
                    <Label htmlFor="plan-dependent-cost">Extra employee cost per dependent</Label>
                    <Input
                      id="plan-dependent-cost"
                      inputMode="decimal"
                      value={dependentAmount}
                      onChange={(e) => setDependentAmount(e.target.value)}
                      placeholder="No extra cost"
                    />
                    {perDependent.error ? <p className="mt-1 text-xs text-error-600">{perDependent.error}</p> : null}
                  </div>
                ) : null}
              </div>
              <div>
                <Label>Who can be {life ? 'nominated' : 'covered'}</Label>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {RELATIONSHIP_ORDER.map((r) => (
                    <label key={r} className="inline-flex items-center gap-2 text-sm text-primary">
                      <input
                        type="checkbox"
                        checked={eligible.includes(r)}
                        onChange={() => toggleRelationship(r)}
                        className="h-4 w-4 rounded border-base"
                      />
                      {DEPENDENT_RELATIONSHIP_LABELS[r]}
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {eligible.length === 0 ? 'None ticked means any relationship is accepted.' : null}
                  {!life ? ' Only one spouse or domestic partner can be covered per enrollment.' : null}
                </p>
              </div>
            </div>
          ) : existing?.dependentCount ? (
            <p className="text-xs text-warning-700 dark:text-warning-300">
              {existing.dependentCount} {dependentNoun(existing, existing.dependentCount !== 1)} are covered today.
              Remove them from their enrollments before turning this off.
            </p>
          ) : null}
        </section>

        {!existing ? (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-primary">Status</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label className="inline-flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="plan-status"
                  checked={status === 'active'}
                  onChange={() => setStatus('active')}
                  className="mt-0.5"
                />
                <span>
                  <span className="text-primary">Active</span>
                  <span className="block text-xs text-muted">Employees can be enrolled straight away.</span>
                </span>
              </label>
              <label className="inline-flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="plan-status"
                  checked={status === 'draft'}
                  onChange={() => setStatus('draft')}
                  className="mt-0.5"
                />
                <span>
                  <span className="text-primary">Draft</span>
                  <span className="block text-xs text-muted">Finish the details and activate later.</span>
                </span>
              </label>
            </div>
          </section>
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

export function BenefitPlansPage() {
  return (
    <OrgPageState>
      {(companyId) => (
        <>
          <div className="px-4 lg:px-6 pt-4">
            <CompanySelector />
          </div>
          <PlansContent companyId={companyId} />
        </>
      )}
    </OrgPageState>
  );
}
