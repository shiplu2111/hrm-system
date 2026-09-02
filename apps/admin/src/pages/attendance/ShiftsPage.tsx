import { useState } from 'react';
import { Plus, Clock, Coffee, AlertCircle, TrendingUp, Pencil, Trash2 } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { shifts, type Shift } from '@/data/attendanceData';

export function ShiftsPage() {
  const [shiftList, setShiftList] = useState(shifts);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Shift Management</h1>
          <p className="text-sm text-secondary mt-0.5">{shiftList.length} shift patterns configured</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Shift</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {shiftList.map((shift) => (
          <Card key={shift.id} className="hover:shadow-card-hover transition-shadow group">
            <CardBody>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`h-10 w-10 rounded-lg ${shift.color} flex items-center justify-center`}>
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-primary">{shift.name}</div>
                    <div className="text-xs text-muted">{shift.startTime} – {shift.endTime}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-hover))]"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setShiftList((prev) => prev.filter((s) => s.id !== shift.id))} className="text-muted hover:text-error-600 p-1 rounded hover:bg-error-50 dark:hover:bg-error-950/40"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="space-y-2 pt-3 border-t border-base">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted"><Coffee className="h-3.5 w-3.5" /> Break</span>
                  <span className="text-secondary">{shift.breakTime}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted"><AlertCircle className="h-3.5 w-3.5" /> Grace Period</span>
                  <span className="text-secondary">{shift.gracePeriod}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted"><Clock className="h-3.5 w-3.5" /> Late Rule</span>
                  <span className="text-secondary">{shift.lateRule}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 text-muted"><TrendingUp className="h-3.5 w-3.5" /> OT Rule</span>
                  <Badge tone="accent" className="text-[10px]">{shift.otRule}</Badge>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Shift"
        description="Create a new shift pattern"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>Create Shift</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label>Shift Name</Label>
            <Input placeholder="e.g. Morning Shift" />
          </div>
          <div><Label>Start Time</Label><Input type="time" /></div>
          <div><Label>End Time</Label><Input type="time" /></div>
          <div><Label>Break Duration</Label><Input placeholder="e.g. 1 hour" /></div>
          <div><Label>Grace Period</Label><Input placeholder="e.g. 15 min" /></div>
          <div><Label>Late Rule</Label><Input placeholder="e.g. After 08:15" /></div>
          <div><Label>OT Rule</Label><Select><option>1.5x after 8h</option><option>2x after 8h</option><option>No OT</option></Select></div>
          <div className="col-span-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {['bg-accent-500', 'bg-warning-500', 'bg-purple-500', 'bg-success-500', 'bg-error-500', 'bg-sky-500'].map((c) => (
                <button key={c} className={`h-8 w-8 rounded-lg ${c} hover:ring-2 hover:ring-offset-2 hover:ring-[rgb(var(--border-strong))] transition-all`} />
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
