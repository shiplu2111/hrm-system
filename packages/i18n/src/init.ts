import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  EMPLOYEE_NAMESPACE,
  LANGUAGE_STORAGE_KEY,
  resources,
  type AppLanguage,
} from './resources';

function resolveLanguage(stored: string | null | undefined): AppLanguage {
  return stored === 'bn' ? 'bn' : DEFAULT_LANGUAGE;
}

export function isAppLanguage(value: string): value is AppLanguage {
  return value === 'en' || value === 'bn';
}

export async function initI18n(options?: {
  language?: AppLanguage;
  persist?: (language: AppLanguage) => void | Promise<void>;
  readStored?: () => string | null | Promise<string | null>;
}): Promise<typeof i18n> {
  if (i18n.isInitialized) {
    if (options?.language && i18n.language !== options.language) {
      await i18n.changeLanguage(options.language);
    }
    return i18n;
  }

  const stored = options?.readStored
    ? await options.readStored()
    : typeof localStorage !== 'undefined'
      ? localStorage.getItem(LANGUAGE_STORAGE_KEY)
      : null;

  const initialLanguage = options?.language ?? resolveLanguage(stored);

  await i18n.use(initReactI18next).init({
    resources,
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: EMPLOYEE_NAMESPACE,
    ns: [EMPLOYEE_NAMESPACE],
    interpolation: { escapeValue: false },
  });

  i18n.on('languageChanged', (lng) => {
    if (!isAppLanguage(lng)) return;
    if (options?.persist) {
      void options.persist(lng);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
    }
  });

  return i18n;
}

export { i18n };
