import { useCallback, useEffect, useRef, useState } from 'react';
import type { InAppNotificationRecord } from '@hrm/shared-types';
import {
  clearAllReadNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications-api';
import { ApiError } from '@/lib/tenant-api-client';

const POLL_MS = 60_000;

/** `reloadKey` identifies the session; changing it drops loaded items and ignores in-flight responses. */
export function useNotifications(
  reloadKey: string | number = 0,
  options?: { limit?: number },
) {
  const [items, setItems] = useState<InAppNotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeKey = useRef(reloadKey);
  activeKey.current = reloadKey;
  const limit = options?.limit ?? 50;

  const refresh = useCallback(async () => {
    const requestKey = activeKey.current;
    try {
      const data = await listNotifications({ limit });
      if (activeKey.current !== requestKey) return;
      setItems(data);
      setError(null);
    } catch (err) {
      if (activeKey.current !== requestKey) return;
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load notifications';
      setError(message);
    } finally {
      if (activeKey.current === requestKey) setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    setItems([]);
    setError(null);
    setLoading(true);
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [refresh, reloadKey]);

  const unreadCount = items.filter((n) => !n.readAt).length;

  const markRead = useCallback(async (id: string) => {
    await markNotificationRead(id);
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    );
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead(items);
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((item) => ({ ...item, readAt: item.readAt ?? now })),
    );
  }, [items]);

  const deleteItem = useCallback(async (id: string) => {
    await deleteNotification(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearAllRead = useCallback(async () => {
    await clearAllReadNotifications();
    setItems((current) => current.filter((item) => !item.readAt));
  }, []);

  return {
    items,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
    deleteItem,
    clearAllRead,
  };
}
