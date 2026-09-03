import { useState, useEffect } from 'react';
import {
  Home,
  User,
  Clock,
  CalendarDays,
  Calendar,
  FileText,
  FileCheck,
  Receipt,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Plus,
  Play,
  Pause,
  Upload,
  Download,
  Printer,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  ArrowRight,
  Shield,
  CreditCard,
  Smartphone,
  Eye,
  Heart,
  Phone,
  Mail,
  MapPin,
  HelpCircle,
  Layers,
  ArrowLeftRight,
  LogOut,
  Bell,
  Sun,
  Moon,
  Menu,
  Pencil,
  Coffee,
  Timer,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select, Textarea } from '@/components/ui/Form';
import { Progress, ProgressBar } from '@/components/ui/Progress';
import { Toggle, Avatar } from '@/components/ui/Toggle';
import { useTheme } from '@hrm/portal-ui';
import {
  essEmployeeProfile,
  essLeaveBalances,
  essMonthlyHeatmap,
  essTimesheetEntries,
  essLeaveRequests,
  essShiftRoster,
  essDocuments,
  essAnnouncements,
  type DayAttendance,
  type TimesheetDayRow,
  type ESSLeaveRequest,
  type ProfileChangeRequest,
  type ESSDocument,
} from '@/data/essData';
import { samplePayslip } from '@/data/payrollData';
import { expenseClaims, type ExpenseClaim } from '@/data/payrollData';

type BreakType = 'Tea Break' | 'Lunch Break' | 'Prayer Break' | 'Personal Break';

interface BreakEntry {
  id: string;
  type: BreakType;
  start: string;
  end: string | null;
  seconds: number;
}

const breakTypes: BreakType[] = ['Tea Break', 'Lunch Break', 'Prayer Break', 'Personal Break'];

export function ESSPortalPage({ onLogout }: { onLogout: () => void }) {
  const { theme, toggleTheme } = useTheme();

  // Navigation Sub-view
  const [currentView, setCurrentView] = useState<
    'home' | 'profile' | 'attendance' | 'leave' | 'roster' | 'payslips' | 'expenses'
  >('home');

  // Clock In / Out State & Live Timer
  const [clockedIn, setClockedIn] = useState(true);
  const [clockInTime] = useState('08:52 AM');
  const [onBreak, setOnBreak] = useState(false);
  const [workSeconds, setWorkSeconds] = useState(19420); // ~5h 23m 40s of net work
  const [breakSeconds, setBreakSeconds] = useState(2280); // 38m taken so far
  const [breakLog, setBreakLog] = useState<BreakEntry[]>([
    { id: 'br-1', type: 'Tea Break', start: '10:45 AM', end: '11:00 AM', seconds: 900 },
    { id: 'br-2', type: 'Lunch Break', start: '01:10 PM', end: '01:33 PM', seconds: 1380 },
  ]);
  const [breakType, setBreakType] = useState<BreakType>('Tea Break');
  const [runningBreakBase, setRunningBreakBase] = useState(0);

  const elapsedSeconds = workSeconds;
  const shiftSeconds = workSeconds + breakSeconds;

  useEffect(() => {
    if (!clockedIn) return;
    const timer = setInterval(() => {
      if (onBreak) setBreakSeconds((prev) => prev + 1);
      else setWorkSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [clockedIn, onBreak]);

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  };

  const formatShort = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const currentClockLabel = () =>
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const toggleBreak = () => {
    if (!clockedIn) return;
    if (onBreak) {
      setBreakLog((prev) =>
        prev.map((entry, index) =>
          index === prev.length - 1 && entry.end === null
            ? { ...entry, end: currentClockLabel(), seconds: breakSeconds - runningBreakBase }
            : entry,
        ),
      );
      setOnBreak(false);
    } else {
      setRunningBreakBase(breakSeconds);
      setBreakLog((prev) => [
        ...prev,
        { id: `br-${prev.length + 1}`, type: breakType, start: currentClockLabel(), end: null, seconds: 0 },
      ]);
      setOnBreak(true);
    }
  };

  // Profile Request Change State
  const [profileChangeModal, setProfileChangeModal] = useState(false);
  const [changeField, setChangeField] = useState('Emergency Contact Phone');
  const [changeOldVal, setChangeOldVal] = useState('+1 (415) 555-0144');
  const [changeNewVal, setChangeNewVal] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [changeSuccess, setChangeSuccess] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<ProfileChangeRequest[]>([
    {
      id: 'pcr-1',
      field: 'Residential Address',
      oldValue: '300 Folsom St',
      newValue: '450 Mission Street, Apt 18B, San Francisco, CA',
      reason: 'Relocated closer to downtown office.',
      requestedAt: '2024-08-20',
      status: 'Pending HR Approval',
    },
  ]);

  // Attendance Heatmap Popover
  const [selectedHeatmapDay, setSelectedHeatmapDay] = useState<DayAttendance | null>(null);

  // Attendance Correction Form State
  const [regularizeModalOpen, setRegularizeModalOpen] = useState(false);
  const [regDate, setRegDate] = useState('2024-08-06');
  const [regActualIn, setRegActualIn] = useState('09:22');
  const [regCorrectedIn, setRegCorrectedIn] = useState('08:50');
  const [regReason, setRegReason] = useState('');
  const [myRegRequests, setMyRegRequests] = useState([
    { id: 'rr-1', date: '2024-08-06', type: 'Late Mark Correction', status: 'Pending Manager', reason: 'Bay Bridge traffic delay — approved verbal exemption' },
  ]);

  // Timesheet state
  const [timesheetRows, setTimesheetRows] = useState<TimesheetDayRow[]>(essTimesheetEntries);
  const [timesheetSubmitted, setTimesheetSubmitted] = useState(false);

  // Leave Application State
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveList, setLeaveList] = useState<ESSLeaveRequest[]>(essLeaveRequests);
  const [applyLeaveType, setApplyLeaveType] = useState<ESSLeaveRequest['leaveType']>('Annual Leave');
  const [applyStartDate, setApplyStartDate] = useState('2024-09-02');
  const [applyEndDate, setApplyEndDate] = useState('2024-09-06');
  const [applyHalfDay, setApplyHalfDay] = useState(false);
  const [applyReason, setApplyReason] = useState('');

  // Shift Swap Modal State
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [swapColleague, setSwapColleague] = useState('Lisa Wang (ENG)');
  const [swapMyDate, setSwapMyDate] = useState('2024-08-28');
  const [swapTheirDate, setSwapTheirDate] = useState('2024-08-30');
  const [swapReason, setSwapReason] = useState('');

  // Overtime Request Modal State
  const [otModalOpen, setOtModalOpen] = useState(false);
  const [otDate, setOtDate] = useState('2024-08-27');
  const [otHours, setOtHours] = useState('2.5');
  const [otReason, setOtReason] = useState('');

  // Payslip Modal State
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);

  // Documents State
  const [docList, setDocList] = useState<ESSDocument[]>(essDocuments);
  const [uploadDocModalOpen, setUploadDocModalOpen] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState('Identity Document');

  // Expense Claims State
  const [myClaims, setMyClaims] = useState<ExpenseClaim[]>(
    expenseClaims.filter((c) => c.employeeId === 'EMP-001' || c.employeeName === 'Sarah Chen')
  );
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expCategory, setExpCategory] = useState<ExpenseClaim['category']>('Meals & Entertainment');
  const [expAmount, setExpAmount] = useState(85.5);
  const [expDesc, setExpDesc] = useState('');

  // Handlers
  const handleApplyLeave = () => {
    const newReq: ESSLeaveRequest = {
      id: `lr-${Date.now()}`,
      leaveType: applyLeaveType,
      startDate: applyStartDate,
      endDate: applyEndDate,
      days: applyHalfDay ? 0.5 : 5,
      isHalfDay: applyHalfDay,
      reason: applyReason || 'Personal leave.',
      status: 'Submitted',
      appliedOn: new Date().toISOString().split('T')[0],
    };
    setLeaveList((prev) => [newReq, ...prev]);
    setLeaveModalOpen(false);
  };

  const handleCancelLeave = (id: string) => {
    setLeaveList((prev) => prev.filter((r) => r.id !== id));
  };

  const handleApplyRegularization = () => {
    setMyRegRequests((prev) => [
      { id: `rr-${Date.now()}`, date: regDate, type: 'Timecard Correction', status: 'Pending Manager', reason: regReason || 'Forgot to punch in.' },
      ...prev,
    ]);
    setRegularizeModalOpen(false);
  };

  const handleProfileChangeSubmit = () => {
    if (!changeNewVal.trim()) return;
    const newReq: ProfileChangeRequest = {
      id: `pcr-${Date.now()}`,
      field: changeField,
      oldValue: changeOldVal,
      newValue: changeNewVal,
      reason: changeReason || 'Update personal record.',
      requestedAt: new Date().toISOString().split('T')[0],
      status: 'Pending HR Approval',
    };
    setPendingRequests((prev) => [newReq, ...prev]);
    setChangeSuccess(true);
    setTimeout(() => {
      setChangeSuccess(false);
      setProfileChangeModal(false);
    }, 1200);
  };

  const handleCreateExpense = () => {
    const newExp: ExpenseClaim = {
      id: `exp-${Date.now()}`,
      claimId: `EXP-2024-${200 + myClaims.length + 1}`,
      employeeId: 'EMP-001',
      employeeName: 'Sarah Chen',
      category: expCategory,
      amount: expAmount,
      currency: '$',
      date: new Date().toISOString().split('T')[0],
      description: expDesc || 'Business lunch meeting.',
      receiptName: 'receipt_upload_receipt.pdf',
      receiptSize: '420 KB',
      approvalStage: 'Employee Submitted',
      status: 'Pending Manager',
    };
    setMyClaims((prev) => [newExp, ...prev]);
    setExpenseModalOpen(false);
  };

  const navItems = [
    { key: 'home' as const, label: 'Home', icon: Home },
    { key: 'profile' as const, label: 'My Profile', icon: User },
    { key: 'attendance' as const, label: 'Attendance', icon: Clock },
    { key: 'leave' as const, label: 'Leave', icon: CalendarDays },
    { key: 'roster' as const, label: 'Roster & OT', icon: Calendar },
    { key: 'payslips' as const, label: 'Payslips & Docs', icon: FileText },
    { key: 'expenses' as const, label: 'Expenses', icon: Receipt },
  ];

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))] text-primary flex flex-col pb-16 md:pb-0">
      {/* ================= STICKY ESS TOPBAR ================= */}
      <header className="sticky top-0 z-40 surface border-b border-base px-4 lg:px-6 h-16 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {/* ESS Logo */}
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-accent-600 to-cyan-500 text-white flex items-center justify-center text-[11px] font-extrabold shadow-md shadow-accent-500/20">
              AC
            </div>
            <div>
              <span className="font-bold text-base text-primary leading-none block">Acme Corporation</span>
              <span className="text-[10px] text-muted font-medium">Employee Self-Service · Powered by Nexus HR</span>
            </div>
          </div>
        </div>

        {/* Topbar Center / Right Actions */}
        <div className="flex items-center gap-3">
          {/* Quick Sticky Clock In / Out Widget */}
          <div className="hidden sm:flex items-center gap-2 surface border border-base px-3 py-1.5 rounded-xl shadow-xs">
            <div className="flex flex-col text-right leading-tight">
              <span className="text-[10px] text-muted">
                {clockedIn ? (onBreak ? `On ${breakType.toLowerCase()}` : `In at ${clockInTime}`) : 'Not Clocked In'}
              </span>
              <span className={`font-mono text-xs font-bold ${onBreak ? 'text-warning-600 dark:text-warning-400' : 'text-primary'}`}>
                {clockedIn ? formatTimer(onBreak ? breakSeconds : elapsedSeconds) : '00h 00m 00s'}
              </span>
            </div>

            {clockedIn && (
              <button
                onClick={toggleBreak}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all border ${
                  onBreak
                    ? 'bg-warning-600 hover:bg-warning-700 text-white border-warning-600 shadow-md shadow-warning-600/20'
                    : 'bg-warning-50 dark:bg-warning-950/40 text-warning-700 dark:text-warning-300 border-warning-200 dark:border-warning-900 hover:bg-warning-100'
                }`}
              >
                <Coffee className="h-3.5 w-3.5" /> {onBreak ? 'End Break' : 'Break'}
              </button>
            )}

            <button
              onClick={() => setClockedIn(!clockedIn)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                clockedIn
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-900'
                  : 'bg-success-600 hover:bg-success-700 text-white shadow-md shadow-success-600/20'
              }`}
            >
              {clockedIn ? (
                <>
                  <Pause className="h-3.5 w-3.5" /> Clock Out
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" /> Clock In
                </>
              )}
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))] transition-colors"
          >
            {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </button>

          {/* Sign out */}
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-xl text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))] transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>

          {/* User Avatar */}
          <div className="flex items-center gap-2 pl-2 border-l border-base">
            <Avatar name={essEmployeeProfile.name} size="sm" />
            <div className="hidden lg:block leading-tight text-left">
              <span className="text-xs font-bold text-primary block">{essEmployeeProfile.name}</span>
              <span className="text-[10px] text-muted">{essEmployeeProfile.designation}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTAINER WITH SUB-NAVIGATION ================= */}
      <div className="flex-1 max-w-[1400px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* DESKTOP ESS SIDEBAR NAV (3 cols) */}
        <aside className="hidden md:block md:col-span-3 surface border border-base rounded-2xl p-3 space-y-1 shadow-sm sticky top-24">
          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted">
            My Workspace
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setCurrentView(item.key)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-accent-600 text-white shadow-md shadow-accent-600/20'
                      : 'text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-4 mt-4 border-t border-base px-3">
            <div className="text-[11px] text-muted">Shift: {essEmployeeProfile.shift}</div>
            <div className="text-[11px] text-success-600 font-medium mt-0.5">● Active on Network</div>
          </div>
        </aside>

        {/* MAIN BODY AREA (9 cols on desktop) */}
        <main className="md:col-span-9 space-y-6">
          {/* ================= VIEW 1: ESS HOME / DASHBOARD ================= */}
          {currentView === 'home' && (
            <div className="space-y-6">
              {/* Greeting & Quick Punch Banner */}
              <div className="surface border border-base rounded-2xl p-6 shadow-sm bg-gradient-to-r from-accent-50/50 via-surface to-surface dark:from-accent-950/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent-100 dark:bg-accent-900/50 text-accent-700 dark:text-accent-300 text-xs font-semibold">
                      <Sparkles className="h-3 w-3" /> Today is Monday, Aug 26, 2024
                    </div>
                    <h2 className="text-2xl font-extrabold text-primary">
                      Good morning, {essEmployeeProfile.preferredName}! 👋
                    </h2>
                    <p className="text-xs text-secondary">
                      You are assigned to the <strong>{essEmployeeProfile.shift}</strong> at{' '}
                      <strong>{essEmployeeProfile.workLocation}</strong>.
                    </p>
                  </div>

                  {/* Big Touch-Friendly Clock In/Out Box */}
                  <div className="surface border border-base rounded-2xl p-4 flex items-center gap-4 shrink-0 shadow-md">
                    <div>
                      <div className="text-[10px] text-muted uppercase font-bold tracking-wider">
                        {clockedIn ? (onBreak ? 'On Break' : 'Working Since') : 'Current Status'}
                      </div>
                      <div
                        className={`text-xl font-mono font-extrabold ${
                          onBreak ? 'text-warning-600 dark:text-warning-400' : 'text-primary'
                        }`}
                      >
                        {clockedIn ? formatTimer(onBreak ? breakSeconds : elapsedSeconds) : 'Clocked Out'}
                      </div>
                      <div
                        className={`text-[11px] font-medium ${
                          onBreak ? 'text-warning-600 dark:text-warning-400' : 'text-success-600'
                        }`}
                      >
                        {clockedIn
                          ? onBreak
                            ? `● ${breakType} in progress`
                            : `● Checked in at ${clockInTime}`
                          : 'Ready for shift'}
                      </div>
                    </div>

                    <button
                      onClick={() => setClockedIn(!clockedIn)}
                      className={`h-12 px-5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all ${
                        clockedIn
                          ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/20'
                          : 'bg-success-600 hover:bg-success-700 text-white shadow-lg shadow-success-600/20'
                      }`}
                    >
                      {clockedIn ? (
                        <>
                          <Pause className="h-4 w-4" /> Clock Out
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" /> Clock In
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* ================= BREAK TRACKER & DAILY TIME SUMMARY ================= */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Break control */}
                <div
                  className={`lg:col-span-2 surface border rounded-2xl p-5 shadow-sm transition-colors ${
                    onBreak ? 'border-warning-400 dark:border-warning-700' : 'border-base'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                          onBreak
                            ? 'bg-warning-100 dark:bg-warning-950/50 text-warning-600 dark:text-warning-400'
                            : 'bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400'
                        }`}
                      >
                        <Coffee className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-primary">Break Tracker</div>
                        <div className="text-[11px] text-muted mt-0.5">
                          {onBreak
                            ? `${breakType} running — ${formatTimer(breakSeconds - runningBreakBase)}`
                            : 'Start a break and your work timer pauses automatically.'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={breakType}
                        onChange={(e) => setBreakType(e.target.value as BreakType)}
                        disabled={onBreak || !clockedIn}
                        className="text-xs"
                      >
                        {breakTypes.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </Select>
                      <button
                        onClick={toggleBreak}
                        disabled={!clockedIn}
                        className={`h-10 px-4 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 transition-all disabled:opacity-40 disabled:pointer-events-none ${
                          onBreak
                            ? 'bg-success-600 hover:bg-success-700 text-white shadow-lg shadow-success-600/20'
                            : 'bg-warning-600 hover:bg-warning-700 text-white shadow-lg shadow-warning-600/20'
                        }`}
                      >
                        {onBreak ? (
                          <>
                            <Play className="h-4 w-4" /> Resume Work
                          </>
                        ) : (
                          <>
                            <Pause className="h-4 w-4" /> Start Break
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Today's break log */}
                  <div className="mt-5 border-t border-base pt-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
                      Today's Breaks ({breakLog.length})
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto scrollbar-thin">
                      {breakLog.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[rgb(var(--bg-muted))]"
                        >
                          <Coffee className="h-3.5 w-3.5 text-warning-600 shrink-0" />
                          <span className="text-xs font-semibold text-primary flex-1">{entry.type}</span>
                          <span className="text-[11px] text-muted font-mono">
                            {entry.start} – {entry.end ?? 'now'}
                          </span>
                          <span className="text-[11px] font-mono font-bold text-secondary w-14 text-right">
                            {entry.end
                              ? formatShort(entry.seconds)
                              : formatShort(breakSeconds - runningBreakBase)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Daily totals */}
                <div className="surface border border-base rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <Timer className="h-4 w-4 text-accent-500" />
                    <span className="text-sm font-bold text-primary">Today's Summary</span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-secondary font-medium">Net working time</span>
                        <span className="font-mono font-bold text-success-600">{formatShort(workSeconds)}</span>
                      </div>
                      <ProgressBar value={Math.min((workSeconds / 28800) * 100, 100)} tone="success" />
                      <div className="text-[10px] text-muted mt-1">Target 8h 00m</div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-secondary font-medium">Total break time</span>
                        <span className="font-mono font-bold text-warning-600">{formatShort(breakSeconds)}</span>
                      </div>
                      <ProgressBar value={Math.min((breakSeconds / 3600) * 100, 100)} tone="warning" />
                      <div className="text-[10px] text-muted mt-1">Allowance 1h 00m</div>
                    </div>

                    <div className="border-t border-base pt-3 flex items-center justify-between">
                      <span className="text-xs text-secondary font-medium">Total on premises</span>
                      <span className="font-mono text-sm font-extrabold text-primary">
                        {formatShort(shiftSeconds)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div
                  onClick={() => setCurrentView('leave')}
                  className="surface border border-base rounded-2xl p-4 shadow-sm hover:border-accent-500 transition-all cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-xl bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center mb-3">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-extrabold text-primary">16 Days</div>
                  <div className="text-xs text-secondary mt-0.5">Annual Leave Balance</div>
                </div>

                <div
                  onClick={() => setCurrentView('attendance')}
                  className="surface border border-base rounded-2xl p-4 shadow-sm hover:border-success-500 transition-all cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-xl bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-extrabold text-success-600 dark:text-success-400">98.4%</div>
                  <div className="text-xs text-secondary mt-0.5">August Attendance</div>
                </div>

                <div
                  onClick={() => setCurrentView('payslips')}
                  className="surface border border-base rounded-2xl p-4 shadow-sm hover:border-purple-500 transition-all cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-3">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-extrabold text-primary">Aug 31</div>
                  <div className="text-xs text-secondary mt-0.5">Next Payday (5 days)</div>
                </div>

                <div
                  onClick={() => setCurrentView('leave')}
                  className="surface border border-base rounded-2xl p-4 shadow-sm hover:border-warning-500 transition-all cursor-pointer"
                >
                  <div className="h-9 w-9 rounded-xl bg-warning-50 dark:bg-warning-950/40 text-warning-600 dark:text-warning-400 flex items-center justify-center mb-3">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-extrabold text-warning-600">1 Request</div>
                  <div className="text-xs text-secondary mt-0.5">Pending Manager Sign-off</div>
                </div>
              </div>

              {/* Announcements Feed & Upcoming Reminders */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Announcements Feed (7 cols) */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                      <Bell className="h-4 w-4 text-accent-500" /> Company Announcements
                    </h3>
                    <span className="text-xs text-muted">Latest updates</span>
                  </div>

                  <div className="space-y-3">
                    {essAnnouncements.map((ann) => (
                      <Card key={ann.id} className="hover:shadow-card-hover transition-shadow">
                        <CardBody className="p-4 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <Badge tone={ann.category === 'Company' ? 'accent' : 'success'}>
                              {ann.category}
                            </Badge>
                            <span className="text-muted text-[11px]">{ann.time}</span>
                          </div>
                          <div className="text-sm font-bold text-primary">{ann.title}</div>
                          <p className="text-xs text-secondary leading-relaxed">{ann.content}</p>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Upcoming Timeline & Shift Reminders (5 cols) */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-purple-500" /> Upcoming Schedule
                    </h3>
                    <button onClick={() => setCurrentView('roster')} className="text-xs text-accent-600 font-semibold">
                      View Roster
                    </button>
                  </div>

                  <Card>
                    <CardBody className="p-4 space-y-3">
                      {[
                        { day: 'Tomorrow', title: 'Morning Shift', detail: '08:00 – 17:00 (SF HQ Room 4A)', color: 'bg-accent-500' },
                        { day: 'Friday', title: 'Remote Work Shift', detail: '09:00 – 18:00 (Home Office)', color: 'bg-success-500' },
                        { day: 'Monday, Sep 2', title: 'Labor Day Public Holiday', detail: 'All Offices Closed (Paid Off)', color: 'bg-purple-500' },
                        { day: 'Sep 2 — Sep 6', title: 'Scheduled Vacation Leave', detail: '5 days (Approved)', color: 'bg-warning-500' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 text-xs">
                          <span className={`h-2.5 w-2.5 rounded-full ${item.color} mt-1 shrink-0`} />
                          <div className="flex-1">
                            <span className="text-muted block text-[10px] uppercase font-bold">{item.day}</span>
                            <div className="font-semibold text-primary">{item.title}</div>
                            <div className="text-secondary text-[11px]">{item.detail}</div>
                          </div>
                        </div>
                      ))}
                    </CardBody>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* ================= VIEW 2: MY PROFILE (SELF-SERVICE & CHANGE REQUESTS) ================= */}
          {currentView === 'profile' && (
            <div className="space-y-6">
              {/* Profile Completion Bar */}
              <Card>
                <CardBody className="p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-primary">
                    <span className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-accent-500" /> Profile Verification & Completion
                    </span>
                    <span className="text-accent-600">{essEmployeeProfile.completionPercentage}% Complete</span>
                  </div>
                  <ProgressBar value={essEmployeeProfile.completionPercentage} tone="accent" />
                  <p className="text-[11px] text-muted">
                    Complete your emergency contact and tax exemption proofs to reach 100%.
                  </p>
                </CardBody>
              </Card>

              {/* Profile Header Card */}
              <Card>
                <CardBody className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar name={essEmployeeProfile.name} size="lg" />
                    <div>
                      <h2 className="text-xl font-bold text-primary">{essEmployeeProfile.name}</h2>
                      <div className="text-xs text-secondary mt-0.5">
                        {essEmployeeProfile.designation} · <strong>{essEmployeeProfile.department}</strong>
                      </div>
                      <div className="text-xs text-muted mt-1 font-mono">
                        {essEmployeeProfile.id} · Joined {essEmployeeProfile.joiningDate}
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setChangeField('Emergency Contact Phone');
                      setChangeOldVal('+1 (415) 555-0144');
                      setChangeNewVal('');
                      setChangeReason('');
                      setProfileChangeModal(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Request Profile Change
                  </Button>
                </CardBody>
              </Card>

              {/* Profile Information Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Personal & Employment Info */}
                <Card>
                  <CardHeader className="flex items-center justify-between pb-2">
                    <CardTitle className="text-sm font-bold">Personal & Work Profile</CardTitle>
                    <Badge tone="success">Verified</Badge>
                  </CardHeader>
                  <CardBody className="space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-base">
                      <span className="text-muted">Date of Birth:</span>
                      <span className="font-semibold text-primary">{essEmployeeProfile.personalInfo.dob}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-base">
                      <span className="text-muted">Gender / Marital:</span>
                      <span className="font-semibold text-primary">{essEmployeeProfile.personalInfo.gender} · {essEmployeeProfile.personalInfo.maritalStatus}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-base">
                      <span className="text-muted">Manager / Reporting:</span>
                      <span className="font-semibold text-primary">{essEmployeeProfile.manager}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-base">
                      <span className="text-muted">Work Office:</span>
                      <span className="font-semibold text-primary">{essEmployeeProfile.workLocation}</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted">Employment Type:</span>
                      <span className="font-semibold text-primary">{essEmployeeProfile.employmentType}</span>
                    </div>
                  </CardBody>
                </Card>

                {/* Contact & Emergency Info */}
                <Card>
                  <CardHeader className="flex items-center justify-between pb-2">
                    <CardTitle className="text-sm font-bold">Contact & Emergency Details</CardTitle>
                    <button
                      onClick={() => {
                        setChangeField('Home Address / Phone');
                        setChangeOldVal(essEmployeeProfile.contactInfo.address);
                        setChangeNewVal('');
                        setChangeReason('');
                        setProfileChangeModal(true);
                      }}
                      className="text-xs text-accent-600 font-semibold"
                    >
                      Request Edit
                    </button>
                  </CardHeader>
                  <CardBody className="space-y-3 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-base">
                      <span className="text-muted">Work Email:</span>
                      <span className="font-semibold text-primary">{essEmployeeProfile.email}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-base">
                      <span className="text-muted">Personal Phone:</span>
                      <span className="font-semibold text-primary">{essEmployeeProfile.phone}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-base">
                      <span className="text-muted">Home Address:</span>
                      <span className="font-semibold text-primary truncate max-w-[200px]">{essEmployeeProfile.contactInfo.address}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-base">
                      <span className="text-muted">Emergency Contact:</span>
                      <span className="font-semibold text-primary">{essEmployeeProfile.contactInfo.emergencyContactName} ({essEmployeeProfile.contactInfo.emergencyRelationship})</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-muted">Emergency Phone:</span>
                      <span className="font-semibold text-primary">{essEmployeeProfile.contactInfo.emergencyPhone}</span>
                    </div>
                  </CardBody>
                </Card>
              </div>

              {/* Pending Profile Change Requests */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold">My Submitted Profile Change Requests</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-[rgb(var(--bg-muted))] border-b border-base">
                      <tr>
                        <th className="text-left px-5 py-2.5 font-semibold text-secondary">Field Requested</th>
                        <th className="text-left px-5 py-2.5 font-semibold text-secondary">New Proposed Value</th>
                        <th className="text-left px-5 py-2.5 font-semibold text-secondary">Reason</th>
                        <th className="text-left px-5 py-2.5 font-semibold text-secondary">Date</th>
                        <th className="text-right px-5 py-2.5 font-semibold text-secondary">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border-base))]">
                      {pendingRequests.map((req) => (
                        <tr key={req.id}>
                          <td className="px-5 py-3 font-semibold text-primary">{req.field}</td>
                          <td className="px-5 py-3 text-primary font-medium">{req.newValue}</td>
                          <td className="px-5 py-3 text-muted">{req.reason}</td>
                          <td className="px-5 py-3 text-muted">{req.requestedAt}</td>
                          <td className="px-5 py-3 text-right">
                            <Badge tone="warning" dot>{req.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ================= VIEW 3: ATTENDANCE & TIMESHEET ================= */}
          {currentView === 'attendance' && (
            <div className="space-y-6">
              {/* Header with Quick Regularization CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-primary">My Attendance & Timesheet History</h2>
                  <p className="text-xs text-secondary">Review monthly clock logs, submit corrections, and file weekly hours.</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setRegularizeModalOpen(true)}>
                  <Clock className="h-3.5 w-3.5" /> Request Timecard Correction
                </Button>
              </div>

              {/* Monthly Calendar Heatmap */}
              <Card>
                <CardHeader className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-accent-500" />
                    <CardTitle className="text-sm">August 2024 Attendance Heatmap</CardTitle>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-success-500" /> Present (18)</span>
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-warning-500" /> Late (1)</span>
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-accent-500" /> Leave (1)</span>
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Holiday (1)</span>
                  </div>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-7 gap-1.5 text-center">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                      <span key={d} className="text-[10px] font-bold text-muted uppercase pb-1">
                        {d}
                      </span>
                    ))}

                    {/* Leading padding for Aug 1 start on Thursday */}
                    <div className="h-14 rounded-lg bg-[rgb(var(--bg-muted))]/20" />
                    <div className="h-14 rounded-lg bg-[rgb(var(--bg-muted))]/20" />
                    <div className="h-14 rounded-lg bg-[rgb(var(--bg-muted))]/20" />

                    {essMonthlyHeatmap.map((item) => {
                      const isSelected = selectedHeatmapDay?.day === item.day;
                      return (
                        <div
                          key={item.day}
                          onClick={() => setSelectedHeatmapDay(item)}
                          className={`h-14 rounded-xl border p-1.5 flex flex-col justify-between cursor-pointer transition-all ${
                            item.status === 'Present'
                              ? 'border-success-500/40 bg-success-50/20 dark:bg-success-950/20 hover:border-success-500'
                              : item.status === 'Late'
                              ? 'border-warning-500/50 bg-warning-50/30 dark:bg-warning-950/30'
                              : item.status === 'Leave'
                              ? 'border-accent-500/40 bg-accent-50/30 dark:bg-accent-950/30'
                              : item.status === 'Holiday'
                              ? 'border-purple-500/40 bg-purple-50/30 dark:bg-purple-950/30'
                              : 'border-base bg-[rgb(var(--bg-muted))]/40 opacity-60'
                          } ${isSelected ? 'ring-2 ring-accent-500 shadow-md' : ''}`}
                        >
                          <span className="text-[11px] font-bold text-primary text-left">{item.day}</span>
                          <span
                            className={`text-[9px] font-bold truncate text-right ${
                              item.status === 'Present'
                                ? 'text-success-700 dark:text-success-300'
                                : item.status === 'Late'
                                ? 'text-warning-700 dark:text-warning-300'
                                : 'text-muted'
                            }`}
                          >
                            {item.clockIn || item.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Day Detail Popover / Callout */}
                  {selectedHeatmapDay && (
                    <div className="surface border border-base rounded-xl p-3.5 mt-4 bg-accent-50/30 dark:bg-accent-950/20 flex items-center justify-between text-xs animate-fadeIn">
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-primary">
                          {selectedHeatmapDay.date} ({selectedHeatmapDay.dayName})
                        </div>
                        <Badge
                          tone={
                            selectedHeatmapDay.status === 'Present'
                              ? 'success'
                              : selectedHeatmapDay.status === 'Late'
                              ? 'warning'
                              : 'accent'
                          }
                        >
                          {selectedHeatmapDay.status}
                        </Badge>
                        {selectedHeatmapDay.clockIn && (
                          <span className="text-secondary">
                            Clock In: <strong>{selectedHeatmapDay.clockIn}</strong> · Out: <strong>{selectedHeatmapDay.clockOut}</strong> ({selectedHeatmapDay.totalHours})
                          </span>
                        )}
                        {selectedHeatmapDay.notes && (
                          <span className="text-muted italic">"{selectedHeatmapDay.notes}"</span>
                        )}
                      </div>

                      <button onClick={() => setSelectedHeatmapDay(null)} className="text-muted hover:text-primary">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Weekly Timesheet Entry Grid */}
              <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-sm font-bold">Weekly Timesheet (Aug 26 — Sep 01)</CardTitle>
                    <p className="text-xs text-secondary mt-0.5">Enter billable hours worked per project task.</p>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setTimesheetSubmitted(true)}
                  >
                    {timesheetSubmitted ? '✓ Timesheet Submitted' : 'Submit Timesheet for Approval'}
                  </Button>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-[rgb(var(--bg-muted))] border-b border-base">
                        <tr>
                          <th className="text-left px-4 py-2.5 font-semibold text-secondary">Project & Task</th>
                          <th className="text-center px-2 py-2.5 font-semibold text-secondary w-14">Mon</th>
                          <th className="text-center px-2 py-2.5 font-semibold text-secondary w-14">Tue</th>
                          <th className="text-center px-2 py-2.5 font-semibold text-secondary w-14">Wed</th>
                          <th className="text-center px-2 py-2.5 font-semibold text-secondary w-14">Thu</th>
                          <th className="text-center px-2 py-2.5 font-semibold text-secondary w-14">Fri</th>
                          <th className="text-center px-2 py-2.5 font-semibold text-secondary w-14">Sat</th>
                          <th className="text-center px-2 py-2.5 font-semibold text-secondary w-14">Sun</th>
                          <th className="text-right px-4 py-2.5 font-semibold text-secondary w-20">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgb(var(--border-base))]">
                        {timesheetRows.map((row) => {
                          const total = Object.values(row.hours).reduce((s, h) => s + h, 0);
                          return (
                            <tr key={row.id}>
                              <td className="px-4 py-3 font-semibold text-primary">
                                {row.project}
                                <div className="text-[11px] text-muted font-normal">{row.task}</div>
                              </td>
                              {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => (
                                <td key={d} className="px-1 py-2 text-center">
                                  <input
                                    type="number"
                                    min="0"
                                    max="24"
                                    step="0.5"
                                    value={row.hours[d] || ''}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setTimesheetRows((prev) =>
                                        prev.map((r) =>
                                          r.id === row.id
                                            ? { ...r, hours: { ...r.hours, [d]: val } }
                                            : r
                                        )
                                      );
                                    }}
                                    className="w-11 text-center py-1 rounded border border-base surface text-xs font-mono font-bold text-primary focus:border-accent-500 focus:outline-none"
                                  />
                                </td>
                              ))}
                              <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                                {total} hrs
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ================= VIEW 4: LEAVE APPLICATION & BALANCES ================= */}
          {currentView === 'leave' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-primary">My Leaves & Time Off</h2>
                  <p className="text-xs text-secondary">Check available allowances and submit new leave requests.</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setLeaveModalOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Apply for Leave
                </Button>
              </div>

              {/* Leave Balances Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {essLeaveBalances.map((bal) => (
                  <Card key={bal.type} className="hover:shadow-card-hover transition-shadow">
                    <CardBody className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary">{bal.type}</span>
                        <span className="text-xs font-bold text-accent-600 dark:text-accent-400">
                          {bal.available} Available
                        </span>
                      </div>
                      <ProgressBar value={(bal.used / bal.total) * 100} tone={bal.tone} />
                      <div className="flex items-center justify-between text-[11px] text-muted">
                        <span>Used: <strong>{bal.used}</strong></span>
                        <span>Pending: <strong>{bal.pending}</strong></span>
                        <span>Total: <strong>{bal.total}</strong></span>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>

              {/* My Leave Requests List with 4-Stage Stepper */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold">My Leave Applications</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-[rgb(var(--border-base))] text-xs">
                    {leaveList.map((req) => (
                      <div key={req.id} className="p-4 space-y-3 hover:bg-[rgb(var(--bg-hover))]/40 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="font-bold text-primary text-sm flex items-center gap-2">
                              {req.leaveType} ({req.days} {req.days === 1 ? 'day' : 'days'})
                              <Badge tone={req.status === 'Approved' ? 'success' : 'warning'}>
                                {req.status}
                              </Badge>
                            </div>
                            <div className="text-secondary mt-0.5">
                              {req.startDate} to {req.endDate} · Applied on {req.appliedOn}
                            </div>
                          </div>

                          {req.status === 'Manager Review' || req.status === 'Submitted' ? (
                            <Button variant="danger" size="sm" onClick={() => handleCancelLeave(req.id)}>
                              Cancel Request
                            </Button>
                          ) : null}
                        </div>

                        <p className="text-muted italic bg-[rgb(var(--bg-muted))] p-2.5 rounded-lg">
                          "{req.reason}"
                        </p>

                        {/* Visual 4-Stage Approval Stepper */}
                        <div className="flex items-center gap-2 pt-1">
                          <span className="px-2 py-0.5 rounded bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-300 font-bold text-[10px]">
                            1. Submitted
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted" />
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.status === 'Manager Review' || req.status === 'HR Review' || req.status === 'Approved'
                                ? 'bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-300'
                                : 'bg-[rgb(var(--bg-muted))] text-muted'
                            }`}
                          >
                            2. Manager Review
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted" />
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.status === 'HR Review' || req.status === 'Approved'
                                ? 'bg-success-100 dark:bg-success-950/40 text-success-700 dark:text-success-300'
                                : 'bg-[rgb(var(--bg-muted))] text-muted'
                            }`}
                          >
                            3. HR Sign-off
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted" />
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              req.status === 'Approved'
                                ? 'bg-success-600 text-white'
                                : 'bg-[rgb(var(--bg-muted))] text-muted'
                            }`}
                          >
                            4. Approved
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ================= VIEW 5: ROSTER, SHIFT SWAP & OVERTIME ================= */}
          {currentView === 'roster' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-primary">My Shift Roster & Overtime</h2>
                  <p className="text-xs text-secondary">Check weekly assigned shifts, request swaps, and claim OT hours.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setSwapModalOpen(true)}>
                    <ArrowLeftRight className="h-3.5 w-3.5" /> Request Shift Swap
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => setOtModalOpen(true)}>
                    <Clock className="h-3.5 w-3.5" /> Request Overtime
                  </Button>
                </div>
              </div>

              {/* Roster Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Assigned Weekly Roster Schedule</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  <table className="w-full text-xs">
                    <thead className="bg-[rgb(var(--bg-muted))] border-b border-base">
                      <tr>
                        <th className="text-left px-5 py-2.5 font-semibold text-secondary">Date & Day</th>
                        <th className="text-left px-5 py-2.5 font-semibold text-secondary">Shift Pattern</th>
                        <th className="text-left px-5 py-2.5 font-semibold text-secondary">Assigned Timing</th>
                        <th className="text-left px-5 py-2.5 font-semibold text-secondary">Location</th>
                        <th className="text-right px-5 py-2.5 font-semibold text-secondary">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--border-base))]">
                      {essShiftRoster.map((item) => (
                        <tr key={item.date} className="hover:bg-[rgb(var(--bg-hover))]">
                          <td className="px-5 py-3 font-semibold text-primary">
                            {item.day}
                            <span className="block text-muted font-normal text-[11px]">{item.date}</span>
                          </td>
                          <td className="px-5 py-3">
                            <Badge tone={item.shift === 'Off Day' ? 'neutral' : 'accent'}>{item.shift}</Badge>
                          </td>
                          <td className="px-5 py-3 font-mono text-primary font-medium">{item.hours}</td>
                          <td className="px-5 py-3 text-secondary">{item.location}</td>
                          <td className="px-5 py-3 text-right">
                            <Badge tone={item.shift === 'Off Day' ? 'neutral' : 'success'} dot={item.shift !== 'Off Day'}>
                              {item.shift === 'Off Day' ? 'Off' : 'Confirmed'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ================= VIEW 6: PAYSLIPS & DOCUMENTS ================= */}
          {currentView === 'payslips' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-primary">Payslips & Official Documents</h2>
                  <p className="text-xs text-secondary">Download monthly salary statements and manage verified credentials.</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setUploadDocModalOpen(true)}>
                  <Upload className="h-3.5 w-3.5" /> Upload Document
                </Button>
              </div>

              {/* Monthly Payslips List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Monthly Payslips History</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-[rgb(var(--border-base))] text-xs">
                    {[
                      { period: 'August 2024', payDate: 'Aug 31, 2024', gross: '$15,000.00', deductions: '$3,700.00', net: '$11,300.00', status: 'Settled' },
                      { period: 'July 2024', payDate: 'Jul 31, 2024', gross: '$15,000.00', deductions: '$3,700.00', net: '$11,300.00', status: 'Settled' },
                      { period: 'June 2024', payDate: 'Jun 30, 2024', gross: '$14,500.00', deductions: '$3,600.00', net: '$10,900.00', status: 'Settled' },
                    ].map((p) => (
                      <div key={p.period} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[rgb(var(--bg-hover))]/40">
                        <div>
                          <div className="font-bold text-primary text-sm">{p.period} Payslip</div>
                          <div className="text-muted text-[11px]">Disbursed on {p.payDate}</div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="text-muted block text-[10px]">Net Disbursed</span>
                            <span className="font-bold text-success-600 dark:text-success-400 text-sm">{p.net}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button variant="secondary" size="sm" onClick={() => setPayslipModalOpen(true)}>
                              <Eye className="h-3.5 w-3.5" /> View
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => alert(`Downloading PDF for ${p.period}...`)}>
                              <Download className="h-3.5 w-3.5" /> PDF
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>

              {/* My Verified Documents List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold">My Uploaded Documents & Certifications</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[rgb(var(--border-base))] text-xs">
                    {docList.map((doc) => (
                      <div key={doc.id} className="p-4 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="h-9 w-9 rounded-xl bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0 mt-0.5">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-bold text-primary text-sm">{doc.name}</div>
                            <div className="text-muted text-[11px] font-mono">{doc.fileName} ({doc.fileSize})</div>
                            {doc.expiryDate && (
                              <div className="text-warning-600 text-[11px] font-medium mt-1">
                                Expiry Date: {doc.expiryDate}
                              </div>
                            )}
                          </div>
                        </div>

                        <Badge tone={doc.status === 'Verified' ? 'success' : 'warning'} dot>
                          {doc.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ================= VIEW 7: EXPENSE CLAIMS ================= */}
          {currentView === 'expenses' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-primary">My Expense Claims & Reimbursements</h2>
                  <p className="text-xs text-secondary">Upload receipts and track approval pipeline stages.</p>
                </div>
                <Button variant="primary" size="sm" onClick={() => setExpenseModalOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Submit Expense Claim
                </Button>
              </div>

              {/* Claims List */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Submitted Claims</CardTitle>
                </CardHeader>
                <CardBody className="p-0">
                  <div className="divide-y divide-[rgb(var(--border-base))] text-xs">
                    {myClaims.map((claim) => (
                      <div key={claim.id} className="p-4 space-y-2 hover:bg-[rgb(var(--bg-hover))]/40">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono text-muted text-[11px]">{claim.claimId}</span>
                            <div className="font-bold text-primary text-sm">{claim.category}</div>
                          </div>
                          <div className="text-right">
                            <span className="text-base font-bold text-primary">${claim.amount.toFixed(2)}</span>
                            <Badge tone={claim.status === 'Reimbursed' ? 'success' : 'warning'} className="block mt-0.5">
                              {claim.status}
                            </Badge>
                          </div>
                        </div>

                        <p className="text-secondary">{claim.description}</p>

                        {/* Approval Stage Stepper */}
                        <div className="flex items-center gap-2 pt-2 border-t border-base text-[10px]">
                          <span className="font-bold text-success-600">1. Submitted</span>
                          <ArrowRight className="h-3 w-3 text-muted" />
                          <span className={claim.approvalStage !== 'Employee Submitted' ? 'font-bold text-success-600' : 'text-muted'}>
                            2. Manager Review
                          </span>
                          <ArrowRight className="h-3 w-3 text-muted" />
                          <span className={claim.approvalStage === 'Finance Approved' || claim.approvalStage === 'Reimbursed' ? 'font-bold text-success-600' : 'text-muted'}>
                            3. Finance Payout
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* ================= MOBILE BOTTOM NAVIGATION BAR ================= */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 surface border-t border-base px-2 py-1.5 flex items-center justify-around shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setCurrentView(item.key)}
              className={`flex flex-col items-center justify-center p-1 rounded-lg text-[10px] font-bold transition-colors ${
                isActive ? 'text-accent-600 dark:text-accent-400' : 'text-muted hover:text-primary'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* ================= MODAL: LEAVE APPLICATION ================= */}
      <Modal
        open={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        title="Apply for Leave"
        description="Submit time off request to your reporting manager (John Smith)."
        footer={
          <>
            <Button variant="secondary" onClick={() => setLeaveModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleApplyLeave}>
              Submit Request
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <Label>Leave Category</Label>
            <Select
              value={applyLeaveType}
              onChange={(e) => setApplyLeaveType(e.target.value as any)}
            >
              <option value="Annual Leave">Annual Leave (16 days remaining)</option>
              <option value="Sick Leave">Sick Leave (10 days remaining)</option>
              <option value="Personal Leave">Personal Leave (4 days remaining)</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={applyStartDate}
                onChange={(e) => setApplyStartDate(e.target.value)}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={applyEndDate}
                onChange={(e) => setApplyEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="surface border border-base rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="font-semibold text-primary block">Half Day Leave</span>
              <span className="text-[11px] text-muted">Deduct 0.5 day only</span>
            </div>
            <Toggle checked={applyHalfDay} onChange={() => setApplyHalfDay(!applyHalfDay)} size="sm" />
          </div>

          <div>
            <Label>Reason / Handover Note</Label>
            <Textarea
              rows={3}
              value={applyReason}
              onChange={(e) => setApplyReason(e.target.value)}
              placeholder="State purpose of leave..."
            />
          </div>
        </div>
      </Modal>

      {/* ================= MODAL: PROFILE CHANGE REQUEST ================= */}
      <Modal
        open={profileChangeModal}
        onClose={() => setProfileChangeModal(false)}
        title="Request Profile Data Update"
        description="Employee profile changes are reviewed and verified by HR Operations."
        footer={
          <>
            <Button variant="secondary" onClick={() => setProfileChangeModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleProfileChangeSubmit}>
              Submit for Approval
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <Label>Field to Update</Label>
            <Select
              value={changeField}
              onChange={(e) => {
                setChangeField(e.target.value);
                setChangeOldVal(
                  e.target.value.includes('Phone') ? '+1 (415) 555-0144' : '450 Mission Street, Apt 18B'
                );
              }}
            >
              <option>Emergency Contact Phone</option>
              <option>Residential Address</option>
              <option>Marital Status</option>
              <option>Bank Account Number</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Current Value (Read Only)</Label>
              <Input value={changeOldVal} disabled className="bg-[rgb(var(--bg-muted))]" />
            </div>
            <div>
              <Label>New Requested Value</Label>
              <Input
                value={changeNewVal}
                onChange={(e) => setChangeNewVal(e.target.value)}
                placeholder="Enter new data..."
              />
            </div>
          </div>

          <div>
            <Label>Reason for Update</Label>
            <Input
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="e.g. Changed mobile number / moved apartment"
            />
          </div>

          {changeSuccess && (
            <div className="p-3 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-700 dark:text-success-300 font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Change request submitted to HR!
            </div>
          )}
        </div>
      </Modal>

      {/* ================= MODAL: TIMECARD CORRECTION ================= */}
      <Modal
        open={regularizeModalOpen}
        onClose={() => setRegularizeModalOpen(false)}
        title="Request Timecard Correction"
        description="Submit regularized clock-in/out for manager approval."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRegularizeModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleApplyRegularization}>
              Submit Correction
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <Label>Date</Label>
            <Input type="date" value={regDate} onChange={(e) => setRegDate(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Actual Recorded In</Label>
              <Input value={regActualIn} onChange={(e) => setRegActualIn(e.target.value)} />
            </div>
            <div>
              <Label>Corrected In Time</Label>
              <Input value={regCorrectedIn} onChange={(e) => setRegCorrectedIn(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Reason / Justification</Label>
            <Textarea
              rows={3}
              value={regReason}
              onChange={(e) => setRegReason(e.target.value)}
              placeholder="Forgot to tap badge / biometric terminal issue..."
            />
          </div>
        </div>
      </Modal>

      {/* ================= MODAL: SHIFT SWAP ================= */}
      <Modal
        open={swapModalOpen}
        onClose={() => setSwapModalOpen(false)}
        title="Request Shift Swap"
        description="Exchange assigned shift schedule with a department colleague."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSwapModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                alert('Shift swap proposal dispatched to colleague for confirmation!');
                setSwapModalOpen(false);
              }}
            >
              Send Swap Request
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <Label>Select Colleague</Label>
            <Select value={swapColleague} onChange={(e) => setSwapColleague(e.target.value)}>
              <option>Lisa Wang (Engineering)</option>
              <option>Nina Garcia (QA)</option>
              <option>James Park (Engineering)</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>My Shift Date</Label>
              <Input type="date" value={swapMyDate} onChange={(e) => setSwapMyDate(e.target.value)} />
            </div>
            <div>
              <Label>Colleague's Shift Date</Label>
              <Input type="date" value={swapTheirDate} onChange={(e) => setSwapTheirDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Reason for Swap</Label>
            <Input
              value={swapReason}
              onChange={(e) => setSwapReason(e.target.value)}
              placeholder="e.g. Doctor appointment on Wednesday"
            />
          </div>
        </div>
      </Modal>

      {/* ================= MODAL: OVERTIME REQUEST ================= */}
      <Modal
        open={otModalOpen}
        onClose={() => setOtModalOpen(false)}
        title="Request Pre-Approved Overtime"
        description="Submit planned overtime hours for manager sign-off."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOtModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                alert('Overtime request submitted!');
                setOtModalOpen(false);
              }}
            >
              Submit Overtime
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Overtime Date</Label>
              <Input type="date" value={otDate} onChange={(e) => setOtDate(e.target.value)} />
            </div>
            <div>
              <Label>Estimated Hours</Label>
              <Input type="number" step="0.5" value={otHours} onChange={(e) => setOtHours(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Reason / Deliverable Justification</Label>
            <Textarea
              rows={3}
              value={otReason}
              onChange={(e) => setOtReason(e.target.value)}
              placeholder="State release deadline or incident response..."
            />
          </div>
        </div>
      </Modal>

      {/* ================= MODAL: PAYSLIP PREVIEW ================= */}
      <Modal
        open={payslipModalOpen}
        onClose={() => setPayslipModalOpen(false)}
        title={`Payslip: ${samplePayslip.period}`}
        description={`Employee: ${samplePayslip.employeeName} (${samplePayslip.employeeId})`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPayslipModalOpen(false)}>
              Close
            </Button>
            <Button variant="primary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print / Save PDF
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="surface border border-base rounded-xl p-4 space-y-3">
            <div className="flex justify-between font-bold text-sm text-primary border-b border-base pb-2">
              <span>Gross Earnings:</span>
              <span className="text-success-600">${samplePayslip.grossEarnings.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-sm text-primary border-b border-base pb-2">
              <span>Total Deductions & Tax:</span>
              <span className="text-error-600">-${samplePayslip.totalDeductions.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-bold text-base text-primary bg-success-50 dark:bg-success-950/40 p-3 rounded-lg">
              <span>Net Take-Home Pay:</span>
              <span className="text-success-700 dark:text-success-300 font-extrabold text-lg">
                ${samplePayslip.netPay.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      {/* ================= MODAL: SUBMIT EXPENSE CLAIM ================= */}
      <Modal
        open={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        title="Submit Expense Claim"
        description="Upload official receipt and submit for reimbursement."
        footer={
          <>
            <Button variant="secondary" onClick={() => setExpenseModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateExpense}>
              Submit Claim
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={expCategory} onChange={(e) => setExpCategory(e.target.value as any)}>
                <option value="Meals & Entertainment">Meals & Entertainment</option>
                <option value="Travel & Accommodation">Travel & Accommodation</option>
                <option value="Software & Subscriptions">Software & Subscriptions</option>
                <option value="Equipment & Hardware">Equipment & Hardware</option>
              </Select>
            </div>
            <div>
              <Label>Claim Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                value={expAmount}
                onChange={(e) => setExpAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <Label>Description / Business Context</Label>
            <Textarea
              rows={2}
              value={expDesc}
              onChange={(e) => setExpDesc(e.target.value)}
              placeholder="State client, project, or purpose..."
            />
          </div>

          <div className="border-2 border-dashed border-base rounded-xl p-4 text-center space-y-1">
            <Upload className="h-5 w-5 text-accent-500 mx-auto" />
            <span className="font-semibold text-primary block text-[11px]">Upload Receipt (PDF / Image)</span>
            <span className="text-muted text-[10px]">receipt_aug26.pdf (Ready to upload)</span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
