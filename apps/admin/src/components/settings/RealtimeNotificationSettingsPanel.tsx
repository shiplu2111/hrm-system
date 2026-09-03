import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Radio } from 'lucide-react';
import type {
  NotificationEventType,
  RealtimeNotificationSettingsView,
} from '@hrm/shared-types';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { useCompany } from '@/context/CompanyContext';
import {
  REALTIME_EVENT_OPTIONS,
  getRealtimeNotificationSettings,
  updateRealtimeNotificationSettings,
} from '@/lib/settings-api';
import { ApiError } from '@/lib/tenant-api-client';

export function RealtimeNotificationSettingsPanel() {
  const { companyId } = useCompany();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<RealtimeNotificationSettingsView | null>(
    null,
  );

  const loadSettings = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getRealtimeNotificationSettings(companyId);
      setSettings(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to load realtime notification settings',
      );
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  function setLiveBroadcast(eventType: NotificationEventType, value: boolean) {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            liveBroadcast: {
              ...prev.liveBroadcast,
              [eventType]: value,
            },
          }
        : prev,
    );
  }

  async function handleSave() {
    if (!companyId || !settings) return;
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const saved = await updateRealtimeNotificationSettings(companyId, {
        enabled: settings.enabled,
        liveBroadcast: settings.liveBroadcast,
      });
      setSettings(saved);
      setSaveMessage('Real-time notification settings saved.');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to save realtime notification settings',
      );
    } finally {
      setSaving(false);
    }
  }

  if (!companyId) {
    return (
      <Card>
        <CardBody>
          <p className="text-sm text-secondary">Select a company to configure realtime delivery.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-accent-500" />
            Real-Time WebSocket Delivery
          </CardTitle>
          <p className="text-xs text-secondary mt-0.5">
            Choose which events interrupt users with a live toast vs. appearing silently in the
            notification center only. Persisted notifications are always stored regardless.
          </p>
        </div>
        <Badge tone={settings?.enabled ? 'success' : 'neutral'} dot={settings?.enabled}>
          {settings?.enabled ? 'Live delivery on' : 'Live delivery off'}
        </Badge>
      </CardHeader>
      <CardBody className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading realtime settings...
          </div>
        ) : settings ? (
          <>
            {error && (
              <div className="rounded-xl border border-danger-300 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-800 dark:bg-danger-950/30 dark:text-danger-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl border border-base px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-primary">
                  Enable live WebSocket delivery
                </div>
                <div className="text-xs text-muted">
                  When disabled, all in-app notifications remain notification-center-only.
                </div>
              </div>
              <Toggle
                checked={settings.enabled}
                onChange={(checked) =>
                  setSettings((prev) => (prev ? { ...prev, enabled: checked } : prev))
                }
              />
            </div>

            <div className="space-y-3">
              <div className="text-xs font-bold text-muted uppercase tracking-wider">
                Live broadcast per event
              </div>
              {REALTIME_EVENT_OPTIONS.map((option) => (
                <div
                  key={option.key}
                  className="flex items-start justify-between gap-4 rounded-xl border border-base px-4 py-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-primary">{option.label}</div>
                    <div className="text-xs text-muted mt-0.5">{option.description}</div>
                    <div className="text-[11px] text-secondary mt-1 font-mono">{option.key}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Toggle
                      checked={settings.liveBroadcast[option.key]}
                      disabled={!settings.enabled}
                      onChange={(checked) => setLiveBroadcast(option.key, checked)}
                    />
                    <span className="text-[10px] text-muted">
                      {settings.enabled && settings.liveBroadcast[option.key]
                        ? 'Live toast'
                        : 'Center only'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Real-Time Settings'
                )}
              </Button>
              {saveMessage && (
                <span className="text-xs text-success-700 dark:text-success-300 flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  {saveMessage}
                </span>
              )}
            </div>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}
