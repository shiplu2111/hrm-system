'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Globe2 } from 'lucide-react';
import type { PublicCountry } from '../../api/types';
import { useWebsiteI18n } from '../../i18n/client';
import { localizePath } from '../../i18n';
import { Button } from '../marketing';

interface CountrySelectorProps {
  countries: PublicCountry[];
  initialSlug?: string;
}

export function CountrySelector({ countries, initialSlug = '' }: CountrySelectorProps) {
  const router = useRouter();
  const { locale, t } = useWebsiteI18n();
  const [selectedSlug, setSelectedSlug] = useState<string>(
    initialSlug || countries[0]?.slug || '',
  );

  if (countries.length === 0) {
    return null;
  }

  const handleNavigate = () => {
    if (!selectedSlug) return;
    router.push(localizePath(`/solutions/countries/${selectedSlug}`, locale));
  };

  return (
    <div className="surface rounded-xl p-5 sm:p-6 max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
        <div className="flex-1 text-left">
          <label
            htmlFor="country-selector-dropdown"
            className="block text-xs font-semibold uppercase tracking-wider text-primary-600 mb-2"
          >
            <span className="inline-flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('countries.index.selectorLabel')}</span>
            </span>
          </label>
          <select
            id="country-selector-dropdown"
            value={selectedSlug}
            onChange={(e) => {
              const nextSlug = e.target.value;
              setSelectedSlug(nextSlug);
              if (nextSlug) {
                router.push(localizePath(`/solutions/countries/${nextSlug}`, locale));
              }
            }}
            className="w-full min-h-[44px] rounded-md border border-[rgb(var(--border-strong))] bg-[rgb(var(--bg-surface))] px-3.5 py-2 text-sm font-medium text-[rgb(var(--text-primary))] shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            <option value="" disabled>
              {t('countries.index.selectorPlaceholder')}
            </option>
            {countries.map((country) => (
              <option key={country.id} value={country.slug}>
                {country.name} ({country.currency} · {country.isoCode})
              </option>
            ))}
          </select>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={handleNavigate}
          disabled={!selectedSlug}
          trailingIcon={<ArrowRight className="w-4 h-4" aria-hidden="true" />}
        >
          {t('countries.index.selectorGoCta')}
        </Button>
      </div>
    </div>
  );
}
