import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';
import { leaveTypes, type LeaveTypeConfig } from '@/data/attendanceData';

export function LeaveTypesPage() {
  const [types, setTypes] = useState(leaveTypes);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Leave Types Configuration</h1>
          <p className="text-sm text-secondary mt-0.5">{types.length} leave types configured</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" /> Add Leave Type</Button>
      </div>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Leave Type</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Entitlement</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">Accrual Rate</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">Carry Forward</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">Encashment</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Paid</th>
                  <th className="w-12 px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {types.map((lt) => (
                  <tr key={lt.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors group">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`h-7 w-7 rounded-lg ${lt.color} flex items-center justify-center shrink-0`} />
                        <span className="font-medium text-primary">{lt.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-secondary">{lt.entitlement} days/yr</td>
                    <td className="px-5 py-3 text-secondary hidden md:table-cell">{lt.accrualRate}</td>
                    <td className="px-5 py-3 text-secondary hidden lg:table-cell">{lt.carryForward}</td>
                    <td className="px-5 py-3 text-secondary hidden lg:table-cell">{lt.encashment}</td>
                    <td className="px-5 py-3">{lt.paid ? <Badge tone="success">Paid</Badge> : <Badge tone="neutral">Unpaid</Badge>}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="text-muted hover:text-primary p-1 rounded hover:bg-[rgb(var(--bg-muted))]"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setTypes((prev) => prev.filter((t) => t.id !== lt.id))} className="text-muted hover:text-error-600 p-1 rounded hover:bg-error-50 dark:hover:bg-error-950/40"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Leave Type"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>Create</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Label>Leave Type Name</Label><Input placeholder="e.g. Study Leave" /></div>
          <div><Label>Annual Entitlement (days)</Label><Input type="number" placeholder="10" /></div>
          <div><Label>Accrual Rate</Label><Input placeholder="e.g. 0.83/month" /></div>
          <div><Label>Carry Forward Policy</Label><Select><option>Up to 10 days</option><option>No carry forward</option><option>Unlimited</option></Select></div>
          <div><Label>Encashment Policy</Label><Select><option>Allowed on exit</option><option>Not allowed</option><option>Allowed anytime</option></Select></div>
          <div className="col-span-2 flex items-center justify-between p-3 rounded-lg bg-[rgb(var(--bg-muted))]">
            <div><div className="text-sm font-medium text-primary">Paid Leave</div><div className="text-xs text-muted">Employee receives salary during this leave</div></div>
            <Toggle checked onChange={() => {}} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
