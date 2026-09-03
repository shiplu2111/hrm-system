import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Home,
  User,
  Clock,
  CalendarDays,
  Calendar,
  LogOut,
  Loader2,
  LogIn,
  LogOut as LogOutIcon,
  Coffee,
  Plus,
  Menu,
  X,
} from 'lucide-react';
import type {
  AttendanceDayRecord,
  EmployeeRecord,
  LeaveBalanceRecord,
  LeaveRequestRecord,
  LeaveTypeRecord,
  RosterRecord,
} from '@hrm/shared-types';
import {
  ApiError,
  useAuth,
  useTheme,
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
} from '@hrm/portal-ui';
import {
  breakEnd,
  breakStart,
  clockIn,
  clockOut,
  createLeaveRequest,
  formatAttendanceMinutes,
  getAttendanceToday,
  getEmployeeProfile,
  getLeaveBalances,
  listLeaveRequests,
  listLeaveTypes,
  listRosters,
} from '@/lib/ess-api';

type EssView = 'home' | 'profile' | 'attendance' | 'leave' | 'roster';

const navItems: { key: EssView; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'profile', label: 'My Profile', icon: User },
  { key: 'attendance', label: 'Attendance', icon: Clock },
  { key: 'leave', label: 'Leave', icon: CalendarDays },
  { key: 'roster', label: 'Roster', icon: Calendar },
];

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ESSPortalPage({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const employeeId = user?.employeeId ?? null;

  const [view, setView] = useState<EssView>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<EmployeeRecord | null>(null);
  const [attendance, setAttendance] = useState<AttendanceDayRecord | null>(null);
  const [balances, setBalances] = useState<LeaveBalanceRecord[]>([]);
  const [requests, setRequests] = useState<LeaveRequestRecord[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRecord[]>([]);
  const [rosters, setRosters] = useState<RosterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

  const refresh = useCallback(async () => {
    if (!employeeId) {
      setError('Your account is not linked to an employee record.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const emp = await getEmployeeProfile(employeeId);
      setProfile(emp);
      const today = new Date().toISOString().slice(0, 10);
      const from = today;
      const toDate = new Date();
      toDate.setDate(toDate.getDate() + 14);
      const to = toDate.toISOString().slice(0, 10);

      const [att, bal, reqs, types, rosterRows] = await Promise.all([
        getAttendanceToday(employeeId),
        getLeaveBalances(employeeId),
        listLeaveRequests(emp.companyId, employeeId),
        listLeaveTypes(emp.companyId),
        listRosters(emp.companyId, employeeId, { from, to }),
      ]);
      setAttendance(att);
      setBalances(bal);
      setRequests(reqs);
      setLeaveTypes(types);
      setRosters(rosterRows);
      if (!leaveTypeId && types[0]) setLeaveTypeId(types[0].id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        onLogout();
        return;
      }
      setError(e instanceof ApiError ? e.message : 'Failed to load employee data');
    } finally {
      setLoading(false);
    }
  }, [employeeId, leaveTypeId, onLogout]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const pendingLeave = useMemo(
    () => requests.filter((r) => r.status === 'pending').length,
    [requests],
  );

  async function runAttendanceAction(
    action: 'clock-in' | 'clock-out' | 'break-start' | 'break-end',
  ) {
    if (!employeeId) return;
    setActionLoading(true);
    setError(null);
    try {
      const payload = { source: 'manual' as const };
      let record: AttendanceDayRecord;
      switch (action) {
        case 'clock-in':
          record = await clockIn(employeeId, payload);
          break;
        case 'clock-out':
          record = await clockOut(employeeId, payload);
          break;
        case 'break-start':
          record = await breakStart(employeeId, payload);
          break;
        case 'break-end':
          record = await breakEnd(employeeId, payload);
          break;
      }
      setAttendance(record);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Attendance action failed');
    } finally {
      setActionLoading(false);
    }
  }

  async function submitLeaveRequest() {
    if (!employeeId || !leaveTypeId || !startDate || !endDate) return;
    setActionLoading(true);
    setError(null);
    try {
      await createLeaveRequest(employeeId, {
        leaveTypeId,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
        submit: true,
      });
      setLeaveModalOpen(false);
      setReason('');
      await refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to submit leave request');
    } finally {
      setActionLoading(false);
    }
  }

  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : user?.email ?? 'Employee';

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))] flex">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 border-r border-base surface transform transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-base flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-primary">Employee Portal</div>
            <div className="text-xs text-muted truncate">{displayName}</div>
          </div>
          <button type="button" className="lg:hidden text-muted" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-2 space-y-1">
          {navItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setView(key);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                view === key
                  ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300'
                  : 'text-secondary hover:bg-[rgb(var(--bg-hover))]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 inset-x-0 p-4 border-t border-base space-y-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full text-xs text-muted hover:text-primary"
          >
            Theme: {theme}
          </button>
          <Button variant="secondary" className="w-full" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 border-b border-base surface px-4 py-3 flex items-center gap-3">
          <button type="button" className="lg:hidden text-muted" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-primary capitalize">{view}</h1>
          {user?.roleName && (
            <Badge tone="neutral" className="ml-auto">{user.roleName}</Badge>
          )}
        </header>

        <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
          {error && (
            <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted" />
            </div>
          ) : (
            <>
              {view === 'home' && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader><CardTitle>Today&apos;s attendance</CardTitle></CardHeader>
                    <CardBody className="text-sm space-y-1">
                      <div>Status: <Badge tone="accent" className="capitalize">{attendance?.status ?? '—'}</Badge></div>
                      <div>Clock in: {formatTime(attendance?.clockInAt ?? null)}</div>
                      <div>Worked: {attendance ? formatAttendanceMinutes(attendance.metrics.netMinutes) : '—'}</div>
                    </CardBody>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>Leave</CardTitle></CardHeader>
                    <CardBody className="text-sm space-y-1">
                      <div>{pendingLeave} pending request{pendingLeave === 1 ? '' : 's'}</div>
                      <div>{balances.length} balance type{balances.length === 1 ? '' : 's'} tracked</div>
                    </CardBody>
                  </Card>
                  <Card className="sm:col-span-2">
                    <CardHeader><CardTitle>Upcoming roster</CardTitle></CardHeader>
                    <CardBody className="text-sm space-y-2">
                      {rosters.length === 0 ? (
                        <p className="text-muted">No roster assignments in the next two weeks.</p>
                      ) : (
                        rosters.slice(0, 5).map((r) => (
                          <div key={r.id} className="flex justify-between">
                            <span>{r.date}</span>
                            <span className="text-secondary">{r.shift?.name ?? 'Shift'}</span>
                          </div>
                        ))
                      )}
                    </CardBody>
                  </Card>
                </div>
              )}

              {view === 'profile' && profile && (
                <Card>
                  <CardBody className="flex items-start gap-4">
                    <Avatar name={displayName} size="lg" />
                    <div className="space-y-2 text-sm">
                      <div className="text-lg font-semibold text-primary">{displayName}</div>
                      <div className="text-muted">{profile.employeeNumber}</div>
                      <div>Status: <span className="capitalize">{profile.employmentStatus}</span></div>
                      <div>Hire date: {profile.hireDate}</div>
                      {profile.personalInfo?.contact?.email && (
                        <div>Email: {profile.personalInfo.contact.email}</div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              )}

              {view === 'attendance' && (
                <Card>
                  <CardHeader><CardTitle>Clock in / out</CardTitle></CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div>Status: <Badge tone="accent" className="capitalize">{attendance?.status ?? '—'}</Badge></div>
                      <div>In: {formatTime(attendance?.clockInAt ?? null)}</div>
                      <div>Out: {formatTime(attendance?.clockOutAt ?? null)}</div>
                      <div>Worked: {attendance ? formatAttendanceMinutes(attendance.metrics.netMinutes) : '—'}</div>
                      <div>Break: {attendance ? formatAttendanceMinutes(attendance.metrics.breakMinutes) : '—'}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="primary" disabled={actionLoading} onClick={() => void runAttendanceAction('clock-in')}>
                        <LogIn className="h-4 w-4" /> Clock In
                      </Button>
                      <Button variant="secondary" disabled={actionLoading} onClick={() => void runAttendanceAction('clock-out')}>
                        <LogOutIcon className="h-4 w-4" /> Clock Out
                      </Button>
                      <Button variant="secondary" disabled={actionLoading} onClick={() => void runAttendanceAction('break-start')}>
                        <Coffee className="h-4 w-4" /> Break Start
                      </Button>
                      <Button variant="secondary" disabled={actionLoading} onClick={() => void runAttendanceAction('break-end')}>
                        <Coffee className="h-4 w-4" /> Break End
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              )}

              {view === 'leave' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-semibold text-primary">Leave balances</h2>
                    <Button variant="primary" size="sm" onClick={() => setLeaveModalOpen(true)}>
                      <Plus className="h-4 w-4" /> Request leave
                    </Button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {balances.map((bal) => (
                      <Card key={bal.id}>
                        <CardBody className="text-sm">
                          <div className="font-medium">{bal.leaveTypeName ?? 'Leave'}</div>
                          <div className="text-muted mt-1">
                            {bal.balanceDays.toFixed(1)} / {bal.entitlementDays} days remaining
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                  <Card>
                    <CardHeader><CardTitle>My requests</CardTitle></CardHeader>
                    <CardBody className="divide-y divide-[rgb(var(--border-base))]">
                      {requests.length === 0 ? (
                        <p className="text-sm text-muted">No leave requests yet.</p>
                      ) : (
                        requests.map((req) => (
                          <div key={req.id} className="py-3 flex justify-between gap-3 text-sm">
                            <div>
                              <div className="font-medium">{req.leaveTypeName ?? 'Leave'}</div>
                              <div className="text-muted">{req.startDate} → {req.endDate}</div>
                            </div>
                            <Badge tone={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'error' : 'warning'} className="capitalize shrink-0">
                              {req.status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </CardBody>
                  </Card>
                </div>
              )}

              {view === 'roster' && (
                <Card>
                  <CardHeader><CardTitle>My roster (next 14 days)</CardTitle></CardHeader>
                  <CardBody className="divide-y divide-[rgb(var(--border-base))]">
                    {rosters.length === 0 ? (
                      <p className="text-sm text-muted">No shifts assigned.</p>
                    ) : (
                      rosters.map((r) => (
                        <div key={r.id} className="py-3 flex justify-between text-sm">
                          <span className="font-medium">{r.date}</span>
                          <span className="text-secondary">
                            {r.shift?.name ?? 'Shift'} ({r.shift?.startTime}–{r.shift?.endTime})
                          </span>
                        </div>
                      ))
                    )}
                  </CardBody>
                </Card>
              )}
            </>
          )}
        </div>
      </main>

      <Modal
        open={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        title="Request leave"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLeaveModalOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={actionLoading} onClick={() => void submitLeaveRequest()}>
              Submit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Leave type</Label>
            <Select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>End date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
