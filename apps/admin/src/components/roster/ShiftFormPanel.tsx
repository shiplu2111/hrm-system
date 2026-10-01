import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Info, Plus, X } from 'lucide-react';
import {
  SHIFT_TYPES,
  computeShiftDuration,
  type OvertimeRuleRecord,
  type ShiftRecord,
  type ShiftType,
} from '@hrm/shared-types';
import { SidePanel } from '@/components/ui/SidePanel';
import { Button } from '@/components/ui/Button';
import { FieldError } from '@/components/ui/FieldError';
import { Input, Label, Select } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { OrgErrorBanner } from '@/components/org/OrgScreenParts';
import { PolicySection } from '@/components/leave/LeavePolicyFields';
import { ShiftTimeline } from '@/components/roster/ShiftTimeline';
import { useOrgForm } from '@/hooks/useOrgForm';
import { createOtRule, createShift, updateShift } from '@/lib/roster-api';
import {
  SHIFT_PALETTE,
  SHIFT_TYPE_META,
  WEEKDAY_SHORT,
  defaultOtRuleValues,
  defaultShiftValues,
  formValuesToOtRuleInput,
  formValuesToShiftInput,
  formatMinutes,
  otRuleSummary,
  shiftToFormValues,
  validateOtRuleValues,
  validateShiftValues,
  type OtRuleFormValues,
  type ShiftColor,
  type ShiftFormValues,
} from '@/lib/shift-roster';
import { ApiError } from '@/lib/tenant-api-client';

export type ShiftPanelMode =
  | { kind: 'create' }
  | { kind: 'duplicate'; source: ShiftRecord }
  | { kind: 'edit'; shift: ShiftRecord };

function initialValues(mode: ShiftPanelMode): ShiftFormValues {
  if (mode.kind === 'create') return defaultShiftValues();
  if (mode.kind === 'edit') return shiftToFormValues(mode.shift);
  return { ...shiftToFormValues(mode.source), name: `${mode.source.name} (copy)` };
}

function MinutesInput({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  invalid: boolean;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-invalid={invalid}
        placeholder={placeholder}
        className="pr-12"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
        min
      </span>
    </div>
  );
}

function Hint({ error, children }: { error?: string; children: ReactNode }) {
  return error ? <FieldError message={error} /> : <p className="mt-1 text-xs text-muted">{children}</p>;
}

function OtRuleCreator({
  companyId,
  takenNames,
  onCreated,
  onCancel,
}: {
  companyId: string;
  takenNames: string[];
  onCreated: (rule: OvertimeRuleRecord) => void;
  onCancel: () => void;
}) {
  const validate = useCallback(
    (v: OtRuleFormValues) => validateOtRuleValues(v, takenNames),
    [takenNames],
  );
  const form = useOrgForm<OtRuleFormValues>(defaultOtRuleValues(), validate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    form.touchAll();
    if (!form.isValid) return;
    setSaving(true);
    setError(null);
    try {
      onCreated(await createOtRule(companyId, formValuesToOtRuleInput(form.values)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the overtime rule');
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof OtRuleFormValues, label: string, suffix: string, placeholder?: string) => (
    <div>
      <Label htmlFor={`ot-${key}`}>{label}</Label>
      <div className="relative">
        <Input
          id={`ot-${key}`}
          inputMode="decimal"
          value={form.values[key] as string}
          onChange={(e) => form.setField(key, e.target.value)}
          onBlur={() => form.touch(key)}
          aria-invalid={Boolean(form.showError(key))}
          placeholder={placeholder}
          className="pr-10"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
          {suffix}
        </span>
      </div>
      <FieldError message={form.showError(key)} />
    </div>
  );

  return (
    <div
      className="rounded-lg border border-accent-200 dark:border-accent-800 bg-accent-50/40 dark:bg-accent-950/20 p-4 space-y-4"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
          e.preventDefault();
          void save();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-primary">New overtime rule</p>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel new overtime rule"
          className="text-muted hover:text-primary rounded p-0.5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error ? <OrgErrorBanner message={error} /> : null}
      <div>
        <Label htmlFor="ot-name">Rule name *</Label>
        <Input
          id="ot-name"
          value={form.values.name}
          onChange={(e) => form.setField('name', e.target.value)}
          onBlur={() => form.touch('name')}
          aria-invalid={Boolean(form.showError('name'))}
          placeholder="Standard overtime"
        />
        <FieldError message={form.showError('name')} />
      </div>
      <div>
        <Label>Overtime starts</Label>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['shift', 'After the shift’s hours'],
              ['custom', 'After a set number of hours'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => form.setField('thresholdMode', value)}
              aria-pressed={form.values.thresholdMode === value}
              className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                form.values.thresholdMode === value
                  ? 'border-accent-500 bg-accent-50 text-accent-800 dark:bg-accent-950/40 dark:text-accent-200'
                  : 'border-base text-secondary hover:border-strong'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {form.values.thresholdMode === 'custom'
          ? field('thresholdHours', 'Hours before overtime', 'h')
          : null}
        {field('maxDailyHours', 'Max overtime per day', 'h', 'No cap')}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {field('weekday', 'Weekday rate *', '×')}
        {field('weekend', 'Weekend rate', '×', 'Same')}
        {field('publicHoliday', 'Holiday rate', '×', 'Same')}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? 'Creating…' : 'Create rule'}
        </Button>
      </div>
    </div>
  );
}

export function ShiftFormPanel({
  open,
  mode,
  companyId,
  shifts,
  otRules,
  color,
  onOtRuleCreated,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: ShiftPanelMode;
  companyId: string;
  shifts: ShiftRecord[];
  otRules: OvertimeRuleRecord[] | null;
  /** Colour of the shift being edited; new shifts preview the next palette colour. */
  color?: ShiftColor;
  onOtRuleCreated: (rule: OvertimeRuleRecord) => void;
  onClose: () => void;
  onSaved: (shift: ShiftRecord) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creatingOtRule, setCreatingOtRule] = useState(false);

  const editingId = mode.kind === 'edit' ? mode.shift.id : null;
  const takenNames = useMemo(
    () => shifts.filter((s) => s.id !== editingId).map((s) => s.name),
    [shifts, editingId],
  );
  const validate = useCallback(
    (values: ShiftFormValues) => validateShiftValues(values, takenNames),
    [takenNames],
  );
  const form = useOrgForm<ShiftFormValues>(initialValues(mode), validate);
  const { reset } = form;

  useEffect(() => {
    if (!open) return;
    reset(initialValues(mode));
    setError(null);
    setCreatingOtRule(false);
  }, [open, mode, reset]);

  const values = form.values;
  const breakMinutes = Number(values.breakMinutes) || 0;
  const duration = computeShiftDuration(values.startTime, values.endTime, breakMinutes);
  const previewColor = color ?? SHIFT_PALETTE[shifts.length % SHIFT_PALETTE.length];
  const suggestOvernight =
    duration?.crossesMidnight && (values.shiftType === 'fixed' || values.shiftType === 'flexible');

  const companyRules = (otRules ?? []).filter((r) => r.scope === 'company');
  const countryRules = (otRules ?? []).filter((r) => r.scope === 'country');
  const selectedRule = (otRules ?? []).find((r) => r.id === values.otRuleId) ?? null;
  const missingRule = values.otRuleId && otRules !== null && !selectedRule;

  const toggleWeekendDay = (day: number) =>
    form.setField(
      'weekendDays',
      values.weekendDays.includes(day)
        ? values.weekendDays.filter((d) => d !== day)
        : [...values.weekendDays, day],
    );

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    form.touchAll();
    if (!form.isValid) return;
    setSaving(true);
    setError(null);
    try {
      const input = formValuesToShiftInput(values);
      const saved =
        mode.kind === 'edit'
          ? await updateShift(companyId, mode.shift.id, input)
          : await createShift(companyId, input);
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the shift');
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode.kind === 'edit' ? `Edit shift — ${mode.shift.name}` : mode.kind === 'duplicate' ? 'Duplicate shift' : 'Add shift';

  return (
    <SidePanel
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={title}
      description={mode.kind === 'edit' ? undefined : 'Working window, attendance rules and overtime.'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="shift-form" disabled={saving || creatingOtRule}>
            {saving ? 'Saving…' : mode.kind === 'edit' ? 'Save changes' : 'Create shift'}
          </Button>
        </>
      }
    >
      <form id="shift-form" onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-7">
        {error ? <OrgErrorBanner message={error} /> : null}
        {mode.kind === 'edit' && (mode.shift.assignmentCount ?? 0) > 0 ? (
          <div className="flex items-start gap-2 text-xs text-warning-700 dark:text-warning-300 bg-warning-50 dark:bg-warning-900/30 border border-warning-200 dark:border-warning-800/60 rounded-lg px-3 py-2.5">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              This shift is rostered on {mode.shift.assignmentCount} day
              {mode.shift.assignmentCount === 1 ? '' : 's'}. Timing changes apply to attendance
              calculated from now on; past attendance records keep their results.
            </span>
          </div>
        ) : null}

        <PolicySection title="Shift">
          <div>
            <Label htmlFor="shift-name">Name *</Label>
            <Input
              id="shift-name"
              autoFocus={mode.kind !== 'edit'}
              value={values.name}
              onChange={(e) => form.setField('name', e.target.value)}
              onBlur={() => form.touch('name')}
              aria-invalid={Boolean(form.showError('name'))}
              placeholder="Morning shift"
            />
            <FieldError message={form.showError('name')} />
          </div>
          <div>
            <Label htmlFor="shift-type">Shift type</Label>
            <Select
              id="shift-type"
              value={values.shiftType}
              onChange={(e) => form.setField('shiftType', e.target.value as ShiftType)}
            >
              {SHIFT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SHIFT_TYPE_META[t].label} — {SHIFT_TYPE_META[t].hint}
                </option>
              ))}
            </Select>
            {suggestOvernight ? (
              <p className="mt-1 text-xs text-muted">
                This shift ends the next day.{' '}
                <button
                  type="button"
                  className="text-accent-700 dark:text-accent-300 hover:underline"
                  onClick={() => form.setField('shiftType', 'overnight')}
                >
                  Mark it as Overnight
                </button>
              </p>
            ) : null}
          </div>
        </PolicySection>

        <PolicySection
          title="Working window"
          description="An end time at or before the start time finishes on the following day."
        >
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="shift-start">Start *</Label>
              <Input
                id="shift-start"
                type="time"
                value={values.startTime}
                onChange={(e) => form.setField('startTime', e.target.value)}
                onBlur={() => form.touch('startTime')}
                aria-invalid={Boolean(form.showError('startTime'))}
              />
              <FieldError message={form.showError('startTime')} />
            </div>
            <div>
              <Label htmlFor="shift-end">End *</Label>
              <Input
                id="shift-end"
                type="time"
                value={values.endTime}
                onChange={(e) => form.setField('endTime', e.target.value)}
                onBlur={() => form.touch('endTime')}
                aria-invalid={Boolean(form.showError('endTime'))}
              />
              <FieldError message={form.showError('endTime')} />
            </div>
            <div>
              <Label htmlFor="shift-break">Unpaid break</Label>
              <MinutesInput
                id="shift-break"
                value={values.breakMinutes}
                onChange={(v) => form.setField('breakMinutes', v)}
                onBlur={() => form.touch('breakMinutes')}
                invalid={Boolean(form.showError('breakMinutes'))}
              />
              <FieldError message={form.showError('breakMinutes')} />
            </div>
          </div>
          <ShiftTimeline
            startTime={values.startTime}
            endTime={values.endTime}
            breakMinutes={breakMinutes}
            color={previewColor}
          />
        </PolicySection>

        <PolicySection
          title="Attendance rules"
          description="How clock-ins and clock-outs against this shift are judged."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="shift-grace">Late grace period</Label>
              <MinutesInput
                id="shift-grace"
                value={values.graceMinutes}
                onChange={(v) => form.setField('graceMinutes', v)}
                onBlur={() => form.touch('graceMinutes')}
                invalid={Boolean(form.showError('graceMinutes'))}
              />
              <Hint error={form.showError('graceMinutes')}>
                {values.startTime && Number(values.graceMinutes) > 0 && !form.errors.graceMinutes
                  ? `Clock-ins after ${addMinutesToTime(values.startTime, Number(values.graceMinutes))} are late.`
                  : 'Clock-ins after the start time are late.'}
              </Hint>
            </div>
            <div>
              <Label htmlFor="shift-halfday">Half day when late by</Label>
              <MinutesInput
                id="shift-halfday"
                value={values.halfDayAfterMinutes}
                onChange={(v) => form.setField('halfDayAfterMinutes', v)}
                onBlur={() => form.touch('halfDayAfterMinutes')}
                invalid={Boolean(form.showError('halfDayAfterMinutes'))}
                placeholder="Never"
              />
              <Hint error={form.showError('halfDayAfterMinutes')}>Leave blank to never mark a half day.</Hint>
            </div>
            <div>
              <Label htmlFor="shift-early">Early-leave allowance</Label>
              <MinutesInput
                id="shift-early"
                value={values.earlyLeaveGraceMinutes}
                onChange={(v) => form.setField('earlyLeaveGraceMinutes', v)}
                onBlur={() => form.touch('earlyLeaveGraceMinutes')}
                invalid={Boolean(form.showError('earlyLeaveGraceMinutes'))}
                placeholder="0"
              />
              <Hint error={form.showError('earlyLeaveGraceMinutes')}>
                Leaving this close to the end is not flagged.
              </Hint>
            </div>
            <div>
              <Label htmlFor="shift-minimum">Minimum hours for a full day</Label>
              <div className="relative">
                <Input
                  id="shift-minimum"
                  inputMode="decimal"
                  value={values.minimumHours}
                  onChange={(e) => form.setField('minimumHours', e.target.value)}
                  onBlur={() => form.touch('minimumHours')}
                  aria-invalid={Boolean(form.showError('minimumHours'))}
                  placeholder={duration ? String(Number((duration.netMinutes / 60).toFixed(2))) : ''}
                  className="pr-10"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                  h
                </span>
              </div>
              <Hint error={form.showError('minimumHours')}>
                {duration
                  ? `Blank = the full ${formatMinutes(duration.netMinutes)} net shift.`
                  : 'Blank = the full net shift.'}
              </Hint>
            </div>
          </div>
        </PolicySection>

        <PolicySection title="Weekends" description="Days this shift treats as the weekend.">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekend days">
            {WEEKDAY_SHORT.map((label, day) => {
              const on = values.weekendDays.includes(day);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleWeekendDay(day)}
                  aria-pressed={on}
                  className={`h-8 w-12 rounded-lg border text-xs font-medium transition-colors ${
                    on
                      ? 'border-accent-500 bg-accent-600 text-white'
                      : 'border-base text-secondary hover:border-strong'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border border-base px-4 py-3">
            <div>
              <p className="text-sm font-medium text-primary">Rostered on weekends</p>
              <p className="text-xs text-muted mt-0.5">
                When off, bulk roster assignment skips this shift’s weekend days.
              </p>
            </div>
            <Toggle
              checked={values.worksWeekends}
              onChange={(v) => form.setField('worksWeekends', v)}
              label="Rostered on weekends"
            />
          </div>
        </PolicySection>

        <PolicySection
          title="Overtime"
          description="Which overtime rule payroll applies to hours worked beyond this shift."
        >
          <div>
            <Label htmlFor="shift-ot">Overtime rule</Label>
            <div className="flex gap-2">
              <Select
                id="shift-ot"
                value={values.otRuleId}
                onChange={(e) => form.setField('otRuleId', e.target.value)}
                disabled={otRules === null}
              >
                <option value="">No overtime</option>
                {companyRules.length > 0 ? (
                  <optgroup label="Company rules">
                    {companyRules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {countryRules.length > 0 ? (
                  <optgroup label="Country defaults">
                    {countryRules.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {missingRule ? <option value={values.otRuleId}>Rule no longer in effect</option> : null}
              </Select>
              {!creatingOtRule && otRules !== null ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCreatingOtRule(true)}
                  className="shrink-0"
                >
                  <Plus className="h-4 w-4" /> New rule
                </Button>
              ) : null}
            </div>
            {otRules === null ? (
              <p className="mt-1 text-xs text-muted">Overtime rules could not be loaded.</p>
            ) : selectedRule ? (
              <p className="mt-1 text-xs text-secondary">Overtime {otRuleSummary(selectedRule)}.</p>
            ) : missingRule ? (
              <p className="mt-1 text-xs text-warning-700 dark:text-warning-300">
                The linked rule has ended. Pick a current rule or “No overtime”.
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted">Extra hours are not paid as overtime.</p>
            )}
          </div>
          {creatingOtRule ? (
            <OtRuleCreator
              companyId={companyId}
              takenNames={companyRules.map((r) => r.name)}
              onCancel={() => setCreatingOtRule(false)}
              onCreated={(rule) => {
                onOtRuleCreated(rule);
                form.setField('otRuleId', rule.id);
                setCreatingOtRule(false);
              }}
            />
          ) : null}
        </PolicySection>
      </form>
    </SidePanel>
  );
}

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = (h * 60 + m + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
