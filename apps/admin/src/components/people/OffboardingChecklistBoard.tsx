import {
  Calendar,
  Check,
  FileText,
  KeyRound,
  Loader2,
  Package,
  Shield,
  Users,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Progress';
import { Avatar } from '@/components/ui/Toggle';

export interface OffboardingChecklistItem {
  id: string;
  title: string;
  description: string;
  category: string;
  assignee: string;
  dueDate: string;
  completed: boolean;
  icon: typeof FileText;
  taskType?: string;
  status?: string;
  pendingAssetCount?: number | null;
  payrollAdjustmentId?: string | null;
}

export interface OffboardingChecklistConfig {
  title: string;
  subtitle: string;
  items: OffboardingChecklistItem[];
}

interface OffboardingChecklistBoardProps {
  config: OffboardingChecklistConfig;
  onTaskAction?: (taskId: string, action: string) => void;
  actionTaskId?: string | null;
}

export function OffboardingChecklistBoard({
  config,
  onTaskAction,
  actionTaskId,
}: OffboardingChecklistBoardProps) {
  const items = config.items;
  const completedCount = items.filter((i) => i.completed).length;
  const progress = items.length > 0 ? (completedCount / items.length) * 100 : 0;
  const categories = [...new Set(items.map((i) => i.category))];

  const renderAction = (item: OffboardingChecklistItem) => {
    if (item.completed || !onTaskAction) return null;

    switch (item.taskType) {
      case 'asset_return':
        return (
          <Button
            size="sm"
            variant="secondary"
            disabled={actionTaskId === item.id}
            onClick={() => onTaskAction(item.id, 'return-assets')}
          >
            {actionTaskId === item.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>Return {item.pendingAssetCount ?? 0} asset(s)</>
            )}
          </Button>
        );
      case 'access_revocation':
        return (
          <Button
            size="sm"
            variant="secondary"
            disabled={actionTaskId === item.id}
            onClick={() => onTaskAction(item.id, 'revoke-access')}
          >
            {actionTaskId === item.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>Revoke access</>
            )}
          </Button>
        );
      case 'exit_interview':
        return (
          <Button
            size="sm"
            variant="secondary"
            disabled={actionTaskId === item.id}
            onClick={() => onTaskAction(item.id, 'exit-interview')}
          >
            Record interview
          </Button>
        );
      case 'final_settlement':
        return (
          <Button
            size="sm"
            variant="secondary"
            disabled={actionTaskId === item.id}
            onClick={() => onTaskAction(item.id, 'trigger-settlement')}
          >
            {actionTaskId === item.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>Create settlement</>
            )}
          </Button>
        );
      default:
        return (
          <Button
            size="sm"
            variant="secondary"
            disabled={actionTaskId === item.id}
            onClick={() => onTaskAction(item.id, 'complete')}
          >
            {actionTaskId === item.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <Check className="h-3.5 w-3.5" /> Mark done
              </>
            )}
          </Button>
        );
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold text-primary">{config.title}</div>
              <div className="text-xs text-secondary mt-0.5">{config.subtitle}</div>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={progress === 100 ? 'success' : 'accent'} dot>
                {completedCount}/{items.length} completed
              </Badge>
              <span className="text-lg font-bold text-primary">{Math.round(progress)}%</span>
            </div>
          </div>
          <ProgressBar value={progress} tone={progress === 100 ? 'success' : 'accent'} />
        </CardBody>
      </Card>

      {categories.map((category) => {
        const categoryItems = items.filter((i) => i.category === category);
        const categoryCompleted = categoryItems.filter((i) => i.completed).length;
        return (
          <Card key={category}>
            <CardHeader className="flex items-center justify-between">
              <CardTitle>{category}</CardTitle>
              <Badge tone="neutral">{categoryCompleted}/{categoryItems.length}</Badge>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-[rgb(var(--border-base))]">
                {categoryItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-[rgb(var(--bg-hover))] transition-colors"
                    >
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                          item.completed
                            ? 'bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400'
                            : 'bg-[rgb(var(--bg-muted))] text-muted'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium ${
                            item.completed ? 'text-muted line-through' : 'text-primary'
                          }`}
                        >
                          {item.title}
                        </div>
                        <div className="text-xs text-secondary">{item.description}</div>
                        {item.payrollAdjustmentId && (
                          <div className="text-xs text-accent-600 mt-1">
                            Adjustment: {item.payrollAdjustmentId.slice(0, 8)}…
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted">
                          <Avatar name={item.assignee} size="sm" />
                          <span>{item.assignee}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted">
                          <Calendar className="h-3 w-3" /> {item.dueDate}
                        </div>
                        {item.completed ? (
                          <Badge tone="success" dot>Done</Badge>
                        ) : (
                          <Badge tone="warning" dot>Pending</Badge>
                        )}
                        {renderAction(item)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

export const OFFBOARDING_CATEGORY_ICONS = {
  clearance: Shield,
  asset_return: Package,
  access_revocation: KeyRound,
  exit_process: Users,
  final_settlement: FileText,
} as const;
