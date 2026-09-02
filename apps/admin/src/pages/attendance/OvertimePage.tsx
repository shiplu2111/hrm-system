import { useState } from 'react';
import { Check, X, Clock, TrendingUp } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Toggle';
import { otRequests, type OTRequest } from '@/data/attendanceData';

const statusTone: Record<OTRequest['status'], 'warning' | 'success' | 'error'> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'error',
};

const rateTone: Record<OTRequest['rateType'], 'accent' | 'warning' | 'error' | 'info'> = {
  Weekday: 'accent',
  Weekend: 'warning',
  Holiday: 'error',
  Night: 'info',
};

export function OvertimePage() {
  const [requests, setRequests] = useState(otRequests);

  const handleAction = (id: string, action: 'Approved' | 'Rejected') => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: action } : r)));
  };

  const totalHours = requests.filter((r) => r.status === 'Approved').reduce((s, r) => s + r.hours, 0);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Overtime Requests</h1>
          <p className="text-sm text-secondary mt-0.5">{requests.filter((r) => r.status === 'Pending').length} pending · {totalHours}h approved this period</p>
        </div>
      </div>

      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Employee</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">Date</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Hours</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Rate Type</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider hidden lg:table-cell">Reason</th>
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wider">Status</th>
                  <th className="w-24 px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {requests.map((req) => (
                  <tr key={req.id} className="hover:bg-[rgb(var(--bg-hover))] transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={req.employeeName} size="sm" />
                        <div>
                          <div className="font-medium text-primary">{req.employeeName}</div>
                          <div className="text-xs text-muted">{req.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-secondary hidden md:table-cell">{req.date}</td>
                    <td className="px-5 py-3"><span className="flex items-center gap-1 text-primary font-medium"><Clock className="h-3.5 w-3.5 text-muted" /> {req.hours}h</span></td>
                    <td className="px-5 py-3"><Badge tone={rateTone[req.rateType]}>{req.rateType}</Badge></td>
                    <td className="px-5 py-3 text-secondary hidden lg:table-cell max-w-[200px] truncate">{req.reason}</td>
                    <td className="px-5 py-3"><Badge tone={statusTone[req.status]} dot>{req.status}</Badge></td>
                    <td className="px-5 py-3">
                      {req.status === 'Pending' ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleAction(req.id, 'Approved')} className="h-7 w-7 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 hover:bg-success-100 flex items-center justify-center transition-colors"><Check className="h-4 w-4" /></button>
                          <button onClick={() => handleAction(req.id, 'Rejected')} className="h-7 w-7 rounded-lg bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400 hover:bg-error-100 flex items-center justify-center transition-colors"><X className="h-4 w-4" /></button>
                        </div>
                      ) : <span className="text-muted text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
