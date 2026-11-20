import { Bell, ListFilter, Loader2 } from 'lucide-react';
import type { InAppNotificationRecord } from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { PermissionGate } from '@hrm/portal-ui';
import { useNav } from '@/context/NavContext';
import { usePageAccess } from '@/hooks/usePageAccess';
import {
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
} from '@/components/ui/Dropdown';
import { formatRelativeTime } from '@/lib/dashboard-api';
import {
  NOTIFICATION_TONE_DOT,
  notificationToneForEvent,
} from '@/lib/notification-links';

export function NotificationBell({
  items,
  unreadCount,
  loading,
  error,
  onOpen,
  onSelect,
  onMarkAllRead,
}: {
  items: InAppNotificationRecord[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  onOpen: () => void;
  onSelect: (notification: InAppNotificationRecord) => void;
  onMarkAllRead: () => void;
}) {
  const { navigate } = useNav();
  const { canView } = usePageAccess();
  const { t } = useAppTranslation();
  const canOpenNotificationsPage = canView('my-notifications');

  return (
    <Dropdown
      width="w-80"
      onOpenChange={(open) => {
        if (open) onOpen();
      }}
      trigger={
        <div
          className="relative text-secondary hover:text-primary p-2 rounded-lg hover:bg-[rgb(var(--bg-hover))] transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
          aria-label={
            unreadCount > 0
              ? `${t('shell.notifications')}, ${t('notificationsPage.unreadLabel', { count: unreadCount })}`
              : t('shell.notifications')
          }
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-error-600 text-white text-[10px] font-semibold flex items-center justify-center ring-2 ring-[rgb(var(--bg-surface))]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      }
    >
      <DropdownHeader>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-primary">
            {t('shell.notifications')}
          </span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkAllRead();
              }}
              className="text-xs text-accent-600 font-medium hover:text-accent-700"
            >
              {t('notificationsPage.markAllRead')}
            </button>
          )}
        </div>
      </DropdownHeader>
      <DropdownDivider />

      {loading && items.length === 0 && (
        <div className="flex items-center justify-center py-8 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {error && items.length === 0 && (
        <div className="px-3 py-6 text-center text-sm text-error-600">{error}</div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="px-3 py-8 text-center text-sm text-muted">
          {t('notificationsPage.emptyAll')}
        </div>
      )}

      {items.map((n) => {
        const tone = notificationToneForEvent(n.eventType);
        return (
          <button
            key={n.id}
            type="button"
            onClick={() => onSelect(n)}
            className={`w-full flex items-start gap-3 px-3 py-2.5 hover:bg-[rgb(var(--bg-hover))] transition-colors text-left ${
              n.readAt ? 'opacity-75' : ''
            }`}
          >
            <span
              className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${NOTIFICATION_TONE_DOT[tone]}`}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm text-primary leading-snug font-medium">
                {n.title}
              </div>
              {n.body && (
                <div className="text-xs text-secondary mt-0.5 line-clamp-2">
                  {n.body}
                </div>
              )}
              <div className="text-[11px] text-muted mt-0.5">
                {formatRelativeTime(n.createdAt)}
              </div>
            </div>
            {!n.readAt && (
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent-500 shrink-0" />
            )}
          </button>
        );
      })}

      {(canOpenNotificationsPage || items.length > 0) && (
        <>
          <DropdownDivider />
          {canOpenNotificationsPage && (
            <DropdownItem
              icon={<ListFilter className="h-4 w-4" />}
              onClick={() => navigate('my-notifications')}
            >
              {t('shell.viewAllNotifications')}
            </DropdownItem>
          )}
          <PermissionGate module="settings" action="view">
            <DropdownItem
              icon={<Bell className="h-4 w-4" />}
              onClick={() => navigate('settings-notifications')}
            >
              Notification settings
            </DropdownItem>
          </PermissionGate>
        </>
      )}
    </Dropdown>
  );
}
