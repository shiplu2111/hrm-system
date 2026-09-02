import { useState } from 'react';
import { Save, Clock, Moon, CalendarDays, PartyPopper } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Form';

interface OTRule {
  id: string;
  type: string;
  icon: typeof Clock;
  multiplier: string;
  maxHours: string;
  color: string;
}

const initialRules: OTRule[] = [
  { id: 'ot-r1', type: 'Weekday OT', icon: Clock, multiplier: '1.5x', maxHours: '3 hrs/day', color: 'bg-accent-100 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300' },
  { id: 'ot-r2', type: 'Weekend OT', icon: CalendarDays, multiplier: '2.0x', maxHours: '8 hrs/day', color: 'bg-warning-100 text-warning-700 dark:bg-warning-950/40 dark:text-warning-300' },
  { id: 'ot-r3', type: 'Holiday OT', icon: PartyPopper, multiplier: '2.5x', maxHours: '8 hrs/day', color: 'bg-error-100 text-error-700 dark:bg-error-950/40 dark:text-error-300' },
  { id: 'ot-r4', type: 'Night OT (22:00-06:00)', icon: Moon, multiplier: '1.5x', maxHours: '4 hrs/night', color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' },
];

export function OTRulesPage() {
  const [rules, setRules] = useState(initialRules);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1000px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Overtime Rules</h1>
          <p className="text-sm text-secondary mt-0.5">Configure rate multipliers and maximum caps per overtime type</p>
        </div>
        <Button variant="primary"><Save className="h-4 w-4" /> Save Changes</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rules.map((rule, i) => {
          const Icon = rule.icon;
          return (
            <Card key={rule.id}>
              <CardHeader className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`h-9 w-9 rounded-lg ${rule.color} flex items-center justify-center`}>
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <CardTitle>{rule.type}</CardTitle>
                </div>
              </CardHeader>
              <CardBody className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Rate Multiplier</Label>
                  <Input
                    value={rule.multiplier}
                    onChange={(e) => setRules((prev) => prev.map((r, idx) => idx === i ? { ...r, multiplier: e.target.value } : r))}
                  />
                </div>
                <div>
                  <Label>Max Hours / Day</Label>
                  <Input
                    value={rule.maxHours}
                    onChange={(e) => setRules((prev) => prev.map((r, idx) => idx === i ? { ...r, maxHours: e.target.value } : r))}
                  />
                </div>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Global cap */}
      <Card>
        <CardHeader><CardTitle>Global Overtime Cap</CardTitle></CardHeader>
        <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>Max OT Hours / Week</Label>
            <Input defaultValue="20" />
          </div>
          <div>
            <Label>Max OT Hours / Month</Label>
            <Input defaultValue="60" />
          </div>
          <div>
            <Label>Auto-Approval Threshold (hrs)</Label>
            <Input defaultValue="2" />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
