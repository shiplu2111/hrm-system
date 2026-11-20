import { useAppTranslation } from '@hrm/i18n';
import { EMPLOYEE_BOTTOM_TABS } from '@/config/employee-navigation';
import { useNav } from '@/context/NavContext';
import { usePageAccess } from '@/hooks/usePageAccess';

/**
 * Persistent mobile 5-tab bar mirroring the mobile ESS pattern
 * (NAVIGATION.md §3, UI_GUIDELINES.md §8 >=44px touch targets).
 */
export function EmployeeBottomNav() {
  const { current, navigate } = useNav();
  const { canView } = usePageAccess();
  const { t } = useAppTranslation();

  const tabs = EMPLOYEE_BOTTOM_TABS.filter((item) => canView(item.page));
  if (tabs.length === 0) return null;

  return (
    <nav
      aria-label={t('shell.employeePortal')}
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 surface border-t border-base px-1 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = current === tab.page;
          return (
            <button
              key={tab.page}
              type="button"
              onClick={() => navigate(tab.page)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] py-1.5 px-1 text-[11px] font-medium transition-colors ${
                active
                  ? 'text-accent-600 dark:text-accent-400'
                  : 'text-muted hover:text-primary'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate max-w-full leading-tight">
                {t(tab.labelKey, tab.fallbackLabel)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

