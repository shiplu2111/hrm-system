import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import type { PlatformUserView } from '@hrm/shared-types';
import {
  PLATFORM_NAV_GROUPS,
  type NavItem,
  type PlatformViewKey,
} from '@/config/navigation';
import { usePermissions } from '@/hooks/usePermission';
import { PlatformTopStrip } from './PlatformTopStrip';
import { PlatformHeader } from './PlatformHeader';
import { PlatformSidebar } from './PlatformSidebar';
import { ComingSoonPlaceholder } from '../ui/ComingSoonPlaceholder';

// Page components
import { PlatformDashboardPage } from '@/pages/platform/PlatformDashboardPage';
import { TenantsPage } from '@/pages/platform/TenantsPage';
import { SandboxTenantsPage } from '@/pages/platform/SandboxTenantsPage';
import { SystemHealthPage } from '@/pages/platform/SystemHealthPage';
import { TenantIsolationPage } from '@/pages/platform/TenantIsolationPage';
import { BrandingDomainsPage } from '@/pages/platform/BrandingDomainsPage';
import { PlatformBillingPage } from '@/pages/platform/PlatformBillingPage';
import { RevenueReportPage } from '@/pages/platform/RevenueReportPage';
import { CountryCompliancePage } from '@/pages/platform/CountryCompliancePage';
import { ComplianceCalendarPage } from '@/pages/platform/ComplianceCalendarPage';
import { RuleApprovalsInboxPage } from '@/pages/platform/RuleApprovalsInboxPage';
import { RuleSandboxPage } from '@/pages/platform/RuleSandboxPage';
import { PlatformDefaultTemplatesPage } from '@/pages/platform/PlatformDefaultTemplatesPage';
import { FeatureFlagsPage } from '@/pages/platform/FeatureFlagsPage';
import { PlatformAuditPage } from '@/pages/platform/PlatformAuditPage';
import { SupportTicketsPage } from '@/pages/platform/SupportTicketsPage';
import { PlatformUsersPage } from '@/pages/platform/PlatformUsersPage';
import { PlatformSettingsPage } from '@/pages/platform/PlatformSettingsPage';
import { MyAccountPage } from '@/pages/platform/MyAccountPage';
import { SupportSessionsLogPage } from '@/pages/platform/SupportSessionsLogPage';

interface PlatformShellProps {
  currentUser: PlatformUserView | null;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onProfileUpdated?: (user: PlatformUserView) => void;
}

export function PlatformShell({
  currentUser,
  onLogout,
  theme,
  onToggleTheme,
  onProfileUpdated,
}: PlatformShellProps) {
  const [currentView, setCurrentView] = useState<PlatformViewKey>(() => {
    const hash = window.location.hash.replace(/^#\/?/, '') as PlatformViewKey;
    return hash || 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { can } = usePermissions();

  // Flat lookup of all navigation items
  const allNavItems = useMemo(() => {
    const map = new Map<PlatformViewKey, NavItem>();
    for (const group of PLATFORM_NAV_GROUPS) {
      for (const item of group.items) {
        map.set(item.key, item);
      }
    }
    return map;
  }, []);

  // Listen for navigation events or URL hash changes
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace(/^#\/?/, '') as PlatformViewKey;
      if (hash && allNavItems.has(hash)) {
        setCurrentView(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);
    const handleNavEvent = (e: CustomEvent<PlatformViewKey>) => {
      if (e.detail && allNavItems.has(e.detail)) {
        setCurrentView(e.detail);
        window.location.hash = `#/${e.detail}`;
      }
    };
    window.addEventListener('hrm:platform-navigate', handleNavEvent as EventListener);
    return () => {
      window.removeEventListener('hashchange', handleHash);
      window.removeEventListener('hrm:platform-navigate', handleNavEvent as EventListener);
    };
  }, [allNavItems]);

  const selectView = (view: PlatformViewKey) => {
    setCurrentView(view);
    window.location.hash = `#/${view}`;
  };

  const activeItem = allNavItems.get(currentView);

  const isAccessDenied =
    activeItem?.permission &&
    !can(activeItem.permission.module, activeItem.permission.action);

  const renderContent = () => {
    if (isAccessDenied) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[480px] text-center p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm max-w-xl mx-auto my-12">
          <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mb-4">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Access Restricted
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Your platform role (<span className="font-semibold text-amber-500">{currentUser?.roleName || 'Operator'}</span>) does not have sufficient permissions to view the <span className="font-semibold">{activeItem?.label}</span> module. Contact a Platform Owner if you need access.
          </p>
          <button
            type="button"
            onClick={() => selectView('dashboard')}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 rounded-xl text-sm font-semibold transition"
          >
            Return to Dashboard
          </button>
        </div>
      );
    }

    // If it's explicitly flagged as placeholder or not yet filled
    if (activeItem?.isPlaceholder) {
      return (
        <ComingSoonPlaceholder
          item={activeItem}
          onNavigateHome={() => selectView('dashboard')}
        />
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <PlatformDashboardPage onOpenTenants={() => selectView('tenants')} />;
      case 'system-health':
        return <SystemHealthPage />;
      case 'tenants':
        return <TenantsPage initialView="list" />;
      case 'sandbox-tenants':
        return <SandboxTenantsPage />;
      case 'tenant-provisioning':
        return <TenantsPage initialView="create" />;
      case 'tenant-isolation':
        return <TenantIsolationPage />;
      case 'branding-domains':
        return <BrandingDomainsPage />;
      case 'billing':
        return <PlatformBillingPage />;
      case 'billing-invoices':
        return <RevenueReportPage />;
      case 'country-compliance':
        return <CountryCompliancePage />;
      case 'compliance-calendar':
        return <ComplianceCalendarPage />;
      case 'rule-approvals':
        return <RuleApprovalsInboxPage />;
      case 'rule-sandbox':
        return <RuleSandboxPage />;
      case 'provisioning-templates':
        return <PlatformDefaultTemplatesPage />;
      case 'feature-flags':
        return <FeatureFlagsPage />;
      case 'platform-audit':
        return <PlatformAuditPage />;
      case 'support-tickets':
        return <SupportTicketsPage />;
      case 'support-sessions':
        return <SupportSessionsLogPage />;
      case 'platform-users':
        return <PlatformUsersPage />;
      case 'platform-settings':
        return <PlatformSettingsPage />;
      case 'my-account':
        return <MyAccountPage currentUser={currentUser} onProfileUpdated={onProfileUpdated} />;
      default:
        return (
          <ComingSoonPlaceholder
            item={
              activeItem ?? {
                key: currentView,
                label: 'Module',
                description: 'This platform module is under active construction.',
                icon: () => null,
              }
            }
            onNavigateHome={() => selectView('dashboard')}
          />
        );
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* 1. Unmistakable colored top strip (visual cue) */}
      <PlatformTopStrip />

      {/* 2. Top Header */}
      <PlatformHeader
        currentUser={currentUser}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onLogout={onLogout}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onNavigateToAccount={() => selectView('my-account')}
      />

      {/* 3. Main Workspace Area: Left Sidebar + Content Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar */}
        <PlatformSidebar
          currentView={currentView}
          onSelectView={selectView}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentUser={currentUser}
          onLogout={onLogout}
        />

        {/* Content Area */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4 lg:p-6 xl:p-8 bg-slate-100 dark:bg-slate-950">
          <div className="max-w-[1600px] mx-auto">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}
