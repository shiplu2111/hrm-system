import { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Globe,
  KeyRound,
  LockKeyhole,
  LogOut,
  Menu,
  Moon,
  Search,
  Shield,
  ShieldCheck,
  Sun,
  User,
  Users,
} from 'lucide-react';
import type { PlatformUserView } from '@hrm/shared-types';
import { Dropdown, DropdownDivider, DropdownHeader, DropdownItem } from '@/components/ui/Dropdown';
import { Avatar } from '@/components/ui/Toggle';
import { TenantSelector } from './TenantSelector';

interface PlatformHeaderProps {
  currentUser: PlatformUserView | null;
  onToggleSidebar: () => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigateToAccount?: () => void;
  onSearchSelect?: (type: 'tenant' | 'country' | 'user', id: string) => void;
}

export function PlatformHeader({
  currentUser,
  onToggleSidebar,
  onLogout,
  theme,
  onToggleTheme,
  onNavigateToAccount,
}: PlatformHeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const displayName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email
    : 'Platform Staff';
  const roleName = currentUser?.roleName || 'Platform Operator';

  return (
    <header className="h-16 bg-slate-950 text-white border-b border-slate-800/80 px-4 lg:px-6 flex items-center justify-between gap-4 shrink-0 z-30 select-none">
      {/* Left: Mobile Toggle & Unmissable Platform Branding */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Toggle Navigation"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-950/50 ring-1 ring-amber-400/30">
            <Shield className="h-5 w-5 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm tracking-tight text-white">
                CMSN-HR
              </span>
              {/* PRIMARY VISUAL CUE: Staff cannot confuse this with tenant panel */}
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black uppercase tracking-widest shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                PLATFORM
              </span>
            </div>
            <div className="text-[10px] text-slate-400 hidden sm:block">
              Super Admin Control Plane · Root Scope
            </div>
          </div>
        </div>
      </div>

      {/* Center: Global Quick-jump Search */}
      <div className="hidden md:flex flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tenants, country rules, platform staff..."
            className="w-full h-9 pl-9 pr-14 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30 transition-all"
          />
          <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-slate-500 border border-slate-700/80 rounded px-1.5 py-0.5 bg-slate-800/40">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right: Tenant Context Selector, Security Cues, Theme, Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Tenant Selector Dropdown */}
        <TenantSelector />

        <div className="hidden sm:block h-5 w-px bg-slate-800" />

        {/* Security indicator: Mandatory 2FA */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-[11px] font-semibold">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>2FA Enforced</span>
        </div>

        {/* Audit scope warning */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-[11px] font-mono">
          <LockKeyhole className="h-3 w-3 text-amber-400" />
          <span>Audit Logged</span>
        </div>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        {/* Platform Notifications/Alerts */}
        <button
          type="button"
          className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Platform operational alerts"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-slate-950" />
        </button>

        <div className="h-5 w-px bg-slate-800 mx-1" />

        {/* User Profile Dropdown */}
        <Dropdown
          width="w-72"
          trigger={
            <button
              type="button"
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/10 transition-colors text-left"
            >
              <Avatar name={displayName} size="sm" />
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-white line-clamp-1 max-w-[120px]">
                  {displayName}
                </div>
                <div className="text-[10px] text-amber-400 font-medium line-clamp-1">
                  {roleName}
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
            </button>
          }
        >
          <DropdownHeader>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary">Platform Staff Session</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 font-bold">
                ROOT
              </span>
            </div>
            <div className="text-xs text-secondary mt-1 font-mono break-all">
              {currentUser?.email}
            </div>
            <div className="text-[10px] text-muted mt-1">
              All operator actions are recorded to <code className="text-[10px]">platform_audit_logs</code>.
            </div>
          </DropdownHeader>

          <DropdownDivider />

          <DropdownItem
            icon={<User className="h-4 w-4 text-amber-500" />}
            onClick={onNavigateToAccount}
          >
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              My Account & Security
            </span>
          </DropdownItem>

          <DropdownItem
            icon={<KeyRound className="h-4 w-4 text-emerald-500" />}
            onClick={onNavigateToAccount}
          >
            <span>TOTP 2FA: Active</span>
          </DropdownItem>

          <DropdownItem
            icon={<Users className="h-4 w-4 text-indigo-500" />}
          >
            <span>Role: {roleName}</span>
          </DropdownItem>

          <DropdownDivider />

          <DropdownItem
            icon={<LogOut className="h-4 w-4 text-red-500" />}
            onClick={onLogout}
          >
            <span className="text-red-600 dark:text-red-400 font-semibold">
              Sign out of Platform
            </span>
          </DropdownItem>
        </Dropdown>
      </div>
    </header>
  );
}
