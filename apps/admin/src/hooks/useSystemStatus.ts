import { useEffect, useState } from 'react';
import type { PublicMaintenanceStatus } from '@hrm/shared-types';

let cachedStatus: PublicMaintenanceStatus | null = null;
const statusListeners = new Set<(s: PublicMaintenanceStatus) => void>();

export function useSystemStatus() {
  const [status, setStatus] = useState<PublicMaintenanceStatus | null>(cachedStatus);
  const [loading, setLoading] = useState<boolean>(!cachedStatus);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/v1/system/status');
      if (res.ok) {
        const body = await res.json();
        if (body?.data) {
          cachedStatus = body.data;
          setStatus(body.data);
          statusListeners.forEach((l) => l(body.data));
        }
      }
    } catch {
      // Ignore network errors during polling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleListener = (s: PublicMaintenanceStatus) => setStatus(s);
    statusListeners.add(handleListener);

    const handleMaintenanceEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const detail = customEvent.detail || {};
      const activeStatus: PublicMaintenanceStatus = {
        status: 'active',
        enabled: true,
        scheduledStart: detail.scheduledStart || null,
        scheduledEnd: detail.scheduledEnd || null,
        customMessage:
          detail.message ||
          'CMSN-HR is currently undergoing scheduled maintenance.',
        bannerActive: true,
        maintenanceActive: true,
      };
      cachedStatus = activeStatus;
      setStatus(activeStatus);
      statusListeners.forEach((l) => l(activeStatus));
    };

    window.addEventListener('hrm:maintenance-active', handleMaintenanceEvent);

    fetchStatus();
    // Poll system status every 20 seconds
    const interval = setInterval(fetchStatus, 20_000);
    return () => {
      statusListeners.delete(handleListener);
      window.removeEventListener('hrm:maintenance-active', handleMaintenanceEvent);
      clearInterval(interval);
    };
  }, []);

  return { status, loading, refetch: fetchStatus };
}
