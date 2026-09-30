import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Info, Plus } from 'lucide-react';
import type { LeavePolicyRecord, LeaveTypeRecord } from '@hrm/shared-types';
import { SidePanel } from '@/components/ui/SidePanel';
import { Button } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { OrgErrorBanner } from '@/components/org/OrgScreenParts';
import {
  LeavePolicyFields,
  PolicySection,
  type LeavePolicyFieldsProps,
} from '@/components/leave/LeavePolicyFields';
import { useOrgForm, type FormErrors } from '@/hooks/useOrgForm';
import { createLeavePolicy, createLeaveType, updateLeavePolicy } from '@/lib/leave-api';
import {
  LEAVE_TYPE_PRESETS,
  addDaysIso,
  defaultPolicyValues,
  formValuesToPolicyInput,
  policyToFormValues,
  todayIso,
  validatePolicyValues,
  type LeavePolicyFormValues,
} from '@/lib/leave-policy';
import { ApiError } from '@/lib/tenant-api-client';

export type LeavePolicyPanelMode =
  | { kind: 'create-type' }
  | {
      kind: 'new-version';
      leaveType: LeaveTypeRecord;
      /** Version whose settings prefill the form. */
      basedOn: LeavePolicyRecord | null;
      /** Start date of the latest existing version; the new one must start after it. */
      latestEffectiveFrom: string | null;
    }
  | { kind: 'edit-version'; leaveType: LeaveTypeRecord; policy: LeavePolicyRecord };

type PanelValues = LeavePolicyFormValues & { name: string; isPaid: boolean };

function initialValues(mode: LeavePolicyPanelMode): PanelValues {
  switch (mode.kind) {
    case 'create-type':
      return { ...defaultPolicyValues(), name: '', isPaid: true };
    case 'new-version': {
      const earliest = mode.latestEffectiveFrom ? addDaysIso(mode.latestEffectiveFrom, 1) : todayIso();
      const effectiveFrom = earliest > todayIso() ? earliest : todayIso();
      const base = mode.basedOn ? policyToFormValues(mode.basedOn) : defaultPolicyValues();
      return {
        ...base,
        effectiveFrom,
        effectiveTo: '',
        name: mode.leaveType.name,
        isPaid: mode.leaveType.isPaid,
      };
    }
    case 'edit-version':
      return {
        ...policyToFormValues(mode.policy),
        name: mode.leaveType.name,
        isPaid: mode.leaveType.isPaid,
      };
  }
}

export function LeavePolicyPanel({
  open,
  mode,
  companyId,
  leaveTypes,
  roleNames,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: LeavePolicyPanelMode;
  companyId: string;
  leaveTypes: LeaveTypeRecord[];
  roleNames: string[];
  onClose: () => void;
  onSaved: (leaveTypeId: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set when the type was created but its first policy failed, so a retry only saves the policy. */
  const [createdType, setCreatedType] = useState<LeaveTypeRecord | null>(null);

  const needsTypeFields = mode.kind === 'create-type' && !createdType;

  const validate = useCallback(
    (values: PanelValues): FormErrors<PanelValues> => {
      const errors: FormErrors<PanelValues> = validatePolicyValues(values, {
        effectiveFromAfter:
          mode.kind === 'new-version' ? (mode.latestEffectiveFrom ?? undefined) : undefined,
      });
      if (needsTypeFields) {
        const name = values.name.trim();
        if (!name) errors.name = 'Name is required';
        else if (name.length > 100) errors.name = 'Name must be 100 characters or fewer';
        else if (leaveTypes.some((t) => t.name.trim().toLowerCase() === name.toLowerCase()))
          errors.name = `A leave type named "${name}" already exists`;
      }
      return errors;
    },
    [mode, needsTypeFields, leaveTypes],
  );

  const form = useOrgForm<PanelValues>(initialValues(mode), validate);
  const { reset } = form;

  useEffect(() => {
    if (!open) return;
    reset(initialValues(mode));
    setError(null);
    setCreatedType(null);
  }, [open, mode, reset]);

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    form.touchAll();
    if (!form.isValid) return;
    setSaving(true);
    setError(null);
    const input = formValuesToPolicyInput(form.values);
    let typeForRetry = createdType;
    try {
      if (mode.kind === 'edit-version') {
        await updateLeavePolicy(companyId, mode.policy.id, input);
        onSaved(mode.leaveType.id);
        return;
      }
      if (mode.kind === 'new-version') {
        await createLeavePolicy(companyId, { ...input, leaveTypeId: mode.leaveType.id });
        onSaved(mode.leaveType.id);
        return;
      }
      if (!typeForRetry) {
        typeForRetry = await createLeaveType(companyId, {
          name: form.values.name.trim(),
          isPaid: form.values.isPaid,
        });
        setCreatedType(typeForRetry);
      }
      await createLeavePolicy(companyId, { ...input, leaveTypeId: typeForRetry.id });
      onSaved(typeForRetry.id);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not save the policy';
      setError(
        mode.kind === 'create-type' && typeForRetry
          ? `“${typeForRetry.name}” was created, but its policy could not be saved: ${message}`
          : message,
      );
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode.kind === 'create-type'
      ? 'Add leave type'
      : mode.kind === 'new-version'
        ? `New policy version — ${mode.leaveType.name}`
        : `Edit policy version — ${mode.leaveType.name}`;

  const existingNames = new Set(leaveTypes.map((t) => t.name.toLowerCase()));
  const presets = LEAVE_TYPE_PRESETS.filter((p) => !existingNames.has(p.name.toLowerCase()));

  return (
    <SidePanel
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={title}
      description={
        mode.kind === 'create-type'
          ? 'Define the leave type and the policy that governs it.'
          : undefined
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="leave-policy-form" disabled={saving}>
            {saving
              ? 'Saving…'
              : mode.kind === 'create-type'
                ? createdType
                  ? 'Save policy'
                  : 'Create leave type'
                : mode.kind === 'new-version'
                  ? 'Create version'
                  : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="leave-policy-form" onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-7">
        {error ? <OrgErrorBanner message={error} /> : null}

        {mode.kind === 'new-version' ? (
          <div className="flex items-start gap-2 text-xs text-secondary bg-[rgb(var(--bg-muted))] rounded-lg px-3 py-2.5">
            <Info className="h-4 w-4 shrink-0 text-accent-600" />
            <span>
              The version in effect on the chosen date will end the day before, so earlier periods
              keep the rules that applied at the time.
            </span>
          </div>
        ) : null}
        {mode.kind === 'edit-version' ? (
          <div className="flex items-start gap-2 text-xs text-warning-700 dark:text-warning-300 bg-warning-50 dark:bg-warning-900/30 border border-warning-200 dark:border-warning-800/60 rounded-lg px-3 py-2.5">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              Edits correct this version in place, including for past dates it covers. To change
              the rules from a date onward, create a new version instead.
            </span>
          </div>
        ) : null}

        {needsTypeFields ? (
          <PolicySection title="Leave type">
            {presets.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Start from:</span>
                {presets.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      form.setField('name', p.name);
                      form.setField('isPaid', p.isPaid);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-base px-2.5 py-1 text-xs text-secondary hover:text-primary hover:border-accent-400 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    {p.name}
                  </button>
                ))}
              </div>
            ) : null}
            <div>
              <Label htmlFor="leave-type-name">Name *</Label>
              <Input
                id="leave-type-name"
                autoFocus
                value={form.values.name}
                onChange={(e) => form.setField('name', e.target.value)}
                onBlur={() => form.touch('name')}
                aria-invalid={Boolean(form.showError('name'))}
                placeholder="Annual Leave"
              />
              <FieldError message={form.showError('name')} />
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-base px-4 py-3">
              <div>
                <p className="text-sm font-medium text-primary">Paid leave</p>
                <p className="text-xs text-muted mt-0.5">
                  Unpaid leave is excluded from days worked and deducted in payroll.
                </p>
              </div>
              <Toggle
                checked={form.values.isPaid}
                onChange={(v) => form.setField('isPaid', v)}
                label="Paid leave"
              />
            </div>
          </PolicySection>
        ) : null}

        <LeavePolicyFields
          values={form.values}
          setField={form.setField as LeavePolicyFieldsProps['setField']}
          touch={form.touch}
          showError={form.showError}
          roleNames={roleNames}
          isPaid={form.values.isPaid}
        />
      </form>
    </SidePanel>
  );
}
