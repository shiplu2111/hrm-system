import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Coffee,
  LogIn,
  LogOut,
  RefreshCw,
  Pencil,
  CheckCircle2,
  Users,
  UserCheck,
  AlertTriangle,
  UserMinus,
  Download,
  Search,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  Calendar,
  Building2,
  Briefcase,
  Play,
  RotateCcw,
} from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Select, Label } from '@/components/ui/Form';
import { PermissionGate } from '@hrm/portal-ui';
import type { AttendanceDayRecord, EmployeeRecord } from '@hrm/shared-types';
import { useCompany } from '@/context/CompanyContext';
import { listEmployees } from '@/lib/employees-api';
import {
  breakEnd,
  breakStart,
  clockIn,
  clockOut,
  formatAttendanceMinutes,
  getAttendanceToday,
  getCompanyDailyAttendance,
  type DailyAttendanceRow,
  type DailyAttendanceKpis,
} from '@/lib/attendance-api';
import { CheckoutConfirmationModal } from '@/components/attendance/CheckoutConfirmationModal';
import { AttendanceCorrectionModal } from '@/components/attendance/AttendanceCorrectionModal';
import { ApiError } from '@/lib/tenant-api-client';

type StatusFilter = 'all' | 'present' | 'late' | 'on_break' | 'absent' | 'leave';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AttendancePage() {
  const { companyId, company } = useCompany();

  // Hub States
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const [dailyRows, setDailyRows] = useState<DailyAttendanceRow[]>([]);
  const [kpis, setKpis] = useState<DailyAttendanceKpis>({
    totalStaff: 0,
    present: 0,
    late: 0,
    earlyLeave: 0,
    onBreak: 0,
    absent: 0,
    onLeave: 0,
  });
  const [hubLoading, setHubLoading] = useState(false);
  const [hubError, setHubError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [shiftFilter, setShiftFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Simulator / Manual Drawer Mode
  const [showSimulator, setShowSimulator] = useState(false);

  // Live Clock State
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Simulator States
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [simulatorEmployeeId, setSimulatorEmployeeId] = useState('');
  const [simulatorRecord, setSimulatorRecord] = useState<AttendanceDayRecord | null>(null);
  const [testTimestamp, setTestTimestamp] = useState('');
  const [simulatorLoading, setSimulatorLoading] = useState(false);

  // Modals & Feedback
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedCheckoutEmployee, setSelectedCheckoutEmployee] = useState<{
    id: string;
    name: string;
    record: AttendanceDayRecord | null;
  } | null>(null);

  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedCorrectionEmployee, setSelectedCorrectionEmployee] = useState<{
    record: AttendanceDayRecord | null;
    employee: EmployeeRecord | null;
  } | null>(null);

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Live Clock Ticker
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load Daily Attendance
  const loadDailyAttendance = useCallback(async () => {
    if (!companyId) return;
    setHubLoading(true);
    setHubError(null);
    try {
      const resp = await getCompanyDailyAttendance(companyId, selectedDate);
      setDailyRows(resp.rows);
      setKpis(resp.kpis);
    } catch (e) {
      setHubError(e instanceof ApiError ? e.message : 'Failed to load daily attendance');
    } finally {
      setHubLoading(false);
    }
  }, [companyId, selectedDate]);

  useEffect(() => {
    void loadDailyAttendance();
  }, [loadDailyAttendance]);

  // Load Employees for Simulator
  const loadEmployees = useCallback(async () => {
    try {
      const rows = await listEmployees();
      setEmployees(rows);
      if (rows.length && !simulatorEmployeeId) {
        setSimulatorEmployeeId(rows[0].id);
      }
    } catch {
      // Ignored if non-fatal
    }
  }, [simulatorEmployeeId]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  // Refresh simulator selected employee
  const refreshSimulatorRecord = useCallback(async () => {
    if (!simulatorEmployeeId) return;
    setSimulatorLoading(true);
    try {
      const data = await getAttendanceToday(simulatorEmployeeId);
      setSimulatorRecord(data);
    } catch {
      setSimulatorRecord(null);
    } finally {
      setSimulatorLoading(false);
    }
  }, [simulatorEmployeeId]);

  useEffect(() => {
    if (showSimulator && simulatorEmployeeId) {
      void refreshSimulatorRecord();
    }
  }, [showSimulator, simulatorEmployeeId, refreshSimulatorRecord]);

  // Unique Departments & Shifts for Filter Dropdowns
  const departments = useMemo(() => {
    const set = new Set<string>();
    dailyRows.forEach((r) => {
      if (r.employee.department?.name) set.add(r.employee.department.name);
    });
    return Array.from(set).sort();
  }, [dailyRows]);

  const shifts = useMemo(() => {
    const set = new Set<string>();
    dailyRows.forEach((r) => {
      if (r.attendance.shift.name) set.add(r.attendance.shift.name);
    });
    return Array.from(set).sort();
  }, [dailyRows]);

  // Filtered Rows
  const filteredRows = useMemo(() => {
    return dailyRows.filter((r) => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const fullName = `${r.employee.firstName} ${r.employee.lastName}`.toLowerCase();
        const empNo = r.employee.employeeNumber.toLowerCase();
        if (!fullName.includes(q) && !empNo.includes(q)) return false;
      }

      // Department filter
      if (departmentFilter !== 'all') {
        if (r.employee.department?.name !== departmentFilter) return false;
      }

      // Shift filter
      if (shiftFilter !== 'all') {
        if (r.attendance.shift.name !== shiftFilter) return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const att = r.attendance;
        if (statusFilter === 'leave' && att.status !== 'leave') return false;
        if (statusFilter === 'on_break' && att.metrics.phase !== 'on_break') return false;
        if (statusFilter === 'late' && !att.metrics.isLate) return false;
        if (statusFilter === 'present') {
          if (!att.clockInAt || att.status === 'leave') return false;
        }
        if (statusFilter === 'absent') {
          if (att.clockInAt || att.status === 'leave') return false;
        }
      }

      return true;
    });
  }, [dailyRows, searchQuery, departmentFilter, shiftFilter, statusFilter]);

  // Simulator actions
  const capturePayload = testTimestamp.trim()
    ? { timestamp: testTimestamp.trim(), source: 'manual' as const }
    : { source: 'manual' as const };

  async function runSimulatorAction(
    action: 'clock-in' | 'clock-out' | 'break-start' | 'break-end',
    empId = simulatorEmployeeId,
  ) {
    if (!empId) return;
    setSimulatorLoading(true);
    try {
      let data: AttendanceDayRecord;
      switch (action) {
        case 'clock-in':
          data = await clockIn(empId, capturePayload);
          break;
        case 'clock-out':
          data = await clockOut(empId, capturePayload);
          break;
        case 'break-start':
          data = await breakStart(empId, capturePayload);
          break;
        case 'break-end':
          data = await breakEnd(empId, capturePayload);
          break;
      }
      if (empId === simulatorEmployeeId) {
        setSimulatorRecord(data);
      }
      setSuccessMessage(`Attendance successfully updated (${action}).`);
      setTimeout(() => setSuccessMessage(null), 4000);
      void loadDailyAttendance();
    } catch (e) {
      setHubError(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setSimulatorLoading(false);
    }
  }

  // Quick Action: Open Correction Modal for Row
  const handleOpenCorrection = (row: DailyAttendanceRow) => {
    const fakeRecord = {
      id: row.attendance.id,
      employeeId: row.employee.id,
      date: row.attendance.date,
      clockInAt: row.attendance.clockInAt,
      clockOutAt: row.attendance.clockOutAt,
      clockInServerAt: null,
      clockOutServerAt: null,
      status: row.attendance.status as any,
      source: row.attendance.source,
      timeAnomaly: false,
      geofenceMismatch: false,
      payrollEligible: true,
      reviewStatus: 'none' as const,
      shift: row.attendance.shift,
      breaks: row.attendance.breaks,
      metrics: row.attendance.metrics,
    } as unknown as AttendanceDayRecord;

    const fakeEmp = {
      id: row.employee.id,
      employeeNumber: row.employee.employeeNumber,
      firstName: row.employee.firstName,
      lastName: row.employee.lastName,
      email: '',
      employmentStatus: row.employee.employmentStatus as any,
      hireDate: '',
      department: row.employee.department,
      designation: row.employee.designation
        ? { id: row.employee.designation.id, name: row.employee.designation.title }
        : null,
    } as unknown as EmployeeRecord;

    setSelectedCorrectionEmployee({
      record: fakeRecord,
      employee: fakeEmp,
    });
    setCorrectionModalOpen(true);
  };

  // Quick Action: Row-level Quick Punch
  const handleQuickPunch = async (row: DailyAttendanceRow) => {
    const phase = row.attendance.metrics.phase;
    if (phase === 'not_started') {
      await runSimulatorAction('clock-in', row.employee.id);
    } else if (phase === 'working') {
      const fakeRecord = {
        id: row.attendance.id,
        employeeId: row.employee.id,
        date: row.attendance.date,
        clockInAt: row.attendance.clockInAt,
        clockOutAt: row.attendance.clockOutAt,
        clockInServerAt: null,
        clockOutServerAt: null,
        status: row.attendance.status as any,
        source: row.attendance.source,
        timeAnomaly: false,
        geofenceMismatch: false,
        payrollEligible: true,
        reviewStatus: 'none' as const,
        shift: row.attendance.shift,
        breaks: row.attendance.breaks,
        metrics: row.attendance.metrics,
      } as unknown as AttendanceDayRecord;
      setSelectedCheckoutEmployee({
        id: row.employee.id,
        name: `${row.employee.firstName} ${row.employee.lastName} (${row.employee.employeeNumber})`,
        record: fakeRecord,
      });
      setCheckoutModalOpen(true);
    } else if (phase === 'on_break') {
      await runSimulatorAction('break-end', row.employee.id);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'Employee ID',
      'Name',
      'Department',
      'Shift',
      'Shift Time',
      'Clock In',
      'Clock Out',
      'Breaks (min)',
      'Net Hours',
      'Late (min)',
      'Early Leave (min)',
      'Status',
      'Source',
    ];

    const rows = filteredRows.map((r) => [
      `"${r.employee.employeeNumber}"`,
      `"${r.employee.firstName} ${r.employee.lastName}"`,
      `"${r.employee.department?.name ?? '—'}"`,
      `"${r.attendance.shift.name}"`,
      `"${r.attendance.shift.startTime} - ${r.attendance.shift.endTime}"`,
      `"${formatTime(r.attendance.clockInAt)}"`,
      `"${formatTime(r.attendance.clockOutAt)}"`,
      r.attendance.metrics.breakMinutes,
      `"${formatAttendanceMinutes(r.attendance.metrics.netMinutes)}"`,
      r.attendance.metrics.lateMinutes,
      r.attendance.metrics.earlyLeaveMinutes,
      `"${r.attendance.status}"`,
      `"${r.attendance.source ?? '—'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `daily_attendance_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-primary">
              Daily Attendance Hub
            </h1>
            {company && (
              <Badge tone="accent" className="font-semibold px-2.5 py-1">
                {company.name}
              </Badge>
            )}
          </div>
          <p className="text-sm text-secondary mt-1">
            Real-time live attendance overview, shift monitoring & quick administrative actions.
          </p>
        </div>

        {/* Live Clock & Date Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-surface-secondary border border-border px-3.5 py-1.5 shadow-xs">
            <Clock className="h-4 w-4 text-accent-500 animate-pulse" />
            <div className="text-right">
              <div className="text-xs font-semibold tabular-nums text-primary">
                {currentTime.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </div>
              <div className="text-[10px] text-secondary font-medium">Live Server Time</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface-secondary px-3 py-1 shadow-xs">
            <Calendar className="h-4 w-4 text-secondary shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-medium text-primary focus:outline-hidden cursor-pointer"
            />
          </div>

          <Button
            variant={showSimulator ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowSimulator(!showSimulator)}
            className="gap-1.5"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {showSimulator ? 'Hide Simulator' : 'Simulator Mode'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void loadDailyAttendance()}
            disabled={hubLoading}
            title="Refresh Attendance Hub"
          >
            <RefreshCw className={`h-4 w-4 ${hubLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-sm text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 h-7 px-2"
          >
            Dismiss
          </Button>
        </div>
      )}

      {hubError && (
        <div className="rounded-xl border border-error-200 bg-error-50 dark:bg-error-950/40 p-4 text-sm text-error-800 dark:text-error-200 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-error-600 dark:text-error-400 shrink-0" />
            <span className="font-medium">{hubError}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setHubError(null)}
            className="text-error-700 h-7 px-2"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Top Counter KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* Total Staff */}
        <div
          onClick={() => setStatusFilter('all')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 shadow-xs hover:shadow-md ${
            statusFilter === 'all'
              ? 'border-accent-500 bg-accent-500/5 ring-2 ring-accent-500/20'
              : 'border-border bg-surface'
          }`}
        >
          <div className="flex items-center justify-between text-secondary">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Staff</span>
            <Users className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-primary">
            {kpis.totalStaff}
          </div>
          <div className="text-[11px] text-secondary mt-0.5">Active Employees</div>
        </div>

        {/* Present */}
        <div
          onClick={() => setStatusFilter('present')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 shadow-xs hover:shadow-md ${
            statusFilter === 'present'
              ? 'border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/20'
              : 'border-border bg-surface'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Present</span>
            <UserCheck className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
            {kpis.present}
          </div>
          <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
            Checked In Today
          </div>
        </div>

        {/* Late */}
        <div
          onClick={() => setStatusFilter('late')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 shadow-xs hover:shadow-md ${
            statusFilter === 'late'
              ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20'
              : 'border-border bg-surface'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Late</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-300">
            {kpis.late}
          </div>
          <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
            Past Grace Time
          </div>
        </div>

        {/* Early Leave */}
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-xs">
          <div className="flex items-center justify-between text-orange-600 dark:text-orange-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Early Leave</span>
            <LogOut className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-orange-700 dark:text-orange-300">
            {kpis.earlyLeave}
          </div>
          <div className="text-[11px] text-orange-600/80 dark:text-orange-400/80 mt-0.5">
            Left Before Shift End
          </div>
        </div>

        {/* On Break */}
        <div
          onClick={() => setStatusFilter('on_break')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 shadow-xs hover:shadow-md ${
            statusFilter === 'on_break'
              ? 'border-indigo-500 bg-indigo-500/5 ring-2 ring-indigo-500/20'
              : 'border-border bg-surface'
          }`}
        >
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
            <span className="text-xs font-semibold uppercase tracking-wider">On Break</span>
            <Coffee className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-indigo-700 dark:text-indigo-300">
            {kpis.onBreak}
          </div>
          <div className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-0.5">
            Active Pause Now
          </div>
        </div>

        {/* Absent */}
        <div
          onClick={() => setStatusFilter('absent')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 shadow-xs hover:shadow-md ${
            statusFilter === 'absent'
              ? 'border-rose-500 bg-rose-500/5 ring-2 ring-rose-500/20'
              : 'border-border bg-surface'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Absent</span>
            <UserMinus className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-rose-700 dark:text-rose-300">
            {kpis.absent}
          </div>
          <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
            Not Punched In
          </div>
        </div>

        {/* On Leave */}
        <div
          onClick={() => setStatusFilter('leave')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 shadow-xs hover:shadow-md ${
            statusFilter === 'leave'
              ? 'border-sky-500 bg-sky-500/5 ring-2 ring-sky-500/20'
              : 'border-border bg-surface'
          }`}
        >
          <div className="flex items-center justify-between text-sky-600 dark:text-sky-400">
            <span className="text-xs font-semibold uppercase tracking-wider">On Leave</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-sky-700 dark:text-sky-300">
            {kpis.onLeave}
          </div>
          <div className="text-[11px] text-sky-600/80 dark:text-sky-400/80 mt-0.5">
            Approved Leave
          </div>
        </div>
      </div>

      {/* Simulator Mode Drawer (Preserved from original test widget) */}
      {showSimulator && (
        <Card className="border-accent-200 dark:border-accent-800/60 bg-accent-50/20 dark:bg-accent-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-accent-500" />
              <CardTitle className="text-base font-semibold">
                Manual / Simulator Test Mode
              </CardTitle>
            </div>
            <Badge tone="accent">Testing & Offline Emulation Tool</Badge>
          </CardHeader>
          <CardBody className="space-y-4 pt-0">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sim-employee">Target Employee</Label>
                <Select
                  id="sim-employee"
                  value={simulatorEmployeeId}
                  onChange={(e) => setSimulatorEmployeeId(e.target.value)}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="sim-ts">Simulated Punch Time</Label>
                  {testTimestamp && (
                    <button
                      type="button"
                      onClick={() => setTestTimestamp('')}
                      className="text-[11px] text-accent-600 hover:underline cursor-pointer"
                    >
                      Reset to Live Time
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    id="sim-ts"
                    type="datetime-local"
                    value={
                      testTimestamp
                        ? (() => {
                            try {
                              const d = new Date(testTimestamp);
                              const pad = (n: number) => String(n).padStart(2, '0');
                              return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                            } catch {
                              return '';
                            }
                          })()
                        : ''
                    }
                    onChange={(e) => {
                      if (!e.target.value) {
                        setTestTimestamp('');
                      } else {
                        const iso = new Date(e.target.value).toISOString();
                        setTestTimestamp(iso);
                      }
                    }}
                    className="flex-1"
                  />
                  <Select
                    className="w-44 text-xs"
                    value=""
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const today = new Date();
                      const y = today.getFullYear();
                      const m = String(today.getMonth() + 1).padStart(2, '0');
                      const d = String(today.getDate()).padStart(2, '0');
                      if (val === 'now') {
                        setTestTimestamp(new Date().toISOString());
                      } else if (val === '09:00') {
                        setTestTimestamp(new Date(`${y}-${m}-${d}T09:00:00`).toISOString());
                      } else if (val === '09:25') {
                        setTestTimestamp(new Date(`${y}-${m}-${d}T09:25:00`).toISOString());
                      } else if (val === '13:00') {
                        setTestTimestamp(new Date(`${y}-${m}-${d}T13:00:00`).toISOString());
                      } else if (val === '13:45') {
                        setTestTimestamp(new Date(`${y}-${m}-${d}T13:45:00`).toISOString());
                      } else if (val === '16:30') {
                        setTestTimestamp(new Date(`${y}-${m}-${d}T16:30:00`).toISOString());
                      } else if (val === '17:05') {
                        setTestTimestamp(new Date(`${y}-${m}-${d}T17:05:00`).toISOString());
                      }
                    }}
                  >
                    <option value="">⚡ Presets…</option>
                    <option value="now">Live Current Time</option>
                    <option value="09:00">09:00 AM (On-time Shift Start)</option>
                    <option value="09:25">09:25 AM (Late Punch)</option>
                    <option value="13:00">01:00 PM (Lunch Break Start)</option>
                    <option value="13:45">01:45 PM (Break End)</option>
                    <option value="16:30">04:30 PM (Early Leave Punch)</option>
                    <option value="17:05">05:05 PM (Regular Shift End)</option>
                  </Select>
                </div>
                <p className="text-[11px] text-secondary mt-1">
                  {testTimestamp ? (
                    <span className="text-accent-600 font-medium">
                      Simulating: {new Date(testTimestamp).toLocaleString()}
                    </span>
                  ) : (
                    'Empty = using live server/device time'
                  )}
                </p>
              </div>
            </div>

            {simulatorRecord && (
              <div className="rounded-xl bg-surface border border-border p-3 text-xs flex flex-wrap items-center gap-4">
                <div>
                  <span className="text-secondary">Current Phase:</span>{' '}
                  <span className="font-semibold text-primary">
                    {simulatorRecord.metrics.phase.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <span className="text-secondary">Clock In:</span>{' '}
                  <span className="font-semibold text-primary">
                    {formatTime(simulatorRecord.clockInAt)}
                  </span>
                </div>
                <div>
                  <span className="text-secondary">Clock Out:</span>{' '}
                  <span className="font-semibold text-primary">
                    {formatTime(simulatorRecord.clockOutAt)}
                  </span>
                </div>
                <div>
                  <span className="text-secondary">Net Hours:</span>{' '}
                  <span className="font-semibold text-primary">
                    {formatAttendanceMinutes(simulatorRecord.metrics.netMinutes)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={simulatorLoading}
                onClick={() => void runSimulatorAction('clock-in')}
              >
                <LogIn className="h-4 w-4" /> Punch In
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={simulatorLoading}
                onClick={() => void runSimulatorAction('break-start')}
              >
                <Coffee className="h-4 w-4" /> Start Break
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={simulatorLoading}
                onClick={() => void runSimulatorAction('break-end')}
              >
                <Coffee className="h-4 w-4" /> End Break
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={simulatorLoading}
                onClick={() => void runSimulatorAction('clock-out')}
              >
                <LogOut className="h-4 w-4" /> Punch Out
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface p-4 rounded-2xl border border-border shadow-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-secondary" />
            <Input
              placeholder="Search by employee name or ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl"
            />
          </div>

          {/* Department Filter */}
          <div className="min-w-[170px]">
            <Select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-10 rounded-xl text-sm"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </Select>
          </div>

          {/* Shift Filter */}
          <div className="min-w-[160px]">
            <Select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="h-10 rounded-xl text-sm"
            >
              <option value="all">All Shifts</option>
              {shifts.map((shift) => (
                <option key={shift} value={shift}>
                  {shift}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Export & Reset Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={filteredRows.length === 0}
            className="gap-2 h-10 px-3.5 rounded-xl font-medium"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>

          {(searchQuery ||
            departmentFilter !== 'all' ||
            shiftFilter !== 'all' ||
            statusFilter !== 'all') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setDepartmentFilter('all');
                setShiftFilter('all');
                setStatusFilter('all');
              }}
              className="gap-1 h-10 rounded-xl text-secondary"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        {(
          [
            { id: 'all', label: 'All Records', count: dailyRows.length },
            { id: 'present', label: 'Present', count: kpis.present },
            { id: 'late', label: 'Late', count: kpis.late },
            { id: 'on_break', label: 'On Break', count: kpis.onBreak },
            { id: 'absent', label: 'Absent', count: kpis.absent },
            { id: 'leave', label: 'On Leave', count: kpis.onLeave },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === tab.id
                ? 'bg-primary text-on-primary shadow-xs'
                : 'text-secondary hover:text-primary hover:bg-surface-secondary'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                statusFilter === tab.id
                  ? 'bg-white/20 text-white'
                  : 'bg-surface-secondary text-secondary'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Comprehensive Attendance Table */}
      <Card className="overflow-hidden border-border shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-secondary/60 text-secondary text-xs uppercase font-semibold">
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Assigned Shift</th>
                <th className="py-3.5 px-4">Clock In</th>
                <th className="py-3.5 px-4">Clock Out</th>
                <th className="py-3.5 px-4">Breaks</th>
                <th className="py-3.5 px-4">Net Worked Hours</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Source</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-secondary">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-8 w-8 text-secondary/40" />
                      <p className="font-medium text-primary">No employee attendance found</p>
                      <p className="text-xs">
                        Try adjusting your filters or date selection for{' '}
                        <span className="font-mono">{selectedDate}</span>.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const emp = row.employee;
                  const att = row.attendance;
                  const shift = att.shift;
                  const metrics = att.metrics;

                  // Progress calculation (net minutes vs standard minutes)
                  const targetMins = shift.standardMinutes || 480;
                  const progressPct = Math.min(100, Math.round((metrics.netMinutes / targetMins) * 100));

                  // Determine Row Status Badge
                  let statusTone: 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'neutral';
                  let statusLabel = 'Absent';

                  if (att.status === 'leave') {
                    statusTone = 'info';
                    statusLabel = 'On Leave';
                  } else if (metrics.phase === 'working') {
                    statusTone = 'success';
                    statusLabel = 'Working';
                  } else if (metrics.phase === 'on_break') {
                    statusTone = 'warning';
                    statusLabel = 'On Break';
                  } else if (metrics.phase === 'completed') {
                    statusTone = 'accent' as any;
                    statusLabel = 'Completed';
                  } else if (att.clockInAt) {
                    statusTone = 'success';
                    statusLabel = 'Present';
                  }

                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-surface-secondary/40 transition-colors group"
                    >
                      {/* Employee Details */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {emp.avatarUrl ? (
                            <img
                              src={emp.avatarUrl}
                              alt={emp.firstName}
                              className="h-10 w-10 rounded-full object-cover border border-border"
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-accent-500/10 text-accent-600 dark:text-accent-400 font-bold flex items-center justify-center text-sm border border-accent-500/20">
                              {emp.firstName.charAt(0)}
                              {emp.lastName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-primary leading-tight">
                              {emp.firstName} {emp.lastName}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-secondary mt-0.5">
                              <span className="font-mono">{emp.employeeNumber}</span>
                              {emp.department && (
                                <>
                                  <span>•</span>
                                  <span>{emp.department.name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Shift Details */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-primary text-xs">
                          {shift.name}
                        </div>
                        <div className="text-secondary text-xs mt-0.5">
                          {shift.startTime} – {shift.endTime}
                        </div>
                      </td>

                      {/* Clock In */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-primary">
                          {formatTime(att.clockInAt)}
                        </div>
                        {metrics.isLate && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                              Late by {metrics.lateMinutes}m
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Clock Out */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-primary">
                          {formatTime(att.clockOutAt)}
                        </div>
                        {metrics.isEarlyLeave && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-semibold bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20">
                              Early by {metrics.earlyLeaveMinutes}m
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Breaks */}
                      <td className="py-3.5 px-4">
                        <div className="text-xs font-medium text-primary">
                          {metrics.breakMinutes > 0
                            ? `${metrics.breakMinutes} mins`
                            : '—'}
                        </div>
                        {att.breaks.length > 0 && (
                          <div className="text-[10px] text-secondary mt-0.5">
                            {att.breaks.length} session{att.breaks.length > 1 ? 's' : ''}
                          </div>
                        )}
                      </td>

                      {/* Net Hours & Progress Bar */}
                      <td className="py-3.5 px-4 min-w-[150px]">
                        <div className="flex items-center justify-between text-xs font-semibold text-primary">
                          <span>{formatAttendanceMinutes(metrics.netMinutes)}</span>
                          <span className="text-secondary font-normal text-[11px]">
                            / {formatAttendanceMinutes(targetMins)}
                          </span>
                        </div>
                        <div className="w-full bg-surface-secondary h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full transition-all duration-300 ${
                              progressPct >= 100
                                ? 'bg-emerald-500'
                                : progressPct > 50
                                ? 'bg-accent-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <Badge tone={statusTone as any} dot>
                          {statusLabel}
                        </Badge>
                      </td>

                      {/* Method / Source */}
                      <td className="py-3.5 px-4">
                        <span className="text-xs uppercase font-semibold text-secondary tracking-wide">
                          {att.source || '—'}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Punch Button */}
                          <PermissionGate module="attendance" action="create">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs gap-1"
                              title="Quick Punch for this employee"
                              onClick={() => void handleQuickPunch(row)}
                            >
                              <Clock className="h-3.5 w-3.5 text-accent-500" />
                              <span className="hidden sm:inline">
                                {metrics.phase === 'not_started'
                                  ? 'Punch In'
                                  : metrics.phase === 'working'
                                  ? 'Punch Out'
                                  : metrics.phase === 'on_break'
                                  ? 'End Break'
                                  : 'Punch'}
                              </span>
                            </Button>
                          </PermissionGate>

                          {/* Time Correction Button */}
                          <PermissionGate module="attendance" action="edit">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs gap-1 text-secondary hover:text-primary"
                              title="Correct / Adjust Attendance Record"
                              onClick={() => handleOpenCorrection(row)}
                            >
                              <Pencil className="h-3.5 w-3.5 text-secondary" />
                              <span className="hidden sm:inline">Edit Time</span>
                            </Button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Checkout Early Leave Alert Modal */}
      {selectedCheckoutEmployee && (
        <CheckoutConfirmationModal
          open={checkoutModalOpen}
          onClose={() => {
            setCheckoutModalOpen(false);
            setSelectedCheckoutEmployee(null);
          }}
          onConfirm={async () => {
            await runSimulatorAction('clock-out', selectedCheckoutEmployee.id);
            setCheckoutModalOpen(false);
            setSelectedCheckoutEmployee(null);
          }}
          record={selectedCheckoutEmployee.record}
          employeeName={selectedCheckoutEmployee.name}
          loading={simulatorLoading}
        />
      )}

      {/* Attendance Time Correction Modal with Audit Trail */}
      {selectedCorrectionEmployee && (
        <AttendanceCorrectionModal
          open={correctionModalOpen}
          onClose={() => {
            setCorrectionModalOpen(false);
            setSelectedCorrectionEmployee(null);
          }}
          record={selectedCorrectionEmployee.record}
          employee={selectedCorrectionEmployee.employee}
          onSuccess={(resp) => {
            const empName = selectedCorrectionEmployee.employee?.firstName ?? 'Employee';
            setSuccessMessage(
              `Time correction for ${empName} saved successfully with audit trail.`,
            );
            setTimeout(() => setSuccessMessage(null), 6000);
            void loadDailyAttendance();
          }}
        />
      )}
    </div>
  );
}
