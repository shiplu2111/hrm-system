import { useState } from 'react';
import {
  Check,
  Clock,
  User,
  Calendar,
  Plus,
  FileText,
  Shield,
  Monitor,
  KeyRound,
  Package,
  Users,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Progress';
import { Checkbox } from '@/components/ui/Toggle';
import { Avatar } from '@/components/ui/Toggle';

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  category: string;
  assignee: string;
  dueDate: string;
  completed: boolean;
  icon: typeof FileText;
}

export interface ChecklistConfig {
  title: string;
  subtitle: string;
  items: ChecklistItem[];
}

export function ChecklistBoard({ config }: { config: ChecklistConfig }) {
  const [items, setItems] = useState(config.items);

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item)));
  };

  const completedCount = items.filter((i) => i.completed).length;
  const progress = (completedCount / items.length) * 100;

  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <div className="space-y-6">
      {/* Progress overview */}
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

      {/* Checklist by category */}
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
                    <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[rgb(var(--bg-hover))] transition-colors group">
                      <Checkbox checked={item.completed} onChange={() => toggleItem(item.id)} />
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                        item.completed ? 'bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400' : 'bg-[rgb(var(--bg-muted))] text-muted'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${item.completed ? 'text-muted line-through' : 'text-primary'}`}>{item.title}</div>
                        <div className="text-xs text-secondary">{item.description}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        );
      })}

      {/* Add task */}
      <button className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-strong rounded-xl text-secondary hover:border-accent-500 hover:text-accent-600 transition-colors">
        <Plus className="h-4 w-4" /> Add Checklist Task
      </button>
    </div>
  );
}
