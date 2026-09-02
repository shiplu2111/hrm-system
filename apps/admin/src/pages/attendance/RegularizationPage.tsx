import { useState } from 'react';
import { Check, X, ArrowRight, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Toggle';
import { regRequests, type RegRequest } from '@/data/attendanceData';

const statusTone: Record<RegRequest['status'], 'warning' | 'success' | 'error'> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'error',
};

export function RegularizationPage() {
  const [requests, setRequests] = useState(regRequests);

  const handleAction = (id: string, action: 'Approved' | 'Rejected') => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: action } : r)));
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-primary">Attendance Regularization</h1>
        <p className="text-sm text-secondary mt-0.5">Review and approve clock-in/out correction requests from employees.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {requests.map((req) => (
          <Card key={req.id}>
            <CardBody>
              {/* Employee header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar name={req.employeeName} size="md" />
                  <div>
                    <div className="text-sm font-semibold text-primary">{req.employeeName}</div>
                    <div className="text-xs text-muted">{req.employeeId} · {req.date}</div>
                  </div>
                </div>
                <Badge tone={statusTone[req.status]} dot>{req.status}</Badge>
              </div>

              {/* Before / After comparison */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="surface border border-base rounded-lg p-3">
                  <div className="text-[10px] font-semibold text-muted uppercase tracking-wider mb-2">Before (Actual)</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Clock In</span>
                      <span className="text-secondary font-medium line-through">{req.beforeClockIn}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Clock Out</span>
                      <span className="text-secondary font-medium line-through">{req.beforeClockOut}</span>
                    </div>
                  </div>
                </div>
                <div className="surface border-2 border-accent-500/30 rounded-lg p-3 bg-accent-50/30 dark:bg-accent-950/20">
                  <div className="text-[10px] font-semibold text-accent-600 uppercase tracking-wider mb-2">After (Requested)</div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Clock In</span>
                      <span className="text-primary font-medium">{req.afterClockIn}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Clock Out</span>
                      <span className="text-primary font-medium">{req.afterClockOut}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-[rgb(var(--bg-muted))] mb-4">
                <Clock className="h-4 w-4 text-muted shrink-0 mt-0.5" />
                <p className="text-xs text-secondary">{req.reason}</p>
              </div>

              {/* Actions */}
              {req.status === 'Pending' ? (
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="sm" className="flex-1" onClick={() => handleAction(req.id, 'Approved')}>
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button variant="danger" size="sm" className="flex-1" onClick={() => handleAction(req.id, 'Rejected')}>
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted">
                  <ArrowRight className="h-3.5 w-3.5" />
                  Request {req.status.toLowerCase()} by manager
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
