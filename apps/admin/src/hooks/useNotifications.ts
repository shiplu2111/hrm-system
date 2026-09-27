import { useCallback, useEffect, useState } from 'react';
import type { InAppNotificationRecord } from '@hrm/shared-types';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications-api';
import { ApiError } from '@/lib/tenant-api-client';

const POLL_MS = 60_000;

export function useNotifications(reloadKey: number = 0) {
  const [items, setItems] = useState<InAppNotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listNotifications({ limit: 20 });
      setItems(data);
      setError(null);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load notifications';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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

  return {
    items,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  };
}
