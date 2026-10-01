import { BarChart3, Clock, Download, Upload, type LucideIcon } from 'lucide-react';
import { useNav, type PageKey } from '@/context/NavContext';
import { reportsCopy as copy } from '@/lib/reports-copy';

const SECTIONS: Array<{ page: PageKey; label: string; icon: LucideIcon }> = [
  { page: 'reports-hub', label: copy.hubNav.reports, icon: BarChart3 },
  { page: 'reports-scheduled', label: copy.hubNav.scheduled, icon: Clock },
  { page: 'data-import', label: copy.hubNav.import, icon: Upload },
  { page: 'data-export', label: copy.hubNav.export, icon: Download },
];

export function ReportsHubNav() {
  const { current, navigate } = useNav();
  return (
    <nav aria-label={copy.hubNav.label} className="flex items-center gap-1 border-b border-base overflow-x-auto">
      {SECTIONS.map(({ page, label, icon: Icon }) => {
        const active = current === page;
        return (
          <button
            key={page}
            type="button"
            onClick={() => navigate(page)}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? 'border-accent-600 text-accent-700 dark:text-accent-300'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </nav>
  );
}
