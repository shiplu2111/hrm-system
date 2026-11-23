/**
 * Platform Language Packs & Translation Management Types
 * MODULES.md §46 & Platform Management
 */

export type PlatformLanguageDirection = 'ltr' | 'rtl';

export interface PlatformLanguagePackSummary {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  direction: PlatformLanguageDirection;
  isAvailableToTenants: boolean;
  isDefault: boolean;
  totalKeys: number;
  translatedKeys: number;
  missingKeysCount: number;
  completenessPercent: number;
  version: string;
  notes?: string | null;
  lastImportedAt?: string | null;
  lastExportedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformLanguagePackDetail extends PlatformLanguagePackSummary {
  translations: Record<string, any>;
}

export interface MissingKeyItem {
  key: string;
  namespace: string;
  baseValue: string;
  status: 'missing' | 'empty';
}

export interface NamespaceCompletenessSummary {
  namespace: string;
  totalKeys: number;
  translatedKeys: number;
  missingKeys: number;
  completenessPercent: number;
}

export interface MissingKeysReport {
  languageCode: string;
  languageName: string;
  baseLanguageCode: string;
  totalBaseKeys: number;
  translatedKeys: number;
  missingKeysCount: number;
  completenessPercent: number;
  namespaces: NamespaceCompletenessSummary[];
  missingKeys: MissingKeyItem[];
}

export interface CreateLanguagePackInput {
  code: string;
  name: string;
  nativeName: string;
  direction?: PlatformLanguageDirection;
  isAvailableToTenants?: boolean;
  notes?: string;
  translations?: Record<string, any>;
}

export interface UpdateLanguagePackInput {
  name?: string;
  nativeName?: string;
  direction?: PlatformLanguageDirection;
  isAvailableToTenants?: boolean;
  notes?: string;
  version?: string;
}

export interface SetLanguageAvailabilityInput {
  isAvailableToTenants: boolean;
  reason?: string;
}

export interface ImportTranslationsInput {
  translations: Record<string, any>;
  mode?: 'merge' | 'replace';
  markAvailableIfComplete?: boolean;
  notes?: string;
}

export interface ImportTranslationsResult {
  code: string;
  totalKeys: number;
  translatedKeys: number;
  missingKeysCount: number;
  completenessPercent: number;
  importedKeysCount: number;
  isAvailableToTenants: boolean;
  version: string;
}

export interface AvailableTenantLanguage {
  code: string;
  name: string;
  nativeName: string;
  direction: PlatformLanguageDirection;
  isDefault: boolean;
}
