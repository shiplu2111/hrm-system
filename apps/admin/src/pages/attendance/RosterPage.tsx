import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Form';
import { shifts } from '@/data/attendanceData';

const employees = [
  { id: '1', name: 'Sarah Chen' },
  { id: '2', name: 'Marcus Johnson' },
  { id: '3', name: 'Priya Patel' },
  { id: '4', name: 'Lisa Wang' },
  { id: '5', name: 'David Kim' },
  { id: '6', name: 'Emma Wilson' },
  { id: '7', name: 'Tom Anderson' },
];

const daysOfWeek = ['Mon 26', 'Tue 27', 'Wed 28', 'Thu 29', 'Fri 30', 'Sat 31', 'Sun 1'];

// Simulated roster assignments: employeeId-dayIndex -> shiftId
const initialRoster: Record<string, string> = {
  '1-0': 's1', '1-1': 's1', '1-2': 's1', '1-3': 's1', '1-4': 's1',
  '2-0': 's2', '2-1': 's2', '2-2': 's2', '2-3': 's2', '2-4': 's2',
  '3-0': 's4', '3-1': 's4', '3-2': 's4', '3-3': 's4', '3-4': 's4',
  '4-0': 's1', '4-1': 's1', '4-2': 's1', '4-3': 's1', '4-4': 's1',
  '5-0': 's2', '5-1': 's2', '5-2': 's2', '5-3': 's2', '5-4': 's2',
  '6-0': 's1', '6-1': 's1', '6-2': 's4', '6-3': 's4', '6-4': 's1',
  '7-0': 's4', '7-1': 's4', '7-2': 's4', '7-3': 's4', '7-4': 's4',
};

export function RosterPage() {
  const [roster, setRoster] = useState(initialRoster);
  const [draggedShift, setDraggedShift] = useState<string | null>(null);

  const handleDrop = (cellKey: string) => {
    if (!draggedShift) return;
    setRoster((prev) => ({ ...prev, [cellKey]: draggedShift }));
    setDraggedShift(null);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Roster Calendar</h1>
          <p className="text-sm text-secondary mt-0.5">Week of August 26 — September 1, 2024</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center surface border border-base rounded-lg overflow-hidden">
            <button className="p-2 text-secondary hover:bg-[rgb(var(--bg-hover))]"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-3 text-xs text-secondary">Aug 26 – Sep 1</span>
            <button className="p-2 text-secondary hover:bg-[rgb(var(--bg-hover))]"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <Button variant="secondary"><Calendar className="h-4 w-4" /> Today</Button>
        </div>
      </div>

      {/* Shift legend */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted">Shifts:</span>
        {shifts.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <div className={`h-3 w-3 rounded ${s.color}`} />
            <span className="text-xs text-secondary">{s.name}</span>
          </div>
        ))}
      </div>

      {/* Roster grid */}
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider sticky left-0 bg-inherit">Employee</th>
                  {daysOfWeek.map((day) => (
                    <th key={day} className="text-center px-2 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider min-w-[100px]">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-4 py-2.5 sticky left-0 bg-inherit">
                      <div className="text-sm font-medium text-primary">{emp.name}</div>
                    </td>
                    {daysOfWeek.map((_, dayIdx) => {
                      const cellKey = `${emp.id}-${dayIdx}`;
                      const shiftId = roster[cellKey];
                      const shift = shifts.find((s) => s.id === shiftId);
                      const isWeekend = dayIdx >= 5;
                      return (
                        <td key={cellKey} className="px-1.5 py-1.5 text-center">
                          <div
                            draggable={!!shift}
                            onDragStart={() => shift && setDraggedShift(shift.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleDrop(cellKey)}
                            className={`h-10 rounded-lg flex items-center justify-center text-xs font-medium cursor-grab transition-all ${
                              shift
                                ? `${shift.color} text-white hover:opacity-80`
                                : isWeekend
                                ? 'bg-[rgb(var(--bg-muted))] text-muted border border-dashed border-base'
                                : 'border-2 border-dashed border-base text-muted hover:border-accent-500 hover:text-accent-600'
                            }`}
                          >
                            {shift ? shift.name.split(' ')[0] : isWeekend ? 'Off' : '+'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted">
        <Badge tone="neutral">Tip</Badge>
        <span>Drag a shift block to another cell to reassign. Click empty cells to add a shift.</span>
      </div>
    </div>
  );
}
