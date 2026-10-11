import { HttpException } from '@nestjs/common';
import { AccountingConnectionStatus } from '@prisma/client';

export function errorCode(error: unknown): string | null {
  if (!(error instanceof HttpException)) return null;
  const response = error.getResponse();
  if (typeof response === 'object' && response !== null && 'code' in response) {
    const code = (response as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}

/**
 * Only authorisation failures change the connection status. Everything else
 * (unmapped accounts, unbalanced journal, Xero validation errors, network
 * blips) is a sync-job failure and leaves the connection usable.
 */
export function connectionStatusAfterSyncError(
  code: string | null,
): AccountingConnectionStatus | null {
  switch (code) {
    case 'ACCOUNTING_TOKEN_EXPIRED':
    case 'XERO_INVALID_GRANT':
    case 'XERO_UNAUTHORIZED':
      return AccountingConnectionStatus.token_expired;
    case 'XERO_FORBIDDEN':
      return AccountingConnectionStatus.error;
    default:
      return null;
  }
}

export function syncBlockedMessage(status: AccountingConnectionStatus | null): string {
  switch (status) {
    case AccountingConnectionStatus.token_expired:
      return 'Xero needs to be reconnected — the saved sign-in is no longer valid. Reconnect Xero, then retry this sync.';
    case AccountingConnectionStatus.error:
      return 'Xero refused access to the connected organisation. Reconnect Xero, then retry this sync.';
    default:
      return 'Xero is not connected. Connect Xero and retry this sync, or export the journal as CSV.';
  }
}
