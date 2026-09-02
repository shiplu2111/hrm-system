import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { holidays, type Holiday } from '@/data/attendanceData';

const typeTone: Record<Holiday['type'], 'accent' | 'success' | 'warning' | 'error'> = {
  Public: 'accent',
  Company: 'success',
  State: 'warning',
  Branch: 'error',
};

const typeColor: Record<Holiday['type'], string> = {
  Public: 'bg-accent-500',
  Company: 'bg-success-500',
  State: 'bg-warning-500',
  Branch: 'bg-error-500',
};

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function HolidayCalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(7); // August (0-indexed)
  const [modalOpen, setModalOpen] = useState(false);
  const [holidayList, setHolidayList] = useState(holidays);

  const year = 2024;
  const firstDay = new Date(year, currentMonth, 1).getDay();
  const daysInMonth = new Date(year, currentMonth + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const getHoliday = (day: number) => {
    const dateStr = `${year}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return holidayList.filter((h) => h.date === dateStr);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Holiday Calendar</h1>
          <p className="text-sm text-secondary mt-0.5">{holidayList.length} holidays in 2024</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Holiday</Button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {(['Public', 'Company', 'State', 'Branch'] as Holiday['type'][]).map((t) => (
          <div key={t} className="flex items-center gap-1.5">
            <div className={`h-3 w-3 rounded ${typeColor[t]}`} />
            <span className="text-xs text-secondary">{t}</span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      <Card>
        <CardBody>
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth((m) => Math.max(0, m - 1))} className="p-2 text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-base font-semibold text-primary">{months[currentMonth]} {year}</span>
            <button onClick={() => setCurrentMonth((m) => Math.min(11, m + 1))} className="p-2 text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))] rounded-lg transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-muted py-2">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayHolidays = getHoliday(day);
              const isWeekend = (offset + i) % 7 >= 5;
              return (
                <div
                  key={day}
                  className={`aspect-square rounded-lg border p-1.5 flex flex-col transition-colors ${
                    dayHolidays.length > 0
                      ? 'border-accent-500/30 bg-accent-50/30 dark:bg-accent-950/20'
                      : isWeekend
                      ? 'border-base bg-[rgb(var(--bg-muted))]/50'
                      : 'border-base hover:border-strong'
                  }`}
                >
                  <span className={`text-xs font-medium ${dayHolidays.length > 0 ? 'text-accent-700 dark:text-accent-300' : isWeekend ? 'text-muted' : 'text-secondary'}`}>
                    {day}
                  </span>
                  {dayHolidays.map((h) => (
                    <div key={h.id} className="mt-auto flex items-center gap-1">
                      <div className={`h-1.5 w-1.5 rounded-full ${typeColor[h.type]} shrink-0`} />
                      <span className="text-[9px] text-secondary truncate hidden sm:block">{h.name}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Holiday list */}
      <Card>
        <CardBody className="p-0">
          <div className="divide-y divide-[rgb(var(--border-base))]">
            {holidayList.map((h) => (
              <div key={h.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[rgb(var(--bg-hover))] transition-colors">
                <div className={`h-2.5 w-2.5 rounded-full ${typeColor[h.type]} shrink-0`} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-primary">{h.name}</div>
                  <div className="text-xs text-muted">{h.branches === 'All' ? 'All branches' : `Branch: ${h.branches}`}</div>
                </div>
                <span className="text-sm text-secondary">{h.date}</span>
                <Badge tone={typeTone[h.type]}>{h.type}</Badge>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Add holiday modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Holiday"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>Create Holiday</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div><Label>Holiday Name</Label><Input placeholder="e.g. Earth Day" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Date</Label><Input type="date" /></div>
            <div><Label>Holiday Type</Label><Select><option>Public</option><option>Company</option><option>State</option><option>Branch</option></Select></div>
          </div>
          <div><Label>Applicable Branches</Label><Select><option>All Branches</option><option>San Francisco HQ</option><option>New York Office</option><option>London Branch</option></Select></div>
        </div>
      </Modal>
    </div>
  );
}
