import { useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
  Users,
  Building,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { paySchedules, payrollPeriods, type PaySchedule } from '@/data/payrollData';

export function PaySchedulePage() {
  const [schedules, setSchedules] = useState<PaySchedule[]>(paySchedules);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<PaySchedule | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<PaySchedule['frequency']>('Monthly');
  const [cutOffDay, setCutOffDay] = useState('25th of month');
  const [paymentDay, setPaymentDay] = useState('Last working day');
  const [currency, setCurrency] = useState('USD ($)');
  const [autoProcess, setAutoProcess] = useState(true);

  const openCreateModal = () => {
    setEditingSchedule(null);
    setName('');
    setFrequency('Monthly');
    setCutOffDay('25th of month');
    setPaymentDay('Last working day');
    setCurrency('USD ($)');
    setAutoProcess(true);
    setModalOpen(true);
  };

  const openEditModal = (sch: PaySchedule) => {
    setEditingSchedule(sch);
    setName(sch.name);
    setFrequency(sch.frequency);
    setCutOffDay(sch.cutOffDay);
    setPaymentDay(sch.paymentDay);
    setCurrency(sch.currency);
    setAutoProcess(sch.autoProcess);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    if (editingSchedule) {
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === editingSchedule.id
            ? { ...s, name, frequency, cutOffDay, paymentDay, currency, autoProcess }
            : s
        )
      );
    } else {
      const newSch: PaySchedule = {
        id: `ps-${Date.now()}`,
        name,
        frequency,
        cutOffDay,
        paymentDay,
        autoProcess,
        employeesCount: 0,
        currency,
        status: 'Active',
      };
      setSchedules((prev) => [...prev, newSch]);
    }
    setModalOpen(false);
  };

  const toggleStatus = (id: string) => {
    setSchedules((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, status: s.status === 'Active' ? 'Inactive' : 'Active' }
          : s
      )
    );
  };

  const deleteSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Pay Schedules & Payroll Calendar</h1>
          <p className="text-sm text-secondary mt-0.5">
            Configure pay frequencies, cut-off milestones, and disbursement cycles across employee groups.
          </p>
        </div>
        <Button variant="primary" onClick={openCreateModal}>
          <Plus className="h-4 w-4" /> Create Pay Schedule
        </Button>
      </div>

      {/* KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{schedules.length}</div>
            <div className="text-xs text-secondary">Active Pay Schedules</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {schedules.reduce((s, x) => s + x.employeesCount, 0)}
            </div>
            <div className="text-xs text-secondary">Covered Employees</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">Aug 25</div>
            <div className="text-xs text-secondary">Next Cut-off Milestone</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">Aug 31</div>
            <div className="text-xs text-secondary">Next Pay Disbursement</div>
          </div>
        </div>
      </div>

      {/* Pay Schedules Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schedules.map((sch) => (
          <Card key={sch.id} className="hover:shadow-card-hover transition-shadow">
            <CardHeader className="flex items-start justify-between pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold">{sch.name}</CardTitle>
                  <Badge tone={sch.status === 'Active' ? 'success' : 'neutral'} dot>
                    {sch.status}
                  </Badge>
                </div>
                <div className="text-xs text-secondary mt-1 flex items-center gap-2">
                  <span>Currency: <strong className="text-primary font-medium">{sch.currency}</strong></span>
                  <span>·</span>
                  <span>Frequency: <strong className="text-primary font-medium">{sch.frequency}</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditModal(sch)}
                  className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))] transition-colors"
                  title="Edit Schedule"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deleteSchedule(sch.id)}
                  className="p-1.5 rounded-lg text-secondary hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-950/40 transition-colors"
                  title="Delete Schedule"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </CardHeader>

            <CardBody className="space-y-4 pt-0">
              {/* Timeline Milestones */}
              <div className="surface border border-base rounded-xl p-3 space-y-2">
                <div className="text-[11px] font-semibold text-muted uppercase tracking-wider">
                  Monthly Cycle Milestones
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-secondary block">Attendance & Leave Cut-Off:</span>
                    <span className="font-semibold text-primary">{sch.cutOffDay}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Salary Pay Date:</span>
                    <span className="font-semibold text-success-600 dark:text-success-400">{sch.paymentDay}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-base text-xs">
                <div className="flex items-center gap-2 text-secondary">
                  <Users className="h-4 w-4 text-muted" />
                  <span>Enrolled Staff: <strong className="text-primary font-medium">{sch.employeesCount}</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted">Auto-Calculate:</span>
                  <Toggle
                    checked={sch.autoProcess}
                    onChange={() => {
                      setSchedules((prev) =>
                        prev.map((s) =>
                          s.id === sch.id ? { ...s, autoProcess: !s.autoProcess } : s
                        )
                      );
                    }}
                    size="sm"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Payroll Period Calendar & History */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>Payroll Periods & Cut-off Calendar</CardTitle>
            <p className="text-xs text-secondary mt-0.5">
              Historical and scheduled pay cycles with processing status.
            </p>
          </div>
          <Badge tone="neutral">{payrollPeriods.length} cycles recorded</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Period Name
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Period Span
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Cut-off Date
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Disbursal Date
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Employees
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Net Payout
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {payrollPeriods.map((period) => (
                  <tr key={period.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-primary">
                      {period.periodName}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-secondary">
                      {period.startDate} to {period.endDate}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-primary font-medium">
                      {period.cutOffDate}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-success-600 dark:text-success-400 font-medium">
                      {period.payDate}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-secondary">
                      {period.employeeCount} staff
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-primary text-xs">
                      ${period.totalNet.toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        tone={
                          period.status === 'Paid'
                            ? 'success'
                            : period.status === 'Approved'
                            ? 'accent'
                            : period.status === 'Draft'
                            ? 'warning'
                            : 'neutral'
                        }
                        dot
                      >
                        {period.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSchedule ? 'Edit Pay Schedule' : 'Create New Pay Schedule'}
        description="Set up recurring salary periods, frequency, and disbursement milestones."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {editingSchedule ? 'Save Changes' : 'Create Schedule'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Schedule Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. US Regular Monthly Payroll"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Pay Frequency</Label>
              <Select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as PaySchedule['frequency'])}
              >
                <option value="Monthly">Monthly</option>
                <option value="Bi-Weekly">Bi-Weekly</option>
                <option value="Weekly">Weekly</option>
                <option value="Semi-Monthly">Semi-Monthly</option>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD ($)">USD ($)</option>
                <option value="GBP (£)">GBP (£)</option>
                <option value="EUR (€)">EUR (€)</option>
                <option value="CAD ($)">CAD ($)</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Attendance / Leave Cut-Off</Label>
              <Select value={cutOffDay} onChange={(e) => setCutOffDay(e.target.value)}>
                <option value="20th of month">20th of month</option>
                <option value="25th of month">25th of month</option>
                <option value="Last day of month">Last day of month</option>
                <option value="Alternate Thursdays">Alternate Thursdays</option>
              </Select>
            </div>
            <div>
              <Label>Payment / Disbursal Day</Label>
              <Select value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)}>
                <option value="Last working day">Last working day</option>
                <option value="28th of month">28th of month</option>
                <option value="1st of next month">1st of next month</option>
                <option value="Following Friday">Following Friday</option>
              </Select>
            </div>
          </div>

          <div className="surface border border-base rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-primary">Automatic Computation Engine</div>
              <div className="text-[11px] text-secondary">
                Auto-sync attendance and calculate gross-to-net at 00:00 on cut-off day.
              </div>
            </div>
            <Toggle checked={autoProcess} onChange={() => setAutoProcess(!autoProcess)} size="sm" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

