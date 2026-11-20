import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Lock,
  Mail,
  RotateCcw,
  Save,
  ShieldAlert,
  Smartphone,
} from 'lucide-react';
import type {
  NotificationCategory,
  NotificationCategoryChannelPreference,
  UserNotificationPreferencesView,
} from '@hrm/shared-types';
import { useAppTranslation } from '@hrm/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Toggle } from '@/components/ui/Toggle';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/notifications-api';
import { ApiError } from '@/lib/tenant-api-client';

export function NotificationPreferencesTab() {
  const { t } = useAppTranslation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [preferences, setPreferences] = useState<NotificationCategoryChannelPreference[]>([]);
  const [initialPreferences, setInitialPreferences] = useState<NotificationCategoryChannelPreference[]>([]);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: UserNotificationPreferencesView = await getNotificationPreferences();
      setPreferences(res.categories);
      setInitialPreferences(res.categories);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('notificationsPage.preferences.preferencesLoadError'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const isDirty = useMemo(() => {
    if (preferences.length !== initialPreferences.length) return false;
    return preferences.some((pref, index) => {
      const initial = initialPreferences[index];
      if (!initial) return false;
      return (
        pref.inApp !== initial.inApp ||
        pref.email !== initial.email ||
        pref.push !== initial.push
      );
    });
  }, [preferences, initialPreferences]);

  const handleToggleChannel = (
    category: NotificationCategory,
    channel: 'inApp' | 'email' | 'push',
    value: boolean,
  ) => {
    setSaveSuccess(false);
    setSaveError(null);
    setPreferences((prev) =>
      prev.map((item) => {
        if (item.category !== category) return item;
        // Enforce critical non-suppressible rule in UI state
        if (item.isCritical && (channel === 'inApp' || channel === 'email')) {
          return item; // locked
        }
        return {
          ...item,
          [channel]: value,
        };
      }),
    );
  };

  const handleResetDefaults = () => {
    setSaveSuccess(false);
    setSaveError(null);
    setPreferences((prev) =>
      prev.map((item) => ({
        ...item,
        inApp: true,
        email: item.companyAllowed.email,
        push: item.companyAllowed.push,
      })),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const payload = {
        preferences: preferences.map((p) => ({
          category: p.category,
          inApp: p.inApp,
          email: p.email,
          push: p.push,
        })),
      };
      const res = await updateNotificationPreferences(payload);
      setPreferences(res.categories);
      setInitialPreferences(res.categories);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : t('notificationsPage.preferences.saveError'),
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-4 space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
        </Card>
        <Card className="divide-y divide-base">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-6 w-12" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardBody className="text-center py-8">
          <AlertCircle className="h-8 w-8 text-error-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-primary mb-3">{error}</p>
          <Button
            variant="secondary"
            size="sm"
            className="min-h-[44px] px-4 rounded-xl"
            onClick={() => void loadPreferences()}
          >
            {t('common.retry')}
          </Button>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Critical Security Callout Banner */}
      <div className="rounded-2xl border border-warning-200 bg-warning-50/70 p-4 sm:p-5 dark:border-warning-900/50 dark:bg-warning-950/30 flex items-start gap-3.5">
        <div className="rounded-xl bg-warning-100 p-2 text-warning-700 dark:bg-warning-900/50 dark:text-warning-300 shrink-0">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-warning-900 dark:text-warning-200">
            {t('notificationsPage.preferences.securityBannerTitle')}
          </h3>
          <p className="text-xs sm:text-sm text-warning-800 dark:text-warning-300/90 mt-0.5 leading-relaxed">
            {t('notificationsPage.preferences.securityBannerDesc')}
          </p>
        </div>
      </div>

      {/* Save Success / Error Alerts */}
      {saveSuccess && (
        <div className="p-3.5 text-sm rounded-xl bg-success-50 text-success-700 border border-success-200 dark:bg-success-950/40 dark:text-success-300 dark:border-error-800 flex items-center gap-2.5">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-success-600" />
          <span className="font-medium">{t('notificationsPage.preferences.saveSuccess')}</span>
        </div>
      )}
      {saveError && (
        <div className="p-3.5 text-sm rounded-xl bg-error-50 text-error-700 border border-error-200 dark:bg-error-950/40 dark:text-error-300 dark:border-error-800 flex items-center gap-2.5">
          <AlertCircle className="h-5 w-5 shrink-0 text-error-600" />
          <span className="font-medium">{saveError}</span>
        </div>
      )}

      {/* Main Card with Channel Settings */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-base px-5 py-4">
          <div>
            <CardTitle className="text-base font-semibold">
              {t('notificationsPage.preferences.title')}
            </CardTitle>
            <p className="text-xs sm:text-sm text-secondary mt-0.5">
              {t('notificationsPage.preferences.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetDefaults}
              disabled={saving}
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium"
            >
              <RotateCcw className="h-4 w-4" />
              <span>{t('notificationsPage.preferences.reset')}</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void handleSave()}
              disabled={!isDirty || saving}
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold"
            >
              <Save className="h-4 w-4" />
              <span>
                {saving
                  ? t('notificationsPage.preferences.saving')
                  : t('notificationsPage.preferences.save')}
              </span>
            </Button>
          </div>
        </CardHeader>

        {/* Table Header for Channels (Desktop) */}
        <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-5 py-2.5 bg-[rgb(var(--bg-muted))] text-xs font-semibold text-secondary border-b border-base">
          <div className="sm:col-span-6">{t('notificationsPage.categoryLabel')}</div>
          <div className="sm:col-span-2 text-center flex items-center justify-center gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            <span>{t('notificationsPage.channels.inApp')}</span>
          </div>
          <div className="sm:col-span-2 text-center flex items-center justify-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            <span>{t('notificationsPage.channels.email')}</span>
          </div>
          <div className="sm:col-span-2 text-center flex items-center justify-center gap-1.5">
            <Smartphone className="h-3.5 w-3.5" />
            <span>{t('notificationsPage.channels.push')}</span>
          </div>
        </div>

        {/* Categories List */}
        <div className="divide-y divide-[rgb(var(--border-base))]">
          {preferences.map((item) => {
            const isCritical = item.isCritical;
            const emailAllowed = item.companyAllowed.email;
            const pushAllowed = item.companyAllowed.push;

            return (
              <div
                key={item.category}
                className={`p-4 sm:px-5 sm:py-4.5 flex flex-col sm:grid sm:grid-cols-12 gap-4 items-start sm:items-center transition-colors ${
                  isCritical ? 'bg-slate-50/50 dark:bg-slate-900/20' : ''
                }`}
              >
                {/* Category Info */}
                <div className="sm:col-span-6 space-y-1 w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm sm:text-base font-semibold text-primary">
                      {t(`notificationsPage.categories.${item.category}`)}
                    </span>
                    {isCritical && (
                      <Badge tone="error" className="text-[10px] uppercase font-mono">
                        <Lock className="h-2.5 w-2.5 inline mr-1" />
                        {t('notificationsPage.preferences.mandatory')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-secondary leading-relaxed">
                    {t(`notificationsPage.categories.${item.category}_desc`)}
                  </p>
                </div>

                {/* In-App Feed Channel Toggle */}
                <div className="sm:col-span-2 flex sm:flex-col items-center justify-between sm:justify-center w-full sm:w-auto min-h-[48px] py-1.5 px-3 rounded-xl bg-[rgb(var(--bg-muted))]/40 sm:bg-transparent">
                  <span className="sm:hidden text-xs font-medium text-secondary flex items-center gap-1.5">
                    <Bell className="h-4 w-4" />
                    {t('notificationsPage.channels.inApp')}
                  </span>
                  <div className="flex flex-col items-center gap-0.5">
                    <Toggle
                      checked={item.inApp}
                      onChange={(checked) =>
                        handleToggleChannel(item.category, 'inApp', checked)
                      }
                      disabled={isCritical || saving}
                      label={t('notificationsPage.channels.inApp')}
                    />
                    {isCritical && (
                      <span className="text-[10px] text-muted flex items-center gap-0.5">
                        <Lock className="h-2.5 w-2.5" />
                        {t('notificationsPage.preferences.mandatory')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Email Channel Toggle */}
                <div className="sm:col-span-2 flex sm:flex-col items-center justify-between sm:justify-center w-full sm:w-auto min-h-[48px] py-1.5 px-3 rounded-xl bg-[rgb(var(--bg-muted))]/40 sm:bg-transparent">
                  <span className="sm:hidden text-xs font-medium text-secondary flex items-center gap-1.5">
                    <Mail className="h-4 w-4" />
                    {t('notificationsPage.channels.email')}
                  </span>
                  <div className="flex flex-col items-center gap-0.5">
                    <Toggle
                      checked={item.email}
                      onChange={(checked) =>
                        handleToggleChannel(item.category, 'email', checked)
                      }
                      disabled={isCritical || !emailAllowed || saving}
                      label={t('notificationsPage.channels.email')}
                    />
                    {isCritical ? (
                      <span className="text-[10px] text-muted flex items-center gap-0.5">
                        <Lock className="h-2.5 w-2.5" />
                        {t('notificationsPage.preferences.mandatory')}
                      </span>
                    ) : !emailAllowed ? (
                      <span className="text-[10px] text-muted text-center max-w-[120px]">
                        {t('notificationsPage.preferences.companyDisabled')}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Push Channel Toggle */}
                <div className="sm:col-span-2 flex sm:flex-col items-center justify-between sm:justify-center w-full sm:w-auto min-h-[48px] py-1.5 px-3 rounded-xl bg-[rgb(var(--bg-muted))]/40 sm:bg-transparent">
                  <span className="sm:hidden text-xs font-medium text-secondary flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4" />
                    {t('notificationsPage.channels.push')}
                  </span>
                  <div className="flex flex-col items-center gap-0.5">
                    <Toggle
                      checked={item.push}
                      onChange={(checked) =>
                        handleToggleChannel(item.category, 'push', checked)
                      }
                      disabled={!pushAllowed || saving}
                      label={t('notificationsPage.channels.push')}
                    />
                    {!pushAllowed && (
                      <span className="text-[10px] text-muted text-center max-w-[120px]">
                        {t('notificationsPage.preferences.companyDisabled')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
