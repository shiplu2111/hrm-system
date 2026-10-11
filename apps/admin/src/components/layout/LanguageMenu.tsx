import { Check, Languages } from 'lucide-react';
import { useAppTranslation } from '@hrm/i18n';
import { UI_LANGUAGES } from '@hrm/shared-types';
import { Dropdown, DropdownDivider, DropdownHeader, DropdownItem } from '@/components/ui/Dropdown';
import { useLocalization } from '@/context/LocalizationContext';

const SHORT_LABEL: Record<string, string> = { en: 'EN', bn: 'বাং' };

export function LanguageMenu() {
  const { t } = useAppTranslation();
  const { settings, language, setLanguage, saveError } = useLocalization();
  const followsOrganization = settings ? settings.preferredLanguage === null : false;
  const organizationLanguage = UI_LANGUAGES.find((l) => l.code === settings?.organizationLanguage);
  const source = settings?.sources.language;

  return (
    <Dropdown
      width="w-72"
      trigger={
        <button
          type="button"
          className="flex items-center gap-1.5 h-9 px-2 rounded-lg text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))] transition-colors"
          title={t('shell.language.title')}
          aria-label={t('shell.language.title')}
        >
          <Languages className="h-[18px] w-[18px]" />
          <span className="text-xs font-semibold">{SHORT_LABEL[language] ?? language.toUpperCase()}</span>
        </button>
      }
    >
      <DropdownHeader>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
          {t('shell.language.title')}
        </div>
      </DropdownHeader>
      {UI_LANGUAGES.map((item) => {
        const selected = settings ? settings.preferredLanguage === item.code : language === item.code;
        return (
          <DropdownItem
            key={item.code}
            active={selected}
            onClick={() => void setLanguage(item.code)}
            icon={<Check className={`h-4 w-4 ${selected ? '' : 'invisible'}`} />}
          >
            <span lang={item.code}>{item.nativeName}</span>
            {item.nativeName !== item.name ? <span className="ml-1.5 text-xs text-muted">{item.name}</span> : null}
          </DropdownItem>
        );
      })}
      {settings && organizationLanguage ? (
        <>
          <DropdownDivider />
          <DropdownItem
            active={followsOrganization}
            onClick={() => void setLanguage(null)}
            icon={<Check className={`h-4 w-4 ${followsOrganization ? '' : 'invisible'}`} />}
            description={t('shell.language.followOrganizationHint', {
              language: organizationLanguage.nativeName,
              source: t(`shell.language.sources.${source ?? 'country'}`),
            })}
          >
            {t('shell.language.followOrganization')}
          </DropdownItem>
        </>
      ) : null}
      {settings ? (
        <>
          <DropdownDivider />
          <div className="px-3 py-1.5 space-y-0.5 text-[11px] text-muted">
            <div>{t('shell.language.formats', { date: settings.dateFormat, number: settings.numberFormat })}</div>
            <div>{t('shell.language.timezone', { timezone: settings.timezone })}</div>
            {language !== 'en' ? <div>{t('shell.language.partial')}</div> : null}
          </div>
        </>
      ) : null}
      {saveError ? <div className="px-3 py-1.5 text-[11px] text-error-600">{saveError}</div> : null}
    </Dropdown>
  );
}
