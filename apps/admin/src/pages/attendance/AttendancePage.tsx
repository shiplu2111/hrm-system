import { useCallback, useEffect, useState } from 'react';
import { Clock, Coffee, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, Label } from '@/components/ui/Form';
import type { AttendanceDayRecord, EmployeeRecord } from '@hrm/shared-types';
import { listEmployees } from '@/lib/employees-api';
import {
  breakEnd,
  breakStart,
  clockIn,
  clockOut,
  formatAttendanceMinutes,
  getAttendanceToday,
} from '@/lib/attendance-api';
import { ApiError } from '@/lib/tenant-api-client';

const statusTone: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
  present: 'success',
  absent: 'neutral',
  late: 'warning',
  early_leave: 'warning',
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AttendancePage() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [record, setRecord] = useState<AttendanceDayRecord | null>(null);
  const [testTimestamp, setTestTimestamp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEmployees = useCallback(async () => {
    try {
      const rows = await listEmployees();
      setEmployees(rows);
      if (rows.length && !employeeId) {
        setEmployeeId(rows[0].id);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load employees');
    }
  }, [employeeId]);

  const refresh = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getAttendanceToday(employeeId);
      setRecord(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load attendance');
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const capturePayload = testTimestamp.trim()
    ? { timestamp: testTimestamp.trim(), source: 'manual' as const }
    : { source: 'manual' as const };

  async function runAction(
    action: 'clock-in' | 'clock-out' | 'break-start' | 'break-end',
  ) {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      let data: AttendanceDayRecord;
      switch (action) {
        case 'clock-in':
          data = await clockIn(employeeId, capturePayload);
          break;
        case 'clock-out':
          data = await clockOut(employeeId, capturePayload);
          break;
        case 'break-start':
          data = await breakStart(employeeId, capturePayload);
          break;
        case 'break-end':
          data = await breakEnd(employeeId, capturePayload);
          break;
      }
      setRecord(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  }

  const phase = record?.metrics.phase ?? 'not_started';
  const canClockIn = phase === 'not_started';
  const canClockOut = phase === 'working';
  const canBreakStart = phase === 'working';
  const canBreakEnd = phase === 'on_break';

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-primary">Attendance Clock (Test)</h1>
        <p className="text-sm text-secondary mt-0.5">
          Server-side clock in/out, breaks, and hours vs assigned shift roster.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <Label htmlFor="attendance-employee">Select employee</Label>
            <Select
              id="attendance-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="attendance-test-ts">Test timestamp (optional ISO)</Label>
            <Input
              id="attendance-test-ts"
              placeholder="2025-09-03T09:30:00.000Z"
              value={testTimestamp}
              onChange={(e) => setTestTimestamp(e.target.value)}
            />
            <p className="text-xs text-secondary mt-1">Leave empty to use server time</p>
          </div>
        </CardBody>
      </Card>

      {error && (
        <div className="rounded-lg border border-error-200 bg-error-50 dark:bg-error-950/30 px-4 py-3 text-sm text-error-700 dark:text-error-300">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Today — {record?.date ?? '…'}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardBody className="space-y-4">
          {record && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone[record.status] ?? 'neutral'}>
                  {record.status.replace('_', ' ')}
                </Badge>
                <Badge tone="neutral">Phase: {record.metrics.phase.replace('_', ' ')}</Badge>
                {record.metrics.isLate && <Badge tone="warning">Late</Badge>}
                {record.metrics.isEarlyLeave && <Badge tone="warning">Early leave</Badge>}
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-secondary">Shift</p>
                  <p className="font-medium">
                    {record.shift.name} ({record.shift.startTime}–{record.shift.endTime})
                  </p>
                  <p className="text-secondary text-xs mt-1">
                    Grace {record.shift.graceMinutes}m · Standard{' '}
                    {formatAttendanceMinutes(record.shift.standardMinutes)}
                  </p>
                </div>
                <div>
                  <p className="text-secondary">Clock times</p>
                  <p>In: {formatTime(record.clockInAt)}</p>
                  <p>Out: {formatTime(record.clockOutAt)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                {[
                  { label: 'Gross', value: record.metrics.grossMinutes },
                  { label: 'Breaks', value: record.metrics.breakMinutes },
                  { label: 'Net', value: record.metrics.netMinutes },
                  { label: 'Overtime', value: record.metrics.overtimeMinutes },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg bg-surface-secondary px-3 py-2">
                    <p className="text-secondary text-xs">{m.label}</p>
                    <p className="font-semibold">{formatAttendanceMinutes(m.value)}</p>
                  </div>
                ))}
              </div>

              {record.breaks.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Coffee className="h-4 w-4" /> Breaks
                  </p>
                  <ul className="text-sm space-y-1 text-secondary">
                    {record.breaks.map((b) => (
                      <li key={b.id}>
                        {formatTime(b.startAt)} → {formatTime(b.endAt)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <Button
              variant="primary"
              disabled={loading || !canClockIn}
              onClick={() => void runAction('clock-in')}
            >
              <LogIn className="h-4 w-4" /> Clock In
            </Button>
            <Button
              variant="secondary"
              disabled={loading || !canBreakStart}
              onClick={() => void runAction('break-start')}
            >
              <Coffee className="h-4 w-4" /> Start Break
            </Button>
            <Button
              variant="secondary"
              disabled={loading || !canBreakEnd}
              onClick={() => void runAction('break-end')}
            >
              <Coffee className="h-4 w-4" /> End Break
            </Button>
            <Button
              variant="primary"
              disabled={loading || !canClockOut}
              onClick={() => void runAction('clock-out')}
            >
              <LogOut className="h-4 w-4" /> Clock Out
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
