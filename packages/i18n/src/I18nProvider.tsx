import { type ReactNode, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import type { i18n as I18nInstance } from 'i18next';
import { initI18n } from './init';
import type { AppLanguage } from './resources';

interface I18nProviderProps {
  children: ReactNode;
  language?: AppLanguage;
  readStored?: () => string | null | Promise<string | null>;
  persist?: (language: AppLanguage) => void | Promise<void>;
}

export function I18nProvider({
  children,
  language,
  readStored,
  persist,
}: I18nProviderProps) {
  const [instance, setInstance] = useState<I18nInstance | null>(
    () => (globalThis as { __HRM_I18N__?: I18nInstance }).__HRM_I18N__ ?? null,
  );

  useEffect(() => {
    let cancelled = false;
    void initI18n({ language, readStored, persist }).then((ready) => {
      if (cancelled) return;
      (globalThis as { __HRM_I18N__?: I18nInstance }).__HRM_I18N__ = ready;
      setInstance(ready);
    });
    return () => {
      cancelled = true;
    };
  }, [language, readStored, persist]);

  if (!instance) {
    return null;
  }

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
