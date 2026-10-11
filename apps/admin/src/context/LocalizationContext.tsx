import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { i18n } from '@hrm/i18n';
import {
  DEFAULT_UI_LANGUAGE,
  formatDateKeyWithPattern,
  formatInstantWithPattern,
  formatNumberWithPattern,
  isUiLanguage,
  type MyLocalization,
  type UiLanguage,
} from '@hrm/shared-types';
import { getMyLocalization, updateMyLanguage } from '@/lib/localization-api';
import { useCompany } from '@/context/CompanyContext';
import { useTenant } from '@/context/TenantContext';

interface LocalizationContextValue {
  /** Effective settings for the signed-in user; null until loaded (or when the request failed). */
  settings: MyLocalization | null;
  language: UiLanguage;
  /** `null` clears the personal choice so the organization default applies again. */
  setLanguage: (language: UiLanguage | null) => Promise<void>;
  saveError: string | null;
  refresh: () => Promise<void>;
  formatDate: (value: string | Date | null | undefined) => string;
  formatNumber: (value: number, fractionDigits?: { min?: number; max?: number }) => string;
}

const LocalizationContext = createContext<LocalizationContextValue | undefined>(undefined);

const FALLBACK = { dateFormat: 'DD/MM/YYYY', numberFormat: '1,234.56' };

function currentLanguage(): UiLanguage {
  return isUiLanguage(i18n.language) ? i18n.language : DEFAULT_UI_LANGUAGE;
}

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const { tenantKey } = useTenant();
  const { companyId } = useCompany();
  const [settings, setSettings] = useState<MyLocalization | null>(null);
  const [language, setLanguageState] = useState<UiLanguage>(currentLanguage);
  const [saveError, setSaveError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const onChange = () => setLanguageState(currentLanguage());
    i18n.on('languageChanged', onChange);
    return () => i18n.off('languageChanged', onChange);
  }, []);

  const apply = useCallback(async (next: MyLocalization) => {
    setSettings(next);
    if (i18n.language !== next.language) await i18n.changeLanguage(next.language);
  }, []);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const next = await getMyLocalization(companyId);
      if (id === requestId.current) await apply(next);
    } catch {
      // Keep the language stored on this device when settings can't be loaded.
    }
  }, [apply, companyId]);

  useEffect(() => {
    void refresh();
  }, [refresh, tenantKey]);

  const setLanguage = useCallback(
    async (next: UiLanguage | null) => {
      setSaveError(null);
      const optimistic = next ?? settings?.organizationLanguage ?? DEFAULT_UI_LANGUAGE;
      await i18n.changeLanguage(optimistic);
      try {
        requestId.current += 1;
        await apply(await updateMyLanguage(next, companyId));
      } catch {
        setSaveError(i18n.t('shell.language.saveFailed'));
      }
    },
    [apply, companyId, settings?.organizationLanguage],
  );

  const value = useMemo<LocalizationContextValue>(() => {
    const dateFormat = settings?.dateFormat ?? FALLBACK.dateFormat;
    const numberFormat = settings?.numberFormat ?? FALLBACK.numberFormat;
    const timezone = settings?.timezone;
    return {
      settings,
      language,
      setLanguage,
      saveError,
      refresh,
      formatDate: (input) => {
        if (!input) return '—';
        if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
          return formatDateKeyWithPattern(input, dateFormat, language);
        }
        const instant = input instanceof Date ? input : new Date(input);
        if (Number.isNaN(instant.getTime())) return String(input);
        return formatInstantWithPattern(
          instant,
          dateFormat,
          timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          language,
        );
      },
      formatNumber: (input, fractionDigits) => formatNumberWithPattern(input, numberFormat, fractionDigits),
    };
  }, [settings, language, setLanguage, saveError, refresh]);

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization() {
  const ctx = useContext(LocalizationContext);
  if (!ctx) throw new Error('useLocalization must be used within LocalizationProvider');
  return ctx;
}
