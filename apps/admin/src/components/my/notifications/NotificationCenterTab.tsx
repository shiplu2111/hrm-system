import { useMemo, useState } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Lock,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  getNotificationCategoryForEvent,
  type InAppNotificationRecord,
  type NotificationCategory,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { useNav } from '@/context/NavContext';
import { usePageAccess } from '@/hooks/usePageAccess';
import {
  formatLocalizedRelativeTime,
  NOTIFICATION_TONE_DOT,
  notificationToneForEvent,
  resolveNotificationTargetPage,
} from '@/lib/notification-links';

interface NotificationCenterTabProps {
  items: InAppNotificationRecord[];
  loading: boolean;
  error: string | null;
  onMarkRead: (id: string) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onClearAllRead: () => Promise<void>;
}

type StatusFilter = 'all' | 'unread' | 'read';

const CATEGORY_KEYS: Array<{ id: NotificationCategory | 'all'; labelKey: string }> = [
  { id: 'all', labelKey: 'notificationsPage.allCategories' },
  { id: 'security_critical', labelKey: 'notificationsPage.categories.security_critical' },
  { id: 'leave_attendance', labelKey: 'notificationsPage.categories.leave_attendance' },
  { id: 'payroll_compensation', labelKey: 'notificationsPage.categories.payroll_compensation' },
  { id: 'approvals_tasks', labelKey: 'notificationsPage.categories.approvals_tasks' },
  { id: 'engagement_social', labelKey: 'notificationsPage.categories.engagement_social' },
  { id: 'compliance_documents', labelKey: 'notificationsPage.categories.compliance_documents' },
];

export function NotificationCenterTab({
  items,
  loading,
  error: _error,
  onMarkRead,
  onMarkAllRead,
  onDeleteItem,
  onClearAllRead,
}: NotificationCenterTabProps) {
  const { t } = useAppTranslation();
  const { navigate } = useNav();
  const { selfServiceOnly, canView } = usePageAccess();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const unreadCount = useMemo(() => items.filter((n) => !n.readAt).length, [items]);
  const readCount = useMemo(() => items.filter((n) => Boolean(n.readAt)).length, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Status Filter
      if (statusFilter === 'unread' && item.readAt) return false;
      if (statusFilter === 'read' && !item.readAt) return false;

      // 2. Category Filter
      const cat = getNotificationCategoryForEvent(item.eventType);
      if (categoryFilter !== 'all' && cat !== categoryFilter) return false;

      // 3. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const titleMatch = item.title.toLowerCase().includes(query);
        const bodyMatch = item.body?.toLowerCase().includes(query) ?? false;
        if (!titleMatch && !bodyMatch) return false;
      }

      return true;
    });
  }, [items, statusFilter, categoryFilter, searchQuery]);

  const handleOpenNotification = async (item: InAppNotificationRecord) => {
    try {
      if (!item.readAt) {
        await onMarkRead(item.id);
      }
      const target = resolveNotificationTargetPage(item.eventType, {
        selfServiceOnly,
      });
      if (target && target !== 'my-notifications' && canView(target)) {
        navigate(target);
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t('notificationsPage.actionError'),
      );
    }
  };

  const handleMarkItemRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setActionError(null);
    try {
      await onMarkRead(id);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : t('notificationsPage.markReadError'),
      );
    }
  };

  const handleDeleteItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="p-3 text-sm rounded-xl bg-error-50 text-error-700 border border-error-200 dark:bg-error-950/40 dark:text-error-300 dark:border-error-800 flex items-center justify-between">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="min-h-[40px] px-3 py-1 text-error-600 hover:text-error-800 text-xs font-semibold rounded-lg"
          >
            {t('common.dismiss')}
          </button>
        </div>
      )}

      {/* Toolbar / Filters with Mobile-Friendly Touch Targets */}
      <div className="flex flex-col gap-3">
        {/* Row 1: Search & Global Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('notificationsPage.searchPlaceholder')}
              className="w-full min-h-[44px] pl-10 pr-10 py-2.5 text-sm rounded-xl border border-base bg-[rgb(var(--bg-surface))] text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1 min-h-[40px] min-w-[40px] flex items-center justify-center text-muted hover:text-primary rounded-lg"
                title={t('notificationsPage.clearSearch')}
                aria-label={t('notificationsPage.clearSearch')}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            {unreadCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void onMarkAllRead()}
                disabled={loading}
                className="min-h-[44px] px-4 py-2.5 rounded-xl font-medium"
              >
                <CheckCheck className="h-4 w-4" />
                <span>{t('notificationsPage.markAllRead')}</span>
              </Button>
            )}
            {readCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setConfirmClearAll(true)}
                disabled={loading}
                className="min-h-[44px] px-4 py-2.5 rounded-xl font-medium"
              >
                <Trash2 className="h-4 w-4" />
                <span>{t('notificationsPage.clearAllRead')}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Status Filter Tabs & Category Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[rgb(var(--bg-muted))]">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-[rgb(var(--bg-surface))] text-primary shadow-sm font-semibold'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {t('notificationsPage.all')} ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('unread')}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
                statusFilter === 'unread'
                  ? 'bg-[rgb(var(--bg-surface))] text-primary shadow-sm font-semibold'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <span>{t('notificationsPage.unread')}</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-accent-100 text-accent-700 dark:bg-accent-950 dark:text-accent-300">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('read')}
              className={`min-h-[40px] px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                statusFilter === 'read'
                  ? 'bg-[rgb(var(--bg-surface))] text-primary shadow-sm font-semibold'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {t('notificationsPage.read')} ({readCount})
            </button>
          </div>

          {/* Category Dropdown Filter */}
          <div className="flex items-center gap-2">
            <label htmlFor="cat-filter" className="text-xs sm:text-sm font-medium text-secondary">
              {t('notificationsPage.categoryLabel')}:
            </label>
            <select
              id="cat-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as NotificationCategory | 'all')}
              className="min-h-[40px] text-xs sm:text-sm rounded-xl border border-base bg-[rgb(var(--bg-surface))] text-primary py-2 px-3 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              {CATEGORY_KEYS.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {t(cat.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <Card>
        {filteredItems.length === 0 ? (
          <CardBody>
            <EmptyState
              compact
              icon={Bell}
              title={t('notificationsPage.title')}
              description={
                searchQuery || categoryFilter !== 'all'
                  ? t('notificationsPage.emptyFiltered')
                  : statusFilter === 'unread'
                    ? t('notificationsPage.emptyUnread')
                    : t('notificationsPage.emptyAll')
              }
            />
            {(searchQuery || categoryFilter !== 'all') && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  className="min-h-[44px] px-4 py-2 rounded-xl"
                  onClick={() => {
                    setSearchQuery('');
                    setCategoryFilter('all');
                  }}
                >
                  {t('notificationsPage.clearFilter')}
                </Button>
              </div>
            )}
          </CardBody>
        ) : (
          <div className="divide-y divide-[rgb(var(--border-base))]">
            {filteredItems.map((n) => {
              const tone = notificationToneForEvent(n.eventType);
              const category = getNotificationCategoryForEvent(n.eventType);
              const isCritical = category === 'security_critical';
              const target = resolveNotificationTargetPage(n.eventType, {
                selfServiceOnly,
              });
              const canDeepLink = Boolean(
                target && target !== 'my-notifications' && canView(target),
              );

              return (
                <div
                  key={n.id}
                  onClick={() => void handleOpenNotification(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void handleOpenNotification(n);
                    }
                  }}
                  className={`group w-full flex flex-col sm:flex-row items-start gap-3 px-4 py-4 text-left transition-colors cursor-pointer hover:bg-[rgb(var(--bg-hover))] ${
                    n.readAt ? 'opacity-85' : 'bg-accent-50/20 dark:bg-accent-950/10'
                  }`}
                >
                  {/* Status tone dot & Header row on mobile */}
                  <div className="w-full flex items-start gap-3">
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${NOTIFICATION_TONE_DOT[tone]}`}
                    />

                    {/* Notification Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`text-sm sm:text-base ${
                            n.readAt ? 'font-medium text-primary' : 'font-semibold text-primary'
                          } truncate`}
                        >
                          {n.title}
                        </span>

                        {/* Category Badge */}
                        <Badge
                          tone={isCritical ? 'error' : 'neutral'}
                          className="text-[10px] uppercase font-mono tracking-wider shrink-0"
                        >
                          {isCritical && <Lock className="h-3 w-3 inline mr-1" />}
                          {t(`notificationsPage.categories.${category}`)}
                        </Badge>

                        <span className="text-xs text-muted ml-auto shrink-0">
                          {formatLocalizedRelativeTime(n.createdAt, t)}
                        </span>
                      </div>

                      {n.body && (
                        <p className="text-xs sm:text-sm text-secondary leading-relaxed line-clamp-2 mt-0.5">
                          {n.body}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions - Comfortable Large Touch Targets on Mobile and Desktop */}
                  <div
                    className="flex items-center gap-2 shrink-0 self-end sm:self-center mt-2 sm:mt-0 pl-5 sm:pl-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canDeepLink && (
                      <button
                        type="button"
                        onClick={() => void handleOpenNotification(n)}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-accent-50 text-accent-700 hover:bg-accent-100 dark:bg-accent-950/60 dark:text-accent-300 flex items-center gap-1.5 transition-colors"
                        title={t('notificationsPage.openTarget')}
                      >
                        <span>{t('notificationsPage.openTarget')}</span>
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    )}

                    {!n.readAt && (
                      <button
                        type="button"
                        onClick={(e) => void handleMarkItemRead(e, n.id)}
                        className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-muted hover:text-accent-600 active:bg-[rgb(var(--bg-muted))] transition-colors"
                        title={t('notificationsPage.markRead')}
                        aria-label={t('notificationsPage.markRead')}
                      >
                        <Check className="h-5 w-5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => void handleDeleteItem(e, n.id)}
                      className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-muted hover:text-error-600 active:bg-error-50 transition-colors"
                      title={t('notificationsPage.delete')}
                      aria-label={t('notificationsPage.delete')}
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>

                    {!n.readAt && (
                      <span className="h-2.5 w-2.5 rounded-full bg-accent-500 shrink-0 ml-1" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Delete Single Item Confirm Dialog */}
      <ConfirmDialog
        open={confirmDeleteId !== null}
        title={t('notificationsPage.delete')}
        description={t('notificationsPage.deleteConfirm')}
        confirmLabel={t('notificationsPage.delete')}
        tone="danger"
        onConfirm={async () => {
          if (confirmDeleteId) {
            await onDeleteItem(confirmDeleteId);
            setConfirmDeleteId(null);
          }
        }}
        onClose={() => setConfirmDeleteId(null)}
      />

      {/* Clear All Read Confirm Dialog */}
      <ConfirmDialog
        open={confirmClearAll}
        title={t('notificationsPage.clearAllRead')}
        description={t('notificationsPage.clearConfirm')}
        confirmLabel={t('notificationsPage.clearAllRead')}
        tone="danger"
        onConfirm={async () => {
          await onClearAllRead();
          setConfirmClearAll(false);
        }}
        onClose={() => setConfirmClearAll(false)}
      />
    </div>
  );
}
