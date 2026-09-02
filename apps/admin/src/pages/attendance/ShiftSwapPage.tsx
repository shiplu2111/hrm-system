import { useState } from 'react';
import { Check, X, ArrowLeftRight, Calendar } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Toggle';

interface SwapRequest {
  id: string;
  empA: string;
  empB: string;
  shiftA: string;
  shiftB: string;
  date: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

const initialSwaps: SwapRequest[] = [
  { id: 'sw1', empA: 'Sarah Chen', empB: 'Lisa Wang', shiftA: 'Morning (Aug 28)', shiftB: 'Morning (Aug 30)', date: 'Aug 28-30', reason: 'Sarah has a personal appointment on Aug 28', status: 'Pending' },
  { id: 'sw2', empA: 'David Kim', empB: 'Emma Wilson', shiftA: 'Evening (Aug 27)', shiftB: 'Morning (Aug 27)', date: 'Aug 27', reason: 'David prefers morning shift for the day', status: 'Pending' },
  { id: 'sw3', empA: 'Tom Anderson', empB: 'Priya Patel', shiftA: 'Flexible (Aug 26)', shiftB: 'Flexible (Aug 29)', date: 'Aug 26-29', reason: 'Mutual swap for project deadlines', status: 'Approved' },
];

export function ShiftSwapPage() {
  const [swaps, setSwaps] = useState(initialSwaps);

  const handleAction = (id: string, action: 'Approved' | 'Rejected') => {
    setSwaps((prev) => prev.map((s) => (s.id === id ? { ...s, status: action } : s)));
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-primary">Shift Swap Requests</h1>
        <p className="text-sm text-secondary mt-0.5">Review and approve shift exchange requests between employees.</p>
      </div>

      <div className="space-y-4">
        {swaps.map((swap) => (
          <Card key={swap.id}>
            <CardBody>
              <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4">
                {/* Employee A */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar name={swap.empA} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-primary truncate">{swap.empA}</div>
                    <div className="text-xs text-muted">{swap.shiftA}</div>
                  </div>
                </div>

                {/* Swap icon */}
                <div className="flex items-center justify-center">
                  <div className="h-10 w-10 rounded-full bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center shrink-0">
                    <ArrowLeftRight className="h-5 w-5 text-accent-600 dark:text-accent-400" />
                  </div>
                </div>

                {/* Employee B */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar name={swap.empB} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-primary truncate">{swap.empB}</div>
                    <div className="text-xs text-muted">{swap.shiftB}</div>
                  </div>
                </div>

                {/* Date + reason + status */}
                <div className="flex flex-col items-end gap-1 min-w-[140px]">
                  <div className="flex items-center gap-1 text-xs text-muted"><Calendar className="h-3 w-3" /> {swap.date}</div>
                  {swap.status === 'Pending' ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Button variant="primary" size="sm" onClick={() => handleAction(swap.id, 'Approved')}><Check className="h-3.5 w-3.5" /> Approve</Button>
                      <Button variant="danger" size="sm" onClick={() => handleAction(swap.id, 'Rejected')}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  ) : (
                    <Badge tone={swap.status === 'Approved' ? 'success' : 'error'} dot>{swap.status}</Badge>
                  )}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-base text-xs text-secondary">{swap.reason}</div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
