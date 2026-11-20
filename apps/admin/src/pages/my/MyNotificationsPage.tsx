import { useMemo, useState } from 'react';
import { Bell, CheckCheck, RefreshCw, SlidersHorizontal } from 'lucide-react';
import type { InAppNotificationRecord } from '@hrm/shared-types';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppTranslation } from '@hrm/i18n';
import { MyPageLayout } from '@/components/my/MyPageLayout';
import { NotificationCenterTab } from '@/components/my/notifications/NotificationCenterTab';
import { NotificationPreferencesTab } from '@/components/my/notifications/NotificationPreferencesTab';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useNav } from '@/context/NavContext';
import { useTenant } from '@/context/TenantContext';
import { useNotifications } from '@/hooks/useNotifications';
import { usePageAccess } from '@/hooks/usePageAccess';
import { resolveNotificationTargetPage } from '@/lib/notification-links';

type FilterTab = 'all' | 'unread';
type Tab = 'center' | 'preferences';

export function MyNotificationsPage() {
  const { t } = useAppTranslation();
  const { tenantKey } = useTenant();
  const { navigate: navNavigate } = useNav();
  const { selfServiceOnly, canView } = usePageAccess();
  const {
    items,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
    deleteItem,
    clearAllRead,
  } = useNotifications(tenantKey, { limit: 100 });

  const [filter, setFilter] = useState<FilterTab>('all');
  const location = useLocation();
  const navigate = useNavigate();

  const visibleItems = useMemo(
    () => (filter === 'unread' ? items.filter((n) => !n.readAt) : items),
    [filter, items],
  );

  const tabFromUrl =
    new URLSearchParams(location.search).get('tab') === 'preferences'
      ? 'preferences'
      : 'center';
  const [tab, setTab] = useState<Tab>(tabFromUrl);

  const handleOpenNotification = async (item: InAppNotificationRecord) => {
    if (!item.readAt) {
      await markRead(item.id);
    }
    const target = resolveNotificationTargetPage(item.eventType, {
      selfServiceOnly,
    });
    if (target && target !== 'my-notifications' && canView(target)) {
      navNavigate(target);
    }
  };

  const selectTab = (next: Tab) => {
    setTab(next);
    navigate(
      { search: next === 'center' ? '' : '?tab=preferences' },
      { replace: true },
    );
  };

  return (
    <MyPageLayout
      title={t('notificationsPage.title')}
      subtitle={t('notificationsPage.subtitle')}
      loading={loading && items.length === 0}
      error={error && items.length === 0 ? error : null}
      actions={
        <div className="flex items-center gap-2">
          {tab === 'center' && unreadCount > 0 && (
            <>
              <Badge tone="accent" dot>
                {t('notificationsPage.unreadLabel', { count: unreadCount })}
              </Badge>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void markAllRead()}
              >
                <CheckCheck className="h-4 w-4" />
                {t('notificationsPage.markAllRead')}
              </Button>
            </>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
            title={t('common.refresh')}
            aria-label={t('common.refresh')}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Top Nav Tabs */}
        <div className="flex items-center gap-2.5 border-b border-base pb-3">
          <button
            type="button"
            onClick={() => selectTab('center')}
            className={`min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
              tab === 'center'
                ? 'bg-accent-50 text-accent-700 border-accent-200 dark:bg-accent-950/50 dark:text-accent-300 dark:border-accent-800 shadow-sm'
                : 'surface text-secondary border-base hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            <Bell className="h-4 w-4" />
            <span>{t('notificationsPage.tabCenter')}</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-600 text-white dark:bg-accent-500">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => selectTab('preferences')}
            className={`min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
              tab === 'preferences'
                ? 'bg-accent-50 text-accent-700 border-accent-200 dark:bg-accent-950/50 dark:text-accent-300 dark:border-accent-800 shadow-sm'
                : 'surface text-secondary border-base hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>{t('notificationsPage.tabPreferences')}</span>
          </button>
        </div>

        {/* Tab Content */}
        {tab === 'center' ? (
          <NotificationCenterTab
            items={items}
            loading={loading}
            error={error}
            onMarkRead={async (id: string) => {
              await markRead(id);
            }}
            onMarkAllRead={async () => {
              await markAllRead();
            }}
            onDeleteItem={async (id: string) => {
              await deleteItem(id);
            }}
            onClearAllRead={async () => {
              await clearAllRead();
            }}
          />
        ) : (
          <NotificationPreferencesTab />
        )}
      </div>
    </MyPageLayout>
  );
}
