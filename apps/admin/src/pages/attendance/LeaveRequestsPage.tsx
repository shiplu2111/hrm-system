import { useState } from 'react';
import { Check, X, Calendar, Clock } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Toggle';
import { leaveRequests, type LeaveRequest } from '@/data/attendanceData';

const statusTone: Record<LeaveRequest['status'], 'warning' | 'accent' | 'success' | 'error'> = {
  'Pending Manager': 'warning',
  'Pending HR': 'accent',
  Approved: 'success',
  Rejected: 'error',
};

function ApprovalStepper({ status }: { status: LeaveRequest['status'] }) {
  const steps = ['Employee', 'Manager', 'HR'];
  const currentStep = status === 'Pending Manager' ? 1 : status === 'Pending HR' ? 2 : status === 'Approved' ? 3 : status === 'Rejected' ? 2 : 3;
  const rejected = status === 'Rejected';

  return (
    <div className="flex items-center gap-1">
      {steps.map((step, i) => {
        const stepNum = i + 1;
        const completed = stepNum < currentStep;
        const current = stepNum === currentStep && !rejected;
        const isRejected = rejected && stepNum === currentStep;
        return (
          <div key={step} className="flex items-center gap-1">
            <div className="flex items-center gap-1.5">
              <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 transition-colors ${
                completed ? 'bg-success-500 text-white' :
                isRejected ? 'bg-error-500 text-white' :
                current ? 'bg-accent-600 text-white ring-2 ring-accent-500/20' :
                'bg-[rgb(var(--bg-muted))] text-muted border border-base'
              }`}>
                {completed ? <Check className="h-3 w-3" /> : isRejected ? <X className="h-3 w-3" /> : stepNum}
              </div>
              <span className={`text-[11px] font-medium hidden sm:block ${
                completed ? 'text-success-600' : isRejected ? 'text-error-600' : current ? 'text-accent-600' : 'text-muted'
              }`}>{step}</span>
            </div>
            {i < steps.length - 1 && <div className={`h-px w-4 ${completed ? 'bg-success-500' : 'bg-[rgb(var(--border-base))]'}`} />}
          </div>
        );
      })}
    </div>
  );
}

export function LeaveRequestsPage() {
  const [requests, setRequests] = useState(leaveRequests);

  const handleAction = (id: string, action: 'Approved' | 'Rejected') => {
    setRequests((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      if (r.status === 'Pending Manager' && action === 'Approved') return { ...r, status: 'Pending HR' };
      return { ...r, status: action };
    }));
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-primary">Leave Requests</h1>
        <p className="text-sm text-secondary mt-0.5">{requests.filter((r) => r.status.includes('Pending')).length} pending approvals</p>
      </div>

      <div className="space-y-4">
        {requests.map((req) => (
          <Card key={req.id}>
            <CardBody>
              <div className="flex flex-col lg:flex-row items-start gap-4">
                {/* Employee info */}
                <div className="flex items-center gap-3 lg:w-56 shrink-0">
                  <Avatar name={req.employeeName} size="md" />
                  <div>
                    <div className="text-sm font-semibold text-primary">{req.employeeName}</div>
                    <div className="text-xs text-muted">{req.employeeId}</div>
                  </div>
                </div>

                {/* Leave details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone="accent">{req.leaveType}</Badge>
                    <span className="text-sm text-primary font-medium">{req.days} day{req.days > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted mb-2">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {req.startDate} → {req.endDate}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Applied {req.appliedDate}</span>
                  </div>
                  <p className="text-xs text-secondary">{req.reason}</p>
                </div>

                {/* Approval stepper + actions */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <ApprovalStepper status={req.status} />
                  {req.status.includes('Pending') ? (
                    <div className="flex items-center gap-1.5">
                      <Button variant="primary" size="sm" onClick={() => handleAction(req.id, 'Approved')}><Check className="h-3.5 w-3.5" /> Approve</Button>
                      <Button variant="danger" size="sm" onClick={() => handleAction(req.id, 'Rejected')}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <Badge tone={statusTone[req.status]} dot>{req.status}</Badge>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
