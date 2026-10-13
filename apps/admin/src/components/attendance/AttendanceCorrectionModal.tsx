import { useState, useEffect } from 'react';
import {
  Clock,
  Coffee,
  CheckCircle2,
  AlertCircle,
  Calendar,
  History,
  Pencil,
  Plus,
  Trash2,
  User,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import type { AttendanceDayRecord, EmployeeRecord } from '@hrm/shared-types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import {
  correctAttendance,
  getAttendanceCorrections,
  type AttendanceCorrectionRecord,
  type AttendanceCorrectionResponse,
} from '@/lib/attendance-api';
import { ApiError } from '@/lib/tenant-api-client';

export interface AttendanceCorrectionModalProps {
  open: boolean;
  onClose: () => void;
  record: AttendanceDayRecord | null;
  employee: EmployeeRecord | null;
  onSuccess: (response: AttendanceCorrectionResponse) => void;
}

interface BreakRow {
  id: string;
  startAt: string;
  endAt: string;
}

const PRESET_REASONS = [
  'Forgot to clock in/out',
  'Biometric device issue',
  'Outdoor duty / client meeting',
  'Approved late arrival / early leave',
  'Network / system glitch',
];

const STATUS_OPTIONS = [
  { value: '', label: 'Auto-calculate based on shift' },
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'early_leave', label: 'Early Leave' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'absent', label: 'Absent' },
  { value: 'wfh', label: 'Work From Home' },
  { value: 'business_trip', label: 'Business Trip' },
];

function isoToInput(isoString?: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  // format YYYY-MM-DDTHH:mm in local time
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function inputToIso(inputString: string): string | null {
  if (!inputString.trim()) return null;
  const d = new Date(inputString.trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function formatDisplayTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AttendanceCorrectionModal({
  open,
  onClose,
  record,
  employee,
  onSuccess,
}: AttendanceCorrectionModalProps) {
  const [activeTab, setActiveTab] = useState<'form' | 'history'>('form');
  const [clockInInput, setClockInInput] = useState('');
  const [clockOutInput, setClockOutInput] = useState('');
  const [statusOverride, setStatusOverride] = useState('');
  const [reason, setReason] = useState('');
  const [breaks, setBreaks] = useState<BreakRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audit history state
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<AttendanceCorrectionRecord[]>([]);

  useEffect(() => {
    if (open && record) {
      setActiveTab('form');
      setClockInInput(isoToInput(record.clockInAt));
      setClockOutInput(isoToInput(record.clockOutAt));
      setStatusOverride(record.status ?? '');
      setReason('');
      setError(null);

      const initialBreaks = (record.breaks ?? []).map((b, i) => ({
        id: b.id || `brk-${i}-${Date.now()}`,
        startAt: isoToInput(b.startAt),
        endAt: isoToInput(b.endAt),
      }));
      setBreaks(initialBreaks);

      if (employee?.id) {
        setHistoryLoading(true);
        void getAttendanceCorrections(employee.id, record.date)
          .then((rows) => setHistory(rows))
          .catch(() => setHistory([]))
          .finally(() => setHistoryLoading(false));
      }
    }
  }, [open, record, employee]);

  if (!open || !record || !employee) return null;

  const handleAddBreak = () => {
    const dateStr = record.date;
    const defaultStart = `${dateStr}T13:00`;
    const defaultEnd = `${dateStr}T13:30`;
    setBreaks((prev) => [
      ...prev,
      { id: `brk-${Date.now()}`, startAt: defaultStart, endAt: defaultEnd },
    ]);
  };

  const handleRemoveBreak = (id: string) => {
    setBreaks((prev) => prev.filter((b) => b.id !== id));
  };

  const handleBreakChange = (id: string, field: 'startAt' | 'endAt', value: string) => {
    setBreaks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b)),
    );
  };

  const setShiftStartClockIn = () => {
    if (record.shift?.startTime) {
      setClockInInput(`${record.date}T${record.shift.startTime}`);
    }
  };

  const setShiftEndClockOut = () => {
    if (record.shift?.endTime) {
      setClockOutInput(`${record.date}T${record.shift.endTime}`);
    }
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Please provide a mandatory reason for time correction.');
      return;
    }

    const clockInIso = inputToIso(clockInInput);
    const clockOutIso = inputToIso(clockOutInput);

    if (clockInIso && clockOutIso && new Date(clockOutIso) < new Date(clockInIso)) {
      setError('Clock Out time cannot be earlier than Clock In time.');
      return;
    }

    setLoading(true);
    setError(null);

    const formattedBreaks = breaks
      .filter((b) => Boolean(b.startAt))
      .map((b) => ({
        startAt: inputToIso(b.startAt)!,
        endAt: inputToIso(b.endAt),
      }));

    try {
      const response = await correctAttendance(employee.id, {
        date: record.date,
        clockInAt: clockInIso,
        clockOutAt: clockOutIso,
        status: statusOverride ? statusOverride : undefined,
        reason: reason.trim(),
        breaks: formattedBreaks,
      });

      onSuccess(response);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save correction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onClose}
      title="Attendance Time Correction"
      description="Manual punch and status adjustment with immutable audit trail."
      size="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>

          {activeTab === 'form' ? (
            <Button
              variant="primary"
              onClick={() => void handleSubmit()}
              disabled={loading || !reason.trim()}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving…
                </span>
              ) : (
                'Save Correction & Apply'
              )}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setActiveTab('form')}>
              Back to Edit Form
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {/* Employee Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-surface-secondary border border-base">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-brand-500/10 text-brand-600 flex items-center justify-center font-bold text-sm shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-primary">
                {employee.firstName} {employee.lastName}
              </div>
              <div className="text-xs text-secondary">
                {employee.employeeNumber} · Shift: {record.shift?.name} ({record.shift?.startTime}–{record.shift?.endTime})
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="neutral" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {record.date}
            </Badge>
            {history.length > 0 && (
              <Badge tone="accent" className="cursor-pointer" onClick={() => setActiveTab('history')}>
                {history.length} corrections logged
              </Badge>
            )}
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex border-b border-base gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
              activeTab === 'form'
                ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" /> Adjust Times & Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 flex items-center gap-1.5 transition-colors ${
              activeTab === 'history'
                ? 'border-b-2 border-brand-500 text-brand-600 dark:text-brand-400'
                : 'text-muted hover:text-primary'
            }`}
          >
            <History className="h-3.5 w-3.5" /> Audit History ({history.length})
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-error-50 dark:bg-error-950/30 border border-error-200 text-xs text-error-700 dark:text-error-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {activeTab === 'form' ? (
          <div className="space-y-4">
            {/* Clock Times Grid */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="surface border border-base rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="correct-clock-in" className="text-xs font-semibold">
                    Clock In Time
                  </Label>
                  <button
                    type="button"
                    onClick={setShiftStartClockIn}
                    className="text-[11px] text-accent-600 hover:underline"
                  >
                    Use shift start ({record.shift?.startTime})
                  </button>
                </div>
                <Input
                  id="correct-clock-in"
                  type="datetime-local"
                  value={clockInInput}
                  onChange={(e) => setClockInInput(e.target.value)}
                />
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Current: {formatDisplayTime(record.clockInAt)}</span>
                  {clockInInput && (
                    <button
                      type="button"
                      onClick={() => setClockInInput('')}
                      className="text-error-600 hover:underline"
                    >
                      Clear punch
                    </button>
                  )}
                </div>
              </div>

              <div className="surface border border-base rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="correct-clock-out" className="text-xs font-semibold">
                    Clock Out Time
                  </Label>
                  <button
                    type="button"
                    onClick={setShiftEndClockOut}
                    className="text-[11px] text-accent-600 hover:underline"
                  >
                    Use shift end ({record.shift?.endTime})
                  </button>
                </div>
                <Input
                  id="correct-clock-out"
                  type="datetime-local"
                  value={clockOutInput}
                  onChange={(e) => setClockOutInput(e.target.value)}
                />
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>Current: {formatDisplayTime(record.clockOutAt)}</span>
                  {clockOutInput && (
                    <button
                      type="button"
                      onClick={() => setClockOutInput('')}
                      className="text-error-600 hover:underline"
                    >
                      Clear punch
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Status Override */}
            <div>
              <Label htmlFor="correct-status">Status Override</Label>
              <Select
                id="correct-status"
                value={statusOverride}
                onChange={(e) => setStatusOverride(e.target.value)}
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <p className="text-[11px] text-muted mt-1">
                Leave on &ldquo;Auto-calculate&rdquo; to have the system resolve Present, Late, or Early Leave from shift hours.
              </p>
            </div>

            {/* Breaks Management */}
            <div className="surface border border-base rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Coffee className="h-4 w-4 text-muted" />
                  <span>Break Sessions ({breaks.length})</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleAddBreak} type="button">
                  <Plus className="h-3.5 w-3.5" /> Add Break
                </Button>
              </div>

              {breaks.length === 0 ? (
                <p className="text-xs text-muted italic">No breaks recorded for this day.</p>
              ) : (
                <div className="space-y-2.5">
                  {breaks.map((b, idx) => (
                    <div key={b.id} className="flex items-center gap-2 text-xs">
                      <span className="text-muted w-6 text-center">{idx + 1}.</span>
                      <Input
                        type="datetime-local"
                        value={b.startAt}
                        onChange={(e) => handleBreakChange(b.id, 'startAt', e.target.value)}
                        className="text-xs"
                      />
                      <span className="text-muted">to</span>
                      <Input
                        type="datetime-local"
                        value={b.endAt}
                        onChange={(e) => handleBreakChange(b.id, 'endAt', e.target.value)}
                        className="text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveBreak(b.id)}
                        className="p-1.5 text-error-600 hover:bg-error-50 dark:hover:bg-error-950/40 rounded-lg transition-colors"
                        title="Remove break"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mandatory Reason */}
            <div className="space-y-2">
              <Label htmlFor="correction-reason" className="flex items-center justify-between">
                <span>
                  Reason for Adjustment <strong className="text-error-500">*</strong>
                </span>
                <span className="text-[11px] text-muted">Mandatory for compliance & audit</span>
              </Label>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_REASONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setReason(preset)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-surface-secondary hover:bg-surface-tertiary border border-base text-secondary transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>

              <Textarea
                id="correction-reason"
                rows={2}
                placeholder="Explain why this attendance record was manually modified…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
        ) : (
          /* Audit History View */
          <div className="space-y-3">
            {historyLoading ? (
              <div className="py-8 text-center text-xs text-muted flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Loading audit logs…
              </div>
            ) : history.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted">
                <ShieldCheck className="h-8 w-8 mx-auto text-muted mb-2" />
                No manual corrections have been recorded for this employee on {record.date}.
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="surface border border-base rounded-xl p-3.5 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-primary">
                      Adjusted by {item.requestedBy}
                    </span>
                    <span className="text-muted text-[11px]">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="p-2 rounded-lg bg-surface-secondary text-secondary">
                    <strong>Reason:</strong> {item.reason}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div>
                      <span className="text-muted">Previous punch:</span>
                      <div>In: {formatDisplayTime(item.originalValues.clockInAt)}</div>
                      <div>Out: {formatDisplayTime(item.originalValues.clockOutAt)}</div>
                      <div>Status: {item.originalValues.status ?? '—'}</div>
                    </div>
                    <div>
                      <span className="text-accent-600 font-medium">Updated punch:</span>
                      <div>In: {formatDisplayTime(item.requestedClockInAt)}</div>
                      <div>Out: {formatDisplayTime(item.requestedClockOutAt)}</div>
                      <div>Status: {item.requestedStatus ?? '—'}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
