export type PublicSubprocessorCategory =
  | 'hosting'
  | 'email'
  | 'sms'
  | 'push'
  | 'payment'
  | 'error_tracking';

export interface PublicSubprocessorItem {
  id: string;
  name: string;
  category: PublicSubprocessorCategory;
  categoryLabel: string;
  purpose: string;
  dataProcessed: string;
  region: string;
  configuredSource: 'platform_settings' | 'environment';
  updatedAt: string | null;
}

export interface PublicSubprocessorCategoryNote {
  category: PublicSubprocessorCategory;
  categoryLabel: string;
  note: string;
}

export interface PublicSubprocessorsResponse {
  lastUpdated: string;
  totalActive: number;
  categoriesChecked: PublicSubprocessorCategory[];
  subprocessors: PublicSubprocessorItem[];
  unconfiguredCategories: PublicSubprocessorCategoryNote[];
}

export interface PublicDpaMetadataResponse {
  title: string;
  version: string;
  effectiveDate: string;
  storageKey: string;
  filename: string;
  downloadUrl: string;
  byteSize: number;
  lastGeneratedAt: string;
}
