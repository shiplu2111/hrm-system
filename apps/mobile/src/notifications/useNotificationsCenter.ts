import { useCallback, useEffect, useState } from 'react';
import type { InAppNotificationRecord } from '@hrm/shared-types';
import { listNotifications, markNotificationRead } from '../api/client';
import {
  addNotificationReceivedListener,
  ensurePushRegistration,
} from './push-registration';

export function useNotificationsCenter() {
  const [items, setItems] = useState<InAppNotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushReady, setPushReady] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listNotifications();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void ensurePushRegistration()
      .then(setPushReady)
      .catch(() => setPushReady(false));

    const subscription = addNotificationReceivedListener(() => {
      void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const markRead = useCallback(
    async (id: string) => {
      await markNotificationRead(id);
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item,
        ),
      );
    },
    [],
  );

  return { items, loading, error, pushReady, refresh, markRead };
}
