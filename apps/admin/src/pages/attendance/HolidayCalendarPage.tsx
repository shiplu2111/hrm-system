import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import type { HolidayEntry, HolidayRecord } from '@hrm/shared-types';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { CompanySelector } from '@/components/org/CompanySelector';
import { PageErrorState, PageLoadingState } from '@/components/org/PageState';
import { useCompany } from '@/context/CompanyContext';
import {
  createHoliday,
  deleteHoliday,
  listHolidays,
  resolveHolidayCalendar,
} from '@/lib/roster-api';
import { ApiError } from '@/lib/tenant-api-client';

const scopeTone: Record<string, 'accent' | 'success' | 'warning' | 'error' | 'neutral'> = {
  country: 'accent',
  state: 'warning',
  company: 'success',
  branch: 'error',
  employee: 'neutral',
};

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function HolidayCalendarPage() {
  const { companyId, loading: companyLoading, error: companyError } = useCompany();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [entries, setEntries] = useState<HolidayEntry[]>([]);
  const [tenantHolidays, setTenantHolidays] = useState<HolidayRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [scope, setScope] = useState<'company' | 'branch' | 'employee'>('company');
  const [saving, setSaving] = useState(false);

  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [calendar, managed] = await Promise.all([
        resolveHolidayCalendar(companyId, { from, to, stateCode: 'NSW' }),
        listHolidays(companyId, { from, to }),
      ]);
      setEntries(calendar.entries);
      setTenantHolidays(managed);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [companyId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const holidaysByDate = useMemo(() => {
    const map = new Map<string, HolidayEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return map;
  }, [entries]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  async function handleCreate() {
    if (!companyId || !name.trim() || !date) return;
    setSaving(true);
    setError(null);
    try {
      await createHoliday(companyId, {
        scope,
        name: name.trim(),
        date,
        recurring: false,
      });
      setModalOpen(false);
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to create holiday');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteManaged(holidayId: string) {
    if (!companyId) return;
    setError(null);
    try {
      await deleteHoliday(companyId, holidayId);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to delete holiday');
    }
  }

  if (companyLoading) return <PageLoadingState message="Loading company…" />;
  if (companyError) return <PageErrorState error={companyError} />;
  if (!companyId) {
    return (
      <div className="p-8 text-center text-secondary text-sm">
        No company found for this tenant.
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Holiday Calendar</h1>
          <p className="text-sm text-secondary mt-0.5">
            {entries.length} resolved holidays in {months[month]} {year}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CompanySelector />
          <div className="flex items-center surface border border-base rounded-lg overflow-hidden">
            <button
              type="button"
              className="p-2 text-secondary hover:bg-[rgb(var(--bg-hover))]"
              onClick={() => {
                if (month === 0) {
                  setMonth(11);
                  setYear((y) => y - 1);
                } else setMonth((m) => m - 1);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-xs text-secondary">{months[month]} {year}</span>
            <button
              type="button"
              className="p-2 text-secondary hover:bg-[rgb(var(--bg-hover))]"
              onClick={() => {
                if (month === 11) {
                  setMonth(0);
                  setYear((y) => y + 1);
                } else setMonth((m) => m + 1);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button variant="primary" onClick={() => {
            setDate(from);
            setModalOpen(true);
          }}>
            <Plus className="h-4 w-4" /> Add Holiday
          </Button>
        </div>
      </div>

      {error && (
        <div className="text-sm text-error-600 bg-error-50 dark:bg-error-950/30 border border-error-200 dark:border-error-800 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted" />
        </div>
      ) : (
        <>
          <Card>
            <CardBody>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted mb-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: offset }).map((_, i) => (
                  <div key={`pad-${i}`} className="min-h-[80px]" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayHolidays = holidaysByDate.get(dateStr) ?? [];
                  return (
                    <div
                      key={day}
                      className={`min-h-[80px] rounded-lg border p-1.5 text-left ${
                        dayHolidays.length ? 'border-accent-300 bg-accent-50/50 dark:bg-accent-950/20' : 'border-base'
                      }`}
                    >
                      <div className="text-xs font-semibold text-primary mb-1">{day}</div>
                      <div className="space-y-0.5">
                        {dayHolidays.slice(0, 2).map((h) => (
                          <div key={h.id} className="text-[10px] truncate text-secondary" title={h.name}>
                            {h.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {tenantHolidays.length > 0 && (
            <Card>
              <CardBody className="space-y-2">
                <h2 className="text-sm font-semibold text-primary">Company-managed holidays</h2>
                {tenantHolidays.map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge tone={scopeTone[h.scope] ?? 'neutral'} className="capitalize">{h.scope}</Badge>
                      <span>{h.name}</span>
                      <span className="text-muted text-xs">{h.date}</span>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-error-600 hover:underline"
                      onClick={() => void handleDeleteManaged(h.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Holiday"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => void handleCreate()} disabled={saving}>
              {saving ? 'Saving…' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Company Day" />
          </div>
          <div>
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Scope</Label>
            <Select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
              <option value="company">Company</option>
              <option value="branch">Branch</option>
              <option value="employee">Employee</option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}
