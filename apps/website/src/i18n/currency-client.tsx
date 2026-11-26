'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PublicCurrencyView } from '../api/types';
import {
  CURRENCY_STORAGE_KEY,
  detectBrowserCountryCode,
  resolveVisitorCurrency,
} from './currency';

interface CurrencyContextValue {
  currency: string;
  currencies: readonly PublicCurrencyView[];
  setCurrency: (code: string) => void;
}

const DEFAULT_FALLBACK_CURRENCIES: PublicCurrencyView[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar', decimalPlaces: 2, isDefault: true, countries: [] },
];

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: 'USD',
  currencies: DEFAULT_FALLBACK_CURRENCIES,
  setCurrency: () => {},
});

interface CurrencyProviderProps {
  initialCurrencies: readonly PublicCurrencyView[];
  defaultCurrency: string;
  children: ReactNode;
}

export function CurrencyProvider({
  initialCurrencies,
  defaultCurrency,
  children,
}: CurrencyProviderProps) {
  const currencies =
    initialCurrencies.length > 0 ? initialCurrencies : DEFAULT_FALLBACK_CURRENCIES;

  const [currency, setCurrencyState] = useState<string>(defaultCurrency || 'USD');

  useEffect(() => {
    let savedManual: string | null = null;
    try {
      const searchCurrency = new URLSearchParams(window.location.search).get('currency');
      savedManual = searchCurrency || window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    } catch {
      savedManual = null;
    }

    const browserCountry = detectBrowserCountryCode();
    const resolved = resolveVisitorCurrency({
      manualCurrency: savedManual,
      countryHint: browserCountry,
      currencies,
      fallbackDefault: defaultCurrency || 'USD',
    });
    setCurrencyState(resolved);
  }, [currencies, defaultCurrency]);

  const setCurrency = useCallback(
    (code: string) => {
      const normalized = code.trim().toUpperCase();
      const valid = currencies.some((c) => c.code === normalized);
      const nextCode = valid ? normalized : defaultCurrency || 'USD';
      setCurrencyState(nextCode);

      try {
        window.localStorage.setItem(CURRENCY_STORAGE_KEY, nextCode);
        document.cookie = `${CURRENCY_STORAGE_KEY}=${nextCode}; path=/; max-age=31536000; SameSite=Lax`;
      } catch {
        // Ignore storage write errors in restricted browsing contexts
      }
    },
    [currencies, defaultCurrency],
  );

  const value = useMemo(
    () => ({
      currency,
      currencies,
      setCurrency,
    }),
    [currency, currencies, setCurrency],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}
