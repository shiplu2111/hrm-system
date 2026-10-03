import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bell, Info, Mail, type LucideIcon } from 'lucide-react';
import { usePermissions } from '@hrm/portal-ui';
import { Card } from '@/components/ui/Card';
import { CompanySelector } from '@/components/org/CompanySelector';
import { useCompany } from '@/context/CompanyContext';
import { notificationSettingsCopy as copy } from '@/lib/notification-settings-copy';
import { NotificationEventsPanel } from './NotificationEventsPanel';
import { SmtpSettingsForm } from './SmtpSettingsForm';

type Tab = 'events' | 'smtp';
const TABS: Array<{ key: Tab; icon: LucideIcon }> = [
  { key: 'events', icon: Bell },
  { key: 'smtp', icon: Mail },
];

export function NotificationSettingsScreen() {
  const { companyId } = useCompany();
  const { can } = usePermissions();
  const canEdit = can('settings', 'edit');
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab = searchParams.get('tab') === 'smtp' ? 'smtp' : 'events';
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const [eventsDirty, setEventsDirty] = useState(false);
  const [smtpDirty, setSmtpDirty] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const dirty = eventsDirty || smtpDirty;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    setSmtpConfigured(null);
  }, [companyId]);

  const selectTab = useCallback(
    (next: Tab) =>
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === 'events') params.delete('tab');
          else params.set('tab', next);
          return params;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = TABS[(TABS.findIndex((t) => t.key === tab) + 1) % TABS.length].key;
    selectTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-primary">{copy.title}</h2>
          <p className="text-sm text-secondary mt-0.5 max-w-2xl">{copy.description}</p>
        </div>
        <CompanySelector />
      </div>

      {!canEdit ? (
        <p className="flex items-start gap-2 text-sm text-secondary">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-muted" aria-hidden /> {copy.readOnly}
        </p>
      ) : null}

      <div role="tablist" aria-label={copy.tabs.label} className="inline-flex p-1 rounded-lg border border-base surface gap-1">
        {TABS.map(({ key, icon: Icon }) => {
          const selected = key === tab;
          const pending = key === 'events' ? eventsDirty : smtpDirty;
          return (
            <button
              key={key}
              ref={(node) => {
                tabRefs.current[key] = node;
              }}
              type="button"
              role="tab"
              id={`notification-tab-${key}`}
              aria-selected={selected}
              aria-controls={`notification-panel-${key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(key)}
              onKeyDown={onTabKeyDown}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                selected ? 'bg-accent-600 text-white shadow-sm' : 'text-secondary hover:text-primary'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {copy.tabs[key]}
              {pending ? <span className={`h-1.5 w-1.5 rounded-full ${selected ? 'bg-white' : 'bg-accent-500'}`} aria-hidden /> : null}
            </button>
          );
        })}
      </div>

      {!companyId ? (
        <Card className="p-5 text-sm text-secondary">{copy.selectCompany}</Card>
      ) : (
        <>
          <div id="notification-panel-events" role="tabpanel" aria-labelledby="notification-tab-events" hidden={tab !== 'events'}>
            <NotificationEventsPanel
              key={companyId}
              companyId={companyId}
              canEdit={canEdit}
              smtpConfigured={smtpConfigured}
              onDirtyChange={setEventsDirty}
              onOpenSmtp={() => selectTab('smtp')}
            />
          </div>
          <div id="notification-panel-smtp" role="tabpanel" aria-labelledby="notification-tab-smtp" hidden={tab !== 'smtp'}>
            <SmtpSettingsForm
              key={companyId}
              companyId={companyId}
              canEdit={canEdit}
              onDirtyChange={setSmtpDirty}
              onConfiguredChange={setSmtpConfigured}
            />
          </div>
        </>
      )}
    </div>
  );
}
