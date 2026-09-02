import { Building2, Check, ChevronDown, LayoutGrid, Shield, UserRound } from 'lucide-react';
import { useNav, type PageKey } from '@/context/NavContext';
import { Dropdown, DropdownDivider, DropdownHeader, DropdownItem } from '@/components/ui/Dropdown';

type PortalId = 'employee' | 'admin' | 'platform';

interface PortalOption {
  id: PortalId;
  label: string;
  description: string;
  page: PageKey;
  icon: typeof Shield;
}

const portals: PortalOption[] = [
  {
    id: 'employee',
    label: 'Employee Dashboard',
    description: 'Self-service portal for employees',
    page: 'ess',
    icon: UserRound,
  },
  {
    id: 'admin',
    label: 'Company Admin',
    description: 'HR operations for this tenant',
    page: 'dashboard',
    icon: Building2,
  },
  {
    id: 'platform',
    label: 'Super Admin',
    description: 'Platform-level control plane',
    page: 'platform-admin',
    icon: Shield,
  },
];

export function PortalSwitcher({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { current, navigate } = useNav();
  const activeId: PortalId =
    current === 'ess' ? 'employee' : current === 'platform-admin' ? 'platform' : 'admin';
  const active = portals.find((portal) => portal.id === activeId) ?? portals[1];
  const ActiveIcon = active.icon;

  const triggerClass =
    variant === 'dark'
      ? 'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-white/10 transition-colors cursor-pointer'
      : 'flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer';

  return (
    <Dropdown
      width="w-72"
      trigger={
        <div className={triggerClass}>
          <ActiveIcon className={`h-4 w-4 ${variant === 'dark' ? 'text-indigo-300' : 'text-accent-500'}`} />
          <div className="hidden md:flex flex-col leading-tight text-left">
            <span className={`text-[10px] uppercase tracking-wider ${variant === 'dark' ? 'text-slate-400' : 'text-muted'}`}>
              Portal
            </span>
            <span className={`text-xs font-bold ${variant === 'dark' ? 'text-white' : 'text-primary'}`}>
              {active.label}
            </span>
          </div>
          <ChevronDown className={`h-4 w-4 ${variant === 'dark' ? 'text-slate-400' : 'text-muted'}`} />
        </div>
      }
    >
      <DropdownHeader>
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-accent-500" />
          <div>
            <div className="text-xs font-bold text-primary">Switch dashboard</div>
            <div className="text-[10px] text-muted mt-0.5">Demo access across all three portals</div>
          </div>
        </div>
      </DropdownHeader>
      <DropdownDivider />
      {portals.map((portal) => {
        const Icon = portal.icon;
        return (
          <DropdownItem
            key={portal.id}
            active={portal.id === activeId}
            onClick={() => navigate(portal.page)}
            icon={<Icon className="h-4 w-4" />}
          >
            <span className="flex items-center gap-2">
              <span className="flex-1">
                <span className="block font-medium">{portal.label}</span>
                <span className="block text-[10px] text-muted">{portal.description}</span>
              </span>
              {portal.id === activeId && <Check className="h-4 w-4 text-accent-600 shrink-0" />}
            </span>
          </DropdownItem>
        );
      })}
    </Dropdown>
  );
}
