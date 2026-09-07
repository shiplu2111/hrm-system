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
  LifeBuoy,
} from 'lucide-react';
import type {
  AttendanceDayRecord,
  EmployeeRecord,
  LeaveBalanceRecord,
  LeaveRequestRecord,
  LeaveTypeRecord,
  RosterRecord,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
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
  getEmployeeDashboard,
  getEmployeeProfile,
  getLeaveBalances,
  listLeaveRequests,
  listLeaveTypes,
  listRosters,
} from '@/lib/ess-api';
import { EmployeeDashboardHome } from '@/components/ess/EmployeeDashboardHome';
import { HelpSupportView } from '@/components/ess/HelpSupportView';
import { HelpWidget } from '@/components/support/HelpWidget';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import type { EmployeeDashboardView } from '@hrm/shared-types';

type EssView = 'home' | 'profile' | 'attendance' | 'leave' | 'roster' | 'help';

function formatTime(iso: string | null, emDash: string): string {
  if (!iso) return emDash;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function displayClock(
  attendance: AttendanceDayRecord | null,
  field: 'clockInAt' | 'clockOutAt',
  emDash: string,
): string {
  const display = attendance?.display?.[field];
  if (display) return display;
  return formatTime(attendance?.[field] ?? null, emDash);
}

function displayShiftRange(
  record: { display?: RosterRecord['display']; shift?: RosterRecord['shift'] } | null | undefined,
  emDash: string,
): string {
  if (record?.display) {
    return `${record.display.shiftStartTime} – ${record.display.shiftEndTime}`;
  }
  if (record?.shift) {
    return `${record.shift.startTime} – ${record.shift.endTime}`;
  }
  return emDash;
}

export function ESSPortalPage({ onLogout }: { onLogout: () => void }) {
  const { t } = useAppTranslation();
  const emDash = t('common.emDash');
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const employeeId = user?.employeeId ?? null;

  const navItems = useMemo(
    () =>
      [
        { key: 'home' as const, label: t('nav.home'), icon: Home },
        { key: 'profile' as const, label: t('nav.profile'), icon: User },
        { key: 'attendance' as const, label: t('nav.attendance'), icon: Clock },
        { key: 'leave' as const, label: t('nav.leave'), icon: CalendarDays },
        { key: 'roster' as const, label: t('nav.roster'), icon: Calendar },
        { key: 'help' as const, label: t('nav.help'), icon: LifeBuoy },
      ] satisfies { key: EssView; label: string; icon: typeof Home }[],
    [t],
  );

  const [view, setView] = useState<EssView>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<EmployeeRecord | null>(null);
  const [dashboard, setDashboard] = useState<EmployeeDashboardView | null>(null);
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
      setError(t('errors.notLinked'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const emp = await getEmployeeProfile(employeeId);
      const today = new Date().toISOString().slice(0, 10);
      const from = today;
      const toDate = new Date();
      toDate.setDate(toDate.getDate() + 14);
      const to = toDate.toISOString().slice(0, 10);

      const [dash, bal, reqs, types, rosterRows] = await Promise.all([
        getEmployeeDashboard(employeeId),
        getLeaveBalances(employeeId),
        listLeaveRequests(emp.companyId, employeeId),
        listLeaveTypes(emp.companyId),
        listRosters(emp.companyId, employeeId, { from, to }),
      ]);
      setProfile(emp);
      setDashboard(dash);
      setAttendance(dash.attendance);
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
      setError(e instanceof ApiError ? e.message : t('errors.loadEmployeeData'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, leaveTypeId, onLogout, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      if (dashboard) {
        setDashboard({ ...dashboard, attendance: record });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t('errors.attendanceAction'));
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
      setError(e instanceof ApiError ? e.message : t('errors.submitLeave'));
    } finally {
      setActionLoading(false);
    }
  }

  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : user?.email ?? t('portal.employeeFallback');

  const attendanceStatus = attendance?.status;
  const attendanceStatusLabel = attendanceStatus
    ? t(`attendance.statusValue.${attendanceStatus}`, {
        defaultValue: attendanceStatus.replace('_', ' '),
      })
    : emDash;

  return (
    <div className="min-h-screen bg-[rgb(var(--bg-base))] flex">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 border-r border-base surface transform transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-base flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-primary">{t('portal.title')}</div>
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
          <LanguageSwitcher />
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full text-xs text-muted hover:text-primary"
          >
            {t('common.theme', { theme })}
          </button>
          <Button variant="secondary" className="w-full" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> {t('common.signOut')}
          </Button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label={t('common.closeMenu')}
        />
      )}

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 border-b border-base surface px-4 py-3 flex items-center gap-3">
          <button type="button" className="lg:hidden text-muted" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold text-primary">{t(`nav.${view}`)}</h1>
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
              {view === 'home' && dashboard ? (
                <EmployeeDashboardHome
                  dashboard={dashboard}
                  actionLoading={actionLoading}
                  onClockIn={() => void runAttendanceAction('clock-in')}
                  onClockOut={() => void runAttendanceAction('clock-out')}
                  onBreakStart={() => void runAttendanceAction('break-start')}
                  onBreakEnd={() => void runAttendanceAction('break-end')}
                />
              ) : null}

              {view === 'home' && !dashboard ? (
                <p className="text-sm text-muted">{t('dashboard.unavailable')}</p>
              ) : null}

              {view === 'home' ? null : (
                <>
              {view === 'profile' && profile && (
                <Card>
                  <CardBody className="flex items-start gap-4">
                    <Avatar name={displayName} size="lg" />
                    <div className="space-y-2 text-sm">
                      <div className="text-lg font-semibold text-primary">{displayName}</div>
                      <div className="text-muted">{profile.employeeNumber}</div>
                      <div>
                        {t('profile.status')}{' '}
                        <span className="capitalize">{profile.employmentStatus}</span>
                      </div>
                      <div>{t('profile.hireDate')} {profile.hireDate}</div>
                      {profile.personalInfo?.contact?.email && (
                        <div>{t('profile.email')} {profile.personalInfo.contact.email}</div>
                      )}
                    </div>
                  </CardBody>
                </Card>
              )}

              {view === 'attendance' && (
                <Card>
                  <CardHeader><CardTitle>{t('dashboard.clockInOut')}</CardTitle></CardHeader>
                  <CardBody className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        {t('attendance.status')}{' '}
                        <Badge tone="accent" className="capitalize">{attendanceStatusLabel}</Badge>
                      </div>
                      <div>{t('attendance.in')} {displayClock(attendance, 'clockInAt', emDash)}</div>
                      <div>{t('attendance.out')} {displayClock(attendance, 'clockOutAt', emDash)}</div>
                      <div>
                        {t('attendance.worked')}{' '}
                        {attendance ? formatAttendanceMinutes(attendance.metrics.netMinutes) : emDash}
                      </div>
                      <div>
                        {t('attendance.break')}{' '}
                        {attendance ? formatAttendanceMinutes(attendance.metrics.breakMinutes) : emDash}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="primary" disabled={actionLoading} onClick={() => void runAttendanceAction('clock-in')}>
                        <LogIn className="h-4 w-4" /> {t('dashboard.clockInAction')}
                      </Button>
                      <Button variant="secondary" disabled={actionLoading} onClick={() => void runAttendanceAction('clock-out')}>
                        <LogOutIcon className="h-4 w-4" /> {t('dashboard.clockOutAction')}
                      </Button>
                      <Button variant="secondary" disabled={actionLoading} onClick={() => void runAttendanceAction('break-start')}>
                        <Coffee className="h-4 w-4" /> {t('dashboard.breakStart')}
                      </Button>
                      <Button variant="secondary" disabled={actionLoading} onClick={() => void runAttendanceAction('break-end')}>
                        <Coffee className="h-4 w-4" /> {t('dashboard.breakEnd')}
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              )}

              {view === 'leave' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-sm font-semibold text-primary">{t('leave.balances')}</h2>
                    <Button variant="primary" size="sm" onClick={() => setLeaveModalOpen(true)}>
                      <Plus className="h-4 w-4" /> {t('leave.requestLeave')}
                    </Button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {balances.map((bal) => (
                      <Card key={bal.id}>
                        <CardBody className="text-sm">
                          <div className="font-medium">{bal.leaveTypeName ?? t('dashboard.leaveFallback')}</div>
                          <div className="text-muted mt-1">
                            {t('common.daysRemaining', {
                              balance: bal.balanceDays.toFixed(1),
                              entitlement: bal.entitlementDays,
                            })}
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                  <Card>
                    <CardHeader><CardTitle>{t('leave.myRequests')}</CardTitle></CardHeader>
                    <CardBody className="divide-y divide-[rgb(var(--border-base))]">
                      {requests.length === 0 ? (
                        <p className="text-sm text-muted">{t('leave.noRequests')}</p>
                      ) : (
                        requests.map((req) => (
                          <div key={req.id} className="py-3 flex justify-between gap-3 text-sm">
                            <div>
                              <div className="font-medium">{req.leaveTypeName ?? t('dashboard.leaveFallback')}</div>
                              <div className="text-muted">
                                {t('common.dateRange', { start: req.startDate, end: req.endDate })}
                              </div>
                            </div>
                            <Badge tone={req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'error' : 'warning'} className="capitalize shrink-0">
                              {t(`leave.status.${req.status}`, { defaultValue: req.status })}
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
                  <CardHeader><CardTitle>{t('roster.title')}</CardTitle></CardHeader>
                  <CardBody className="divide-y divide-[rgb(var(--border-base))]">
                    {rosters.length === 0 ? (
                      <p className="text-sm text-muted">{t('roster.empty')}</p>
                    ) : (
                      rosters.map((r) => (
                        <div key={r.id} className="py-3 flex justify-between text-sm">
                          <span className="font-medium">{r.date}</span>
                          <span className="text-secondary">
                            {r.shift?.name ?? t('attendance.shiftFallback')} ({displayShiftRange(r, emDash)})
                          </span>
                        </div>
                      ))
                    )}
                  </CardBody>
                </Card>
              )}

              {view === 'help' && <HelpSupportView />}
                </>
              )}
            </>
          )}
        </div>
      </main>

      <Modal
        open={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        title={t('leave.modalTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setLeaveModalOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={actionLoading} onClick={() => void submitLeaveRequest()}>
              {t('common.submit')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>{t('leave.leaveType')}</Label>
            <Select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
              {leaveTypes.map((leaveType) => (
                <option key={leaveType.id} value={leaveType.id}>{leaveType.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t('leave.startDate')}</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label>{t('leave.endDate')}</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <Label>{t('leave.reason')}</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
        </div>
      </Modal>
      <HelpWidget />
    </div>
  );
}
