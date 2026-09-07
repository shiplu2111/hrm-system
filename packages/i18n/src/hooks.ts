import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EMPLOYEE_NAMESPACE,
  SUPPORTED_LANGUAGES,
  type AppLanguage,
} from './resources';
import { i18n, isAppLanguage } from './init';

export function useAppTranslation() {
  return useTranslation(EMPLOYEE_NAMESPACE);
}

export function useLanguageSwitcher(onPersist?: (language: AppLanguage) => void) {
  const { i18n: instance } = useAppTranslation();

  const language = isAppLanguage(instance.language)
    ? instance.language
    : ('en' as AppLanguage);

  const setLanguage = useCallback(
    async (next: AppLanguage) => {
      await instance.changeLanguage(next);
      onPersist?.(next);
    },
    [instance, onPersist],
  );

  return { language, setLanguage, languages: SUPPORTED_LANGUAGES };
}

export { i18n, isAppLanguage, SUPPORTED_LANGUAGES };
export type { AppLanguage };
