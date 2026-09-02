import { useState } from 'react';
import {
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  Building2,
  Check,
  User,
  Settings,
  LogOut,
  HelpCircle,
  Repeat2,
  Shield,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useNav } from '@/context/NavContext';
import { Dropdown, DropdownItem, DropdownSection, DropdownDivider, DropdownHeader } from '@/components/ui/Dropdown';
import { PortalSwitcher } from '@/components/layout/PortalSwitcher';
import { Avatar } from '@/components/ui/Toggle';
const tenants = [
  { id: '1', name: 'Acme Corporation', plan: 'Enterprise', color: 'bg-accent-500' },
  { id: '2', name: 'TechFlow Labs', plan: 'Business', color: 'bg-success-500' },
  { id: '3', name: 'Globex Industries', plan: 'Enterprise', color: 'bg-warning-500' },
];

const notifications = [
  { id: 1, title: 'Leave request from Sarah Chen', time: '2m ago', tone: 'accent' as const },
  { id: 2, title: 'Payroll run approved for August', time: '1h ago', tone: 'success' as const },
  { id: 3, title: '3 contracts expiring this week', time: '3h ago', tone: 'warning' as const },
  { id: 4, title: 'New employee onboarded: James Park', time: '5h ago', tone: 'neutral' as const },
];

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { navigate } = useNav();
  const [activeTenant, setActiveTenant] = useState(tenants[0]);

  return (
    <header className="h-16 surface border-b border-base flex items-center gap-2 px-4 lg:px-6 shrink-0 z-30">
      {/* Mobile menu */}
      <button
        onClick={onOpenMobile}
        className="lg:hidden text-secondary hover:text-primary p-1.5 rounded-lg hover:bg-[rgb(var(--bg-hover))]"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Tenant switcher */}
      <Dropdown
        width="w-64"
        trigger={
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer">
            <div className={`h-7 w-7 rounded-md ${activeTenant.color} flex items-center justify-center`}>
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div className="hidden sm:flex flex-col leading-tight text-left">
              <span className="text-sm font-semibold text-primary">{activeTenant.name}</span>
              <span className="text-[10px] text-muted">{activeTenant.plan} Plan</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted" />
          </div>
        }
      >
        <DropdownHeader>
          <div className="text-xs font-semibold text-muted uppercase tracking-wider">Switch Organization</div>
        </DropdownHeader>
        <DropdownDivider />
        {tenants.map((t) => (
          <DropdownItem key={t.id} active={t.id === activeTenant.id} onClick={() => setActiveTenant(t)}>
            <div className={`h-6 w-6 rounded-md ${t.color} flex items-center justify-center`}>
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{t.name}</div>
              <div className="text-[10px] text-muted">{t.plan}</div>
            </div>
            {t.id === activeTenant.id && <Check className="h-4 w-4 text-accent-600" />}
          </DropdownItem>
        ))}
        <DropdownDivider />
        <DropdownItem icon={<Building2 className="h-4 w-4" />}>Add Organization</DropdownItem>
      </Dropdown>

      {/* Search */}
      <div className="flex-1 max-w-md mx-auto hidden md:block">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Search employees, departments, reports..."
            className="w-full h-9 pl-9 pr-16 rounded-lg border border-base surface text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 transition-colors"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted border border-base rounded px-1.5 py-0.5 surface">
            ⌘K
          </kbd>
        </div>
      </div>

      <div className="flex-1 md:hidden" />

      {/* Portal switcher: Employee / Company Admin / Super Admin */}
      <PortalSwitcher />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="text-secondary hover:text-primary p-2 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors"
        title="Toggle theme"
      >
        {theme === 'light' ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
      </button>

      {/* Notifications */}
      <Dropdown
        width="w-80"
        trigger={
          <div className="relative text-secondary hover:text-primary p-2 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer">
            <Bell className="h-[18px] w-[18px]" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-error-500 ring-2 ring-[rgb(var(--bg-surface))]" />
          </div>
        }
      >
        <DropdownHeader>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-primary">Notifications</span>
            <span className="text-xs text-accent-600 font-medium cursor-pointer">Mark all read</span>
          </div>
        </DropdownHeader>
        <DropdownDivider />
        {notifications.map((n) => (
          <div key={n.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-[rgb(var(--bg-hover))] cursor-pointer transition-colors">
            <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
              n.tone === 'accent' ? 'bg-accent-500' :
              n.tone === 'success' ? 'bg-success-500' :
              n.tone === 'warning' ? 'bg-warning-500' : 'bg-slate-400'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-primary leading-snug">{n.title}</div>
              <div className="text-[11px] text-muted mt-0.5">{n.time}</div>
            </div>
          </div>
        ))}
        <DropdownDivider />
        <DropdownItem icon={<Bell className="h-4 w-4" />}>View all notifications</DropdownItem>
      </Dropdown>

      {/* Profile */}
      <Dropdown
        width="w-56"
        trigger={
          <div className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer">
            <Avatar name="Alex Morgan" size="sm" />
            <div className="hidden sm:flex flex-col leading-tight text-left">
              <span className="text-sm font-medium text-primary">Alex Morgan</span>
              <span className="text-[10px] text-muted">Company Admin</span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted hidden sm:block" />
          </div>
        }
      >
        <DropdownHeader>
          <div className="flex items-center gap-2.5">
            <Avatar name="Alex Morgan" size="md" />
            <div>
              <div className="text-sm font-semibold text-primary">Alex Morgan</div>
              <div className="text-xs text-muted">alex@nexushr.com</div>
            </div>
          </div>
        </DropdownHeader>
        <DropdownDivider />
        <DropdownSection label="Portal access">
          <DropdownItem
            icon={<Repeat2 className="h-4 w-4" />}
            onClick={() => navigate('ess')}
          >
            <span>
              <span className="block">Switch to Employee View</span>
              <span className="block text-[10px] text-muted">Acme Corporation ESS</span>
            </span>
          </DropdownItem>
          <DropdownItem
            icon={<Shield className="h-4 w-4" />}
            onClick={() => navigate('platform-admin')}
          >
            Platform Admin Console
          </DropdownItem>
        </DropdownSection>
        <DropdownDivider />
        <DropdownSection label="Account">
          <DropdownItem icon={<User className="h-4 w-4" />}>My Profile</DropdownItem>
          <DropdownItem icon={<Settings className="h-4 w-4" />}>Preferences</DropdownItem>
        </DropdownSection>
        <DropdownDivider />
        <DropdownItem icon={<HelpCircle className="h-4 w-4" />}>Help & Support</DropdownItem>
        <DropdownItem icon={<LogOut className="h-4 w-4" />}>Sign Out</DropdownItem>
      </Dropdown>
    </header>
  );
}
