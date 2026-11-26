'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  createTranslator,
  DEFAULT_LOCALE,
  getDictionary,
  type DictionaryKey,
  type TranslationParams,
  type WebsiteDictionary,
  type WebsiteLocale,
} from './index';

interface WebsiteI18nContextValue {
  locale: WebsiteLocale;
  dictionary: WebsiteDictionary;
  t: (key: DictionaryKey<WebsiteDictionary>, params?: TranslationParams) => string;
}

const defaultDictionary = getDictionary(DEFAULT_LOCALE);

const WebsiteI18nContext = createContext<WebsiteI18nContextValue>({
  locale: DEFAULT_LOCALE,
  dictionary: defaultDictionary,
  t: createTranslator(defaultDictionary),
});

interface WebsiteI18nProviderProps {
  locale?: WebsiteLocale;
  dictionary?: WebsiteDictionary;
  children: ReactNode;
}

export function WebsiteI18nProvider({
  locale = DEFAULT_LOCALE,
  dictionary = defaultDictionary,
  children,
}: WebsiteI18nProviderProps) {
  const value = useMemo<WebsiteI18nContextValue>(
    () => ({
      locale,
      dictionary,
      t: createTranslator(dictionary),
    }),
    [locale, dictionary],
  );

  return <WebsiteI18nContext.Provider value={value}>{children}</WebsiteI18nContext.Provider>;
}

export function useWebsiteI18n(): WebsiteI18nContextValue {
  return useContext(WebsiteI18nContext);
}
