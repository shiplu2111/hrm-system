import { useAppTranslation, useLanguageSwitcher } from '@hrm/i18n';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { t } = useAppTranslation();
  const { language, setLanguage, languages } = useLanguageSwitcher();

  return (
    <label className={`flex flex-col gap-1 text-xs ${className}`}>
      <span className="text-muted">{t('common.language')}</span>
      <select
        value={language}
        onChange={(e) => void setLanguage(e.target.value as typeof language)}
        className="rounded-lg border border-base bg-[rgb(var(--bg-base))] px-2 py-1.5 text-sm text-primary"
        aria-label={t('common.language')}
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {t(item.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
