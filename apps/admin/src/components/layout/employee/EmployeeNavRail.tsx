import { X } from 'lucide-react';
import { useAppTranslation } from '@hrm/i18n';
import {
  EMPLOYEE_NAV_ITEMS,
  type EmployeeNavItem,
} from '@/config/employee-navigation';
import { useNav, type PageKey } from '@/context/NavContext';
import { usePageAccess } from '@/hooks/usePageAccess';

interface EmployeeNavRailProps {
  unreadNotifications: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function EmployeeNavRail({
  unreadNotifications,
  mobileOpen,
  onCloseMobile,
}: EmployeeNavRailProps) {
  const { current, navigate } = useNav();
  const { canView } = usePageAccess();
  const { t } = useAppTranslation();

  const visibleItems = EMPLOYEE_NAV_ITEMS.filter((item) => canView(item.page));
  const primaryItems = visibleItems.filter((item) => item.section === 'primary');
  const secondaryItems = visibleItems.filter(
    (item) => item.section === 'secondary',
  );

  const handleSelect = (page: PageKey) => {
    navigate(page);
    onCloseMobile();
  };

  const renderItem = (item: EmployeeNavItem) => {
    const Icon = item.icon;
    const active = current === item.page;
    const showUnread = item.page === 'my-notifications' && unreadNotifications > 0;

    return (
      <button
        key={item.page}
        type="button"
        onClick={() => handleSelect(item.page)}
        aria-current={active ? 'page' : undefined}
        className={`w-full flex items-center gap-3 min-h-[44px] lg:min-h-[40px] px-3 rounded-lg text-sm transition-colors ${
          active
            ? 'bg-accent-50 text-accent-700 font-semibold dark:bg-accent-950/50 dark:text-accent-300'
            : 'text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))] font-medium'
        }`}
      >
        <Icon
          className={`h-[18px] w-[18px] shrink-0 ${
            active ? 'text-accent-600 dark:text-accent-400' : ''
          }`}
        />
        <span className="flex-1 text-left truncate">
          {t(item.labelKey, item.fallbackLabel)}
        </span>
        {showUnread && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-accent-600 text-white text-[11px] font-semibold flex items-center justify-center">
            {unreadNotifications > 99 ? '99+' : unreadNotifications}
          </span>
        )}
      </button>
    );
  };

  const navContent = (
    <nav
      aria-label={t('shell.employeePortal')}
      className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-1"
    >
      <div className="space-y-1">{primaryItems.map(renderItem)}</div>
      {secondaryItems.length > 0 && (
        <div className="pt-3 mt-3 border-t border-base space-y-1">
          {secondaryItems.map(renderItem)}
        </div>
      )}
    </nav>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col w-56 surface border-r border-base shrink-0">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
            onClick={onCloseMobile}
          />
          <aside className="relative w-64 max-w-[80vw] surface border-r border-base flex flex-col shadow-xl">
            <div className="h-14 flex items-center justify-between px-4 border-b border-base shrink-0">
              <span className="text-sm font-semibold text-primary">
                {t('shell.employeePortal')}
              </span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="text-muted hover:text-primary min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-lg"
                aria-label={t('common.close')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}

