import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Mail, Radio, RotateCcw, Smartphone } from 'lucide-react';
import type { NotificationEventSetting, NotificationEventSettingsView, NotificationEventType } from '@hrm/shared-types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toggle } from '@/components/ui/Toggle';
import { OrgErrorBanner, OrgTableSkeleton } from '@/components/org/OrgScreenParts';
import { getNotificationEventSettings, updateNotificationEventSettings } from '@/lib/settings-api';
import { notificationSettingsCopy as copy } from '@/lib/notification-settings-copy';
import {
  channelOn,
  countChanges,
  defaultsDraft,
  eventMeta,
  groupEvents,
  hasAnyChannel,
  recipientsLabel,
  sameState,
  setEventChannel,
  toEventsDraft,
  toUpdateInput,
  type EventChannel,
  type EventsDraft,
} from '@/lib/notification-settings';
import { ApiError } from '@/lib/tenant-api-client';

const CHANNELS: EventChannel[] = ['inApp', 'live', 'push', 'email'];

interface Props {
  companyId: string;
  canEdit: boolean;
  /** Latest SMTP status from the SMTP tab, once it has loaded or saved. */
  smtpConfigured: boolean | null;
  onDirtyChange: (dirty: boolean) => void;
  onOpenSmtp: () => void;
}

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof ApiError || err instanceof Error ? err.message : fallback;

export function NotificationEventsPanel({ companyId, canEdit, smtpConfigured, onDirtyChange, onOpenSmtp }: Props) {
  const [view, setView] = useState<NotificationEventSettingsView | null>(null);
  const [draft, setDraft] = useState<EventsDraft | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setView(null);
    setLoadError(null);
    try {
      const data = await getNotificationEventSettings(companyId);
      setView(data);
      setDraft(toEventsDraft(data));
    } catch (err) {
      setLoadError(errorMessage(err, copy.events.loadError));
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const changes = view && draft ? countChanges(draft, view) : 0;
  useEffect(() => {
    onDirtyChange(changes > 0);
  }, [changes, onDirtyChange]);

  if (loadError) return <OrgErrorBanner message={loadError} onRetry={() => void load()} />;
  if (!view || !draft) {
    return (
      <Card className="overflow-hidden">
        <OrgTableSkeleton columns={6} rows={8} />
      </Card>
    );
  }

  const emailConfigured = smtpConfigured ?? view.channelStatus.email.configured;
  const pushConfigured = view.channelStatus.push.configured;
  const editable = canEdit && !saving;

  const updateEvent = (eventType: NotificationEventType, apply: (state: EventsDraft['events'][string]) => EventsDraft['events'][string]) => {
    setNotice(null);
    setDraft((prev) => (prev ? { ...prev, events: { ...prev.events, [eventType]: apply(prev.events[eventType]) } } : prev));
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await updateNotificationEventSettings(companyId, toUpdateInput(draft, view));
      setView(saved);
      setDraft(toEventsDraft(saved));
      setNotice(copy.events.saved);
    } catch (err) {
      setSaveError(errorMessage(err, copy.events.loadError));
    } finally {
      setSaving(false);
    }
  };

  const restoreDefaults = () => {
    if (!window.confirm(copy.events.restoreConfirm)) return;
    setNotice(null);
    setDraft(defaultsDraft(view));
  };

  const cellTitle = (event: NotificationEventSetting, channel: EventChannel): string => {
    const state = draft.events[event.eventType];
    if (!state.enabled) return copy.events.eventOff;
    if (channel === 'live') {
      if (!draft.realtimeEnabled) return copy.events.liveMasterOff;
      if (!state.channels.inApp) return copy.events.liveNeedsInApp;
    }
    if (channel === 'email' && state.channels.email && !emailConfigured) return copy.events.emailNoSmtp;
    if (channel === 'push' && state.channels.push && !pushConfigured) return copy.events.pushNotConfigured;
    return copy.events.channelHints[channel];
  };

  const renderRow = (event: NotificationEventSetting) => {
    const meta = eventMeta(event.eventType);
    const state = draft.events[event.eventType];
    const changed = !sameState(state, event);
    const modified = !sameState(state, event.defaults);
    const silent = state.enabled && !hasAnyChannel(state);

    return (
      <tr key={event.eventType} className={`border-t border-base ${changed ? 'bg-accent-50/50 dark:bg-accent-950/20' : ''}`}>
        <th scope="row" className={`text-left font-normal px-4 py-2.5 align-top border-l-2 ${changed ? 'border-accent-500' : 'border-transparent'}`}>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${state.enabled ? 'text-primary' : 'text-muted'}`}>{meta.label}</span>
            {modified ? (
              <span className="h-1.5 w-1.5 rounded-full bg-accent-500" title={copy.events.modified} aria-label={copy.events.modified} />
            ) : null}
          </div>
          <div className="text-xs text-muted mt-0.5">{meta.description}</div>
          {silent ? (
            <div className="mt-1 flex items-center gap-1 text-xs text-warning-700 dark:text-warning-300">
              <AlertTriangle className="h-3 w-3" aria-hidden /> {copy.events.noChannel}
            </div>
          ) : null}
        </th>
        <td className="px-3 py-2.5 text-center align-top">
          <div className="inline-flex pt-0.5">
            <Toggle
              size="sm"
              checked={state.enabled}
              disabled={!editable}
              label={copy.events.toggleEvent(meta.label)}
              onChange={(on) => updateEvent(event.eventType, (s) => ({ ...s, enabled: on }))}
            />
          </div>
        </td>
        {CHANNELS.map((channel) => {
          const on = channelOn(state, channel);
          const blocked =
            !state.enabled || (channel === 'live' && (!draft.realtimeEnabled || !state.channels.inApp));
          const warn =
            state.enabled &&
            on &&
            ((channel === 'email' && !emailConfigured) || (channel === 'push' && !pushConfigured));
          return (
            <td key={channel} className="px-2 py-2.5 text-center align-top">
              <span className="inline-flex items-center gap-1 pt-0.5">
                <input
                  type="checkbox"
                  checked={on && !(channel === 'live' && !draft.realtimeEnabled)}
                  disabled={!editable || blocked}
                  title={cellTitle(event, channel)}
                  aria-label={copy.events.toggleChannel(meta.label, copy.events.columns[channel])}
                  onChange={(e) => updateEvent(event.eventType, (s) => setEventChannel(s, channel, e.target.checked))}
                  className="h-4 w-4 rounded border-strong accent-accent-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                />
                {warn ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-warning-600" aria-label={cellTitle(event, channel)} />
                ) : null}
              </span>
            </td>
          );
        })}
        <td className="px-4 py-2.5 align-top text-xs text-secondary">{recipientsLabel(event)}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      {notice ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-700 dark:border-success-900/50 dark:bg-success-900/20 dark:text-success-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          {notice}
        </div>
      ) : null}

      <Card className="p-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 flex items-center justify-center shrink-0">
            <Radio className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <div className="text-sm font-semibold text-primary">{copy.events.realtimeTitle}</div>
            <p className="text-xs text-secondary mt-0.5 max-w-2xl">{copy.events.realtimeBody}</p>
            {!draft.realtimeEnabled ? <p className="text-xs text-warning-700 dark:text-warning-300 mt-1">{copy.events.realtimeOff}</p> : null}
          </div>
        </div>
        <Toggle
          checked={draft.realtimeEnabled}
          disabled={!editable}
          label={copy.events.realtimeTitle}
          onChange={(on) => {
            setNotice(null);
            setDraft((prev) => (prev ? { ...prev, realtimeEnabled: on } : prev));
          }}
        />
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-xs" aria-label={copy.events.channelStatus}>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-base px-2.5 py-1 text-secondary">
          <Bell className="h-3.5 w-3.5" aria-hidden /> {copy.events.columns.inApp}: {copy.events.inAppStatus}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
            emailConfigured
              ? 'border-base text-secondary'
              : 'border-warning-300 bg-warning-50 text-warning-700 dark:border-warning-800 dark:bg-warning-900/20 dark:text-warning-300'
          }`}
        >
          <Mail className="h-3.5 w-3.5" aria-hidden />
          {emailConfigured ? copy.events.emailReady : copy.events.emailMissing}
          {!emailConfigured ? (
            <button type="button" onClick={onOpenSmtp} className="font-semibold underline underline-offset-2">
              {copy.events.configureSmtp}
            </button>
          ) : null}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${
            pushConfigured ? 'border-base text-secondary' : 'border-base text-muted'
          }`}
        >
          <Smartphone className="h-3.5 w-3.5" aria-hidden />
          {pushConfigured ? copy.events.pushReady : copy.events.pushMissing}
        </span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="sticky top-0 z-10 bg-[rgb(var(--bg-muted))] shadow-[0_1px_0_rgb(var(--border-base))]">
              <tr>
                <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wide w-[34%]">
                  {copy.events.columns.event}
                </th>
                <th scope="col" className="px-3 py-2.5 text-center text-xs font-semibold text-secondary uppercase tracking-wide">
                  {copy.events.columns.active}
                </th>
                {CHANNELS.map((channel) => (
                  <th
                    key={channel}
                    scope="col"
                    title={copy.events.channelHints[channel]}
                    className="px-2 py-2.5 text-center text-xs font-semibold text-secondary uppercase tracking-wide whitespace-nowrap"
                  >
                    {copy.events.columns[channel]}
                  </th>
                ))}
                <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-secondary uppercase tracking-wide">
                  {copy.events.columns.recipients}
                </th>
              </tr>
            </thead>
            {groupEvents(view.events).map((group) => (
              <tbody key={group.key}>
                <tr className="border-t border-base bg-[rgb(var(--bg-muted))]/50">
                  <th colSpan={CHANNELS.length + 3} scope="colgroup" className="text-left px-4 py-1.5 text-xs font-semibold text-muted uppercase tracking-wide">
                    {group.label}
                  </th>
                </tr>
                {group.events.map(renderRow)}
              </tbody>
            ))}
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-base">
          <div className="text-xs text-muted min-w-0">
            {saveError ? (
              <span className="text-error-600 text-sm">{saveError}</span>
            ) : changes > 0 ? (
              <span className="text-sm font-medium text-primary">{copy.events.unsaved(changes)}</span>
            ) : (
              <>
                {view.updatedAt ? copy.lastUpdated(new Date(view.updatedAt).toLocaleString()) : copy.neverChanged}
                {' · '}
                {copy.events.effectNote}
              </>
            )}
          </div>
          {canEdit ? (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="ghost" size="sm" onClick={restoreDefaults} disabled={saving}>
                <RotateCcw className="h-3.5 w-3.5" /> {copy.events.restoreDefaults}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setSaveError(null);
                  setDraft(toEventsDraft(view));
                }}
                disabled={changes === 0 || saving}
              >
                {copy.events.discard}
              </Button>
              <Button variant="primary" onClick={() => void save()} disabled={changes === 0 || saving}>
                {saving ? copy.events.saving : copy.events.save}
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
