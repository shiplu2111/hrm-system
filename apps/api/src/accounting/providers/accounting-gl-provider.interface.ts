import type { PayrollJournalPreview } from '@hrm/shared-types';

export type AccountingGlProviderKind = 'xero' | 'quickbooks' | 'tally';

export interface AccountingOAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string;
}

export interface AccountingOrgConnection {
  externalTenantId: string;
  orgName: string;
}

export interface PushJournalResult {
  externalJournalId: string;
  externalReference?: string;
}

/** Category-specific GL provider contract (THIRD_PARTY_INTEGRATIONS.md §2). */
export interface AccountingGlProvider {
  readonly kind: AccountingGlProviderKind;

  buildAuthorizeUrl(state: string): string;

  exchangeAuthorizationCode(code: string): Promise<AccountingOAuthTokens>;

  refreshAccessToken(refreshToken: string): Promise<AccountingOAuthTokens>;

  listOrganizations(accessToken: string): Promise<AccountingOrgConnection[]>;

  pushManualJournal(input: {
    accessToken: string;
    externalTenantId: string;
    journal: PayrollJournalPreview;
    referenceNumber: string;
  }): Promise<PushJournalResult>;
}
