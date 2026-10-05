import { Languages } from 'lucide-react';
import { useAppTranslation, useLanguageSwitcher } from '@hrm/i18n';

export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { t } = useAppTranslation();
  const { language, setLanguage, languages } = useLanguageSwitcher();

  return (
    <label className={`inline-flex items-center gap-1.5 text-xs text-muted ${className}`}>
      <Languages className="h-3.5 w-3.5" aria-hidden />
      <select
        value={language}
        onChange={(e) => void setLanguage(e.target.value as typeof language)}
        className="rounded-lg border border-base surface px-2 py-1 text-xs text-primary focus:outline-none focus:border-accent-500"
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
