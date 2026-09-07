import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { PayrollJournalPreview } from '@hrm/shared-types';
import type {
  AccountingGlProvider,
  AccountingOAuthTokens,
  AccountingOrgConnection,
  PushJournalResult,
} from './accounting-gl-provider.interface';

const XERO_AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token';
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections';
const XERO_MANUAL_JOURNALS_URL =
  'https://api.xero.com/api.xro/2.0/ManualJournals';

const DEFAULT_SCOPES =
  'openid profile email accounting.transactions accounting.settings offline_access';

interface XeroTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}

interface XeroConnectionRow {
  id: string;
  tenantId: string;
  tenantName: string;
}

interface XeroManualJournalResponse {
  ManualJournals?: Array<{ ManualJournalID?: string; Narration?: string }>;
}

@Injectable()
export class XeroGlProvider implements AccountingGlProvider {
  readonly kind = 'xero' as const;
  private readonly logger = new Logger(XeroGlProvider.name);

  isConfigured(): boolean {
    return Boolean(
      process.env.XERO_CLIENT_ID &&
        process.env.XERO_CLIENT_SECRET &&
        process.env.XERO_REDIRECT_URI,
    );
  }

  buildAuthorizeUrl(state: string): string {
    this.assertConfigured();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.XERO_CLIENT_ID!,
      redirect_uri: process.env.XERO_REDIRECT_URI!,
      scope: DEFAULT_SCOPES,
      state,
    });
    return `${XERO_AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeAuthorizationCode(code: string): Promise<AccountingOAuthTokens> {
    this.assertConfigured();
    return this.requestTokens({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.XERO_REDIRECT_URI!,
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<AccountingOAuthTokens> {
    this.assertConfigured();
    return this.requestTokens({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  async listOrganizations(accessToken: string): Promise<AccountingOrgConnection[]> {
    const response = await fetch(XERO_CONNECTIONS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new BadRequestException({
        code: 'XERO_API_ERROR',
        message: `Failed to list Xero organizations (${response.status}): ${body}`,
      });
    }
    const rows = (await response.json()) as XeroConnectionRow[];
    return rows.map((row) => ({
      externalTenantId: row.tenantId,
      orgName: row.tenantName,
    }));
  }

  async pushManualJournal(input: {
    accessToken: string;
    externalTenantId: string;
    journal: PayrollJournalPreview;
    referenceNumber: string;
  }): Promise<PushJournalResult> {
    const journalLines = input.journal.lines.map((line) => {
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      const lineAmount =
        debit > 0 ? debit : credit > 0 ? -credit : 0;
      return {
        Description: line.description,
        AccountCode: line.glAccountCode,
        LineAmount: lineAmount,
        TaxType: 'NONE',
      };
    });

    const payload = {
      ManualJournals: [
        {
          Narration: `Payroll journal ${input.journal.periodLabel} (${input.referenceNumber})`,
          Date: input.journal.postingDate,
          Status: 'POSTED',
          JournalLines: journalLines,
        },
      ],
    };

    const response = await fetch(XERO_MANUAL_JOURNALS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        'xero-tenant-id': input.externalTenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.warn(`Xero manual journal push failed: ${response.status} ${body}`);
      throw new BadRequestException({
        code: 'XERO_API_ERROR',
        message: `Xero rejected the journal entry (${response.status})`,
      });
    }

    const result = (await response.json()) as XeroManualJournalResponse;
    const journalId = result.ManualJournals?.[0]?.ManualJournalID;
    if (!journalId) {
      throw new BadRequestException({
        code: 'XERO_API_ERROR',
        message: 'Xero did not return a manual journal ID',
      });
    }

    return {
      externalJournalId: journalId,
      externalReference: result.ManualJournals?.[0]?.Narration,
    };
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new BadRequestException({
        code: 'XERO_NOT_CONFIGURED',
        message:
          'Xero OAuth is not configured — set XERO_CLIENT_ID, XERO_CLIENT_SECRET, and XERO_REDIRECT_URI',
      });
    }
  }

  private async requestTokens(
    body: Record<string, string>,
  ): Promise<AccountingOAuthTokens> {
    this.assertConfigured();
    const credentials = Buffer.from(
      `${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`,
    ).toString('base64');

    const response = await fetch(XERO_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`Xero token exchange failed: ${response.status} ${text}`);
      throw new BadRequestException({
        code: 'XERO_OAUTH_ERROR',
        message: 'Failed to exchange Xero authorization code',
      });
    }

    const json = (await response.json()) as XeroTokenResponse;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: new Date(Date.now() + json.expires_in * 1000),
      scopes: json.scope ?? DEFAULT_SCOPES,
    };
  }
}

/** Pure helper for unit tests. */
export function payrollJournalToXeroLineAmounts(
  journal: PayrollJournalPreview,
): number[] {
  return journal.lines.map((line) => {
    const debit = Number(line.debit);
    const credit = Number(line.credit);
    return debit > 0 ? debit : credit > 0 ? -credit : 0;
  });
}
