import en from './locales/en.json';
import bn from './locales/bn.json';

export const EMPLOYEE_NAMESPACE = 'employee' as const;

export const resources = {
  en: { [EMPLOYEE_NAMESPACE]: en },
  bn: { [EMPLOYEE_NAMESPACE]: bn },
} as const;

export type AppLanguage = keyof typeof resources;

export const DEFAULT_LANGUAGE: AppLanguage = 'en';

export const SUPPORTED_LANGUAGES: ReadonlyArray<{
  code: AppLanguage;
  labelKey: 'common.english' | 'common.bengali';
}> = [
  { code: 'en', labelKey: 'common.english' },
  { code: 'bn', labelKey: 'common.bengali' },
];

export const LANGUAGE_STORAGE_KEY = 'hrm_ui_language';
