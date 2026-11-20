import type { ComponentType } from 'react';
import {
  LockKeyhole,
  LogOut,
  Shield,
  X,
} from 'lucide-react';
import type { PlatformUserView } from '@hrm/shared-types';
import {
  PLATFORM_NAV_GROUPS,
  type NavItem,
  type PlatformViewKey,
} from '@/config/navigation';
import { usePermissions } from '@/hooks/usePermission';
import { filterPlatformNavGroups } from '@/lib/nav-permissions';
import { Avatar } from '@/components/ui/Toggle';

interface PlatformSidebarProps {
  currentView: PlatformViewKey;
  onSelectView: (view: PlatformViewKey) => void;
  isOpen: boolean;
  onClose: () => void;
  currentUser: PlatformUserView | null;
  onLogout: () => void;
}

export function PlatformSidebar({
  currentView,
  onSelectView,
  isOpen,
  onClose,
  currentUser,
  onLogout,
}: PlatformSidebarProps) {
  const { can } = usePermissions();

  const filteredNavGroups = filterPlatformNavGroups(PLATFORM_NAV_GROUPS, can);

  const displayName = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`.trim() || currentUser.email
    : 'Platform Staff';
  const roleName = currentUser?.roleName || 'Platform Operator';

  const badgeClasses = (tone?: string) => {
    switch (tone) {
      case 'emerald':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'amber':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'blue':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'indigo':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'slate':
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-slate-950 text-slate-200 border-r border-slate-800/80 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Header in drawer */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm text-white">CMSN Platform</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Platform Status Ribbon */}
        <div className="px-4 pt-4 pb-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-950/40 via-orange-950/30 to-slate-900 border border-amber-500/25 flex items-center gap-2.5">
            <LockKeyhole className="h-4 w-4 text-amber-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold text-amber-300 tracking-wider uppercase">
                Root Scope
              </div>
              <div className="text-[11px] text-slate-300 truncate">
                Cross-tenant authority
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Groups List */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          {filteredNavGroups.map((group) => (
            <div key={group.id} className="space-y-1">
              {/* Group Title */}
              <div className="px-3 pt-2 pb-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400/90 flex items-center justify-between">
                <span>{group.title}</span>
              </div>

              {/* Group Items */}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.key;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      onSelectView(item.key);
                      onClose();
                    }}
                    className={`w-full group flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-amber-400'
                            : 'text-slate-400 group-hover:text-slate-200'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border tracking-tight shrink-0 ${badgeClasses(
                          item.badgeTone,
                        )}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer: Authenticated User & Quick Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar name={displayName} size="sm" />
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate max-w-[110px]">
                  {displayName}
                </div>
                <div className="text-[10px] text-amber-400 font-mono truncate max-w-[110px]">
                  {roleName}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/40 transition-colors"
              title="Sign out of Platform"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
