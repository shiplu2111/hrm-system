import type { LucideIcon } from 'lucide-react';
import { ChevronRight } from 'lucide-react';
import type { PermissionAction } from '@hrm/shared-types';
import { usePermission } from '@hrm/portal-ui';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNav, type PageKey } from '@/context/NavContext';
import { getPageViewPermission } from '@/config/page-permissions';
import type { ModuleHubConfig } from '@/config/module-hubs';
import { LayoutGrid } from 'lucide-react';

function HubCard({
  label,
  description,
  page,
  icon: Icon,
  onNavigate,
}: {
  label: string;
  description: string;
  page: PageKey;
  icon: LucideIcon;
  onNavigate: (page: PageKey) => void;
}) {
  const required = getPageViewPermission(page);
  const allowed = usePermission(
    required?.module ?? 'employee',
    (required?.action ?? 'view') as PermissionAction,
  );

  if (required && !allowed) return null;

  return (
    <button
      type="button"
      onClick={() => onNavigate(page)}
      className="text-left w-full group"
    >
      <Card className="h-full hover:shadow-card-hover transition-shadow">
        <CardBody className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-accent-50 dark:bg-accent-950/40 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-accent-600 dark:text-accent-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-primary group-hover:text-accent-700 dark:group-hover:text-accent-300 transition-colors">
                {label}
              </span>
              <ChevronRight className="h-4 w-4 text-muted opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0" />
            </div>
            <p className="text-xs text-secondary mt-1 leading-relaxed">{description}</p>
          </div>
        </CardBody>
      </Card>
    </button>
  );
}

interface ModuleHubPageProps {
  config: ModuleHubConfig;
}

export function ModuleHubPage({ config }: ModuleHubPageProps) {
  const { navigate } = useNav();

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-primary">{config.title}</h1>
        <p className="text-sm text-secondary mt-0.5 max-w-2xl">{config.description}</p>
      </div>

      {config.items.length === 0 ? (
        <EmptyState
          compact
          icon={LayoutGrid}
          title="No screens available"
          description="You do not have permission to view any items in this module."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {config.items.map((item) => (
            <HubCard key={item.page} {...item} onNavigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}
