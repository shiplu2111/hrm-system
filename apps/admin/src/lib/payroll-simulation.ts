import type {
  PayComponentRecord,
  PayrollAttendanceOverride,
  PayrollCalculationLine,
  PayrollCalculationPreview,
  PayrollSalaryStructureOverride,
  PayrollSimulationRequest,
  SalaryPayBasis,
} from '@hrm/shared-types';
import { MONEY_PATTERN } from './payroll-copy';
import { toCents } from './payroll-run-flow';

export interface LineEdit {
  value: string;
  remove: boolean;
}

export interface AddedLine {
  key: string;
  componentId: string;
  value: string;
  payBasis: SalaryPayBasis;
}

export interface AttendanceDraft {
  daysWorked: string;
  workedHours: string;
  unpaidDays: string;
}

export interface SimulationDraft {
  /** Keyed by salary structure id of the employee's real rows. */
  edits: Record<string, LineEdit>;
  added: AddedLine[];
  attendance: AttendanceDraft;
}

export type ValueKind = 'amount' | 'rate_day' | 'rate_hour' | 'percentage' | 'formula';

export const emptyDraft = (): SimulationDraft => ({
  edits: {},
  added: [],
  attendance: { daysWorked: '', workedHours: '', unpaidDays: '' },
});

const SIMULATED_PREFIX = 'simulated-';
const PERCENT_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;
const UNITS_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

export const isHypotheticalLine = (line: PayrollCalculationLine) => line.salaryStructureId.startsWith(SIMULATED_PREFIX);

export function lineKind(line: Pick<PayrollCalculationLine, 'calculationType' | 'payBasis'>): ValueKind {
  if (line.calculationType === 'percentage') return 'percentage';
  if (line.calculationType === 'formula') return 'formula';
  if (line.payBasis === 'daily') return 'rate_day';
  if (line.payBasis === 'hourly') return 'rate_hour';
  return 'amount';
}

export function componentKind(component: PayComponentRecord, payBasis: SalaryPayBasis): ValueKind {
  return lineKind({ calculationType: component.calculationType, payBasis });
}

/** The configured value a line was calculated from, as the user would type it. */
export function currentValue(line: PayrollCalculationLine): string | null {
  switch (lineKind(line)) {
    case 'percentage':
      return line.percentage === null ? null : String(line.percentage);
    case 'rate_day':
    case 'rate_hour':
      return line.rate ?? null;
    case 'formula':
      return null;
    default:
      return line.amount;
  }
}

function valueError(kind: ValueKind, value: string): 'money' | 'percentage' | null {
  if (kind === 'formula' || value === '') return null;
  if (kind === 'percentage') return PERCENT_PATTERN.test(value) && Number(value) <= 100 ? null : 'percentage';
  return MONEY_PATTERN.test(value) ? null : 'money';
}

export type DraftErrors = Record<string, 'money' | 'percentage' | 'required' | 'days' | 'hours'>;

export const editKey = (salaryStructureId: string) => `edit:${salaryStructureId}`;
export const addedKey = (key: string) => `added:${key}`;
export const attendanceKey = (field: keyof AttendanceDraft) => `attendance:${field}`;

export function validateDraft(
  draft: SimulationDraft,
  lines: PayrollCalculationLine[],
  components: PayComponentRecord[],
): DraftErrors {
  const errors: DraftErrors = {};
  for (const line of lines) {
    const edit = draft.edits[line.salaryStructureId];
    if (!edit || edit.remove) continue;
    const error = valueError(lineKind(line), edit.value.trim());
    if (error) errors[editKey(line.salaryStructureId)] = error;
  }
  for (const added of draft.added) {
    const component = components.find((c) => c.id === added.componentId);
    if (!component) continue;
    const kind = componentKind(component, added.payBasis);
    const value = added.value.trim();
    const error = kind !== 'formula' && value === '' ? 'required' : valueError(kind, value);
    if (error) errors[addedKey(added.key)] = error;
  }
  const units = (field: keyof AttendanceDraft, max: number, error: 'days' | 'hours') => {
    const value = draft.attendance[field].trim();
    if (value !== '' && !(UNITS_PATTERN.test(value) && Number(value) <= max)) errors[attendanceKey(field)] = error;
  };
  units('daysWorked', 31, 'days');
  units('unpaidDays', 31, 'days');
  units('workedHours', 744, 'hours');
  return errors;
}

export function buildRequest(
  draft: SimulationDraft,
  lines: PayrollCalculationLine[],
  components: PayComponentRecord[],
  asOf: string,
): PayrollSimulationRequest {
  const overrides: PayrollSalaryStructureOverride[] = [];
  for (const line of lines) {
    const edit = draft.edits[line.salaryStructureId];
    if (!edit) continue;
    if (edit.remove) {
      overrides.push({ salaryStructureId: line.salaryStructureId, remove: true });
      continue;
    }
    const value = edit.value.trim();
    const kind = lineKind(line);
    if (value === '' || kind === 'formula') continue;
    overrides.push(
      kind === 'percentage'
        ? { salaryStructureId: line.salaryStructureId, percentage: Number(value) }
        : { salaryStructureId: line.salaryStructureId, amount: value },
    );
  }
  for (const added of draft.added) {
    const component = components.find((c) => c.id === added.componentId);
    if (!component) continue;
    const kind = componentKind(component, added.payBasis);
    const value = added.value.trim();
    overrides.push({
      componentId: component.id,
      ...(kind === 'percentage' ? { percentage: Number(value) } : {}),
      ...(kind !== 'percentage' && kind !== 'formula' ? { amount: value, payBasis: added.payBasis } : {}),
    });
  }

  const attendance: PayrollAttendanceOverride = {};
  for (const field of ['daysWorked', 'workedHours', 'unpaidDays'] as const) {
    const value = draft.attendance[field].trim();
    if (value !== '') attendance[field] = value;
  }

  return {
    asOf,
    ...(overrides.length > 0 ? { structureOverrides: overrides } : {}),
    ...(Object.keys(attendance).length > 0 ? { attendance } : {}),
  };
}

export function changeCount(draft: SimulationDraft, lines: PayrollCalculationLine[]): number {
  const edits = lines.filter((line) => {
    const edit = draft.edits[line.salaryStructureId];
    return edit && (edit.remove || (edit.value.trim() !== '' && lineKind(line) !== 'formula'));
  }).length;
  const attendance = Object.values(draft.attendance).filter((value) => value.trim() !== '').length;
  return edits + draft.added.length + attendance;
}

export interface LineComparison {
  key: string;
  name: string;
  type: 'earning' | 'deduction';
  current: string | null;
  projected: string | null;
  diffCents: number;
  status: 'same' | 'changed' | 'added' | 'removed';
}

export function compareLines(baseline: PayrollCalculationPreview, simulated: PayrollCalculationPreview): LineComparison[] {
  const rows: LineComparison[] = [];
  for (const type of ['earning', 'deduction'] as const) {
    const before = type === 'earning' ? baseline.earnings : baseline.deductions;
    const after = type === 'earning' ? simulated.earnings : simulated.deductions;
    const keys = [...new Set([...before, ...after].map((line) => line.salaryStructureId))];
    for (const key of keys) {
      const current = before.find((line) => line.salaryStructureId === key) ?? null;
      const projected = after.find((line) => line.salaryStructureId === key) ?? null;
      const diffCents = toCents(projected?.amount ?? '0') - toCents(current?.amount ?? '0');
      rows.push({
        key,
        name: (projected ?? current)?.componentName ?? key,
        type,
        current: current?.amount ?? null,
        projected: projected?.amount ?? null,
        diffCents,
        status: !current ? 'added' : !projected ? 'removed' : diffCents !== 0 ? 'changed' : 'same',
      });
    }
  }
  return rows;
}

let addedSeq = 0;
export const nextAddedKey = () => `a${(addedSeq += 1)}`;
