import { BadRequestException } from '@nestjs/common';
import { AccountingConnectionStatus } from '@prisma/client';
import {
  connectionStatusAfterSyncError,
  errorCode,
  syncBlockedMessage,
} from './accounting-connection.rules';

describe('accounting connection rules', () => {
  describe('errorCode', () => {
    it('reads the code from a Nest exception body', () => {
      expect(
        errorCode(new BadRequestException({ code: 'XERO_FORBIDDEN', message: 'no' })),
      ).toBe('XERO_FORBIDDEN');
    });

    it('returns null for plain errors and string bodies', () => {
      expect(errorCode(new Error('boom'))).toBeNull();
      expect(errorCode(new BadRequestException('just text'))).toBeNull();
      expect(errorCode(undefined)).toBeNull();
    });
  });

  describe('connectionStatusAfterSyncError', () => {
    it.each(['ACCOUNTING_TOKEN_EXPIRED', 'XERO_INVALID_GRANT', 'XERO_UNAUTHORIZED'])(
      '%s means the tenant must reconnect',
      (code) => {
        expect(connectionStatusAfterSyncError(code)).toBe(
          AccountingConnectionStatus.token_expired,
        );
      },
    );

    it('lost organisation access is a connection error', () => {
      expect(connectionStatusAfterSyncError('XERO_FORBIDDEN')).toBe(
        AccountingConnectionStatus.error,
      );
    });

    it.each(['XERO_API_ERROR', 'XERO_OAUTH_ERROR', 'VALIDATION_ERROR', null])(
      '%s leaves the connection as it is',
      (code) => {
        expect(connectionStatusAfterSyncError(code)).toBeNull();
      },
    );
  });

  describe('syncBlockedMessage', () => {
    it('asks for a reconnect when the sign-in expired or access was refused', () => {
      expect(syncBlockedMessage(AccountingConnectionStatus.token_expired)).toMatch(
        /Reconnect Xero/,
      );
      expect(syncBlockedMessage(AccountingConnectionStatus.error)).toMatch(/Reconnect Xero/);
    });

    it('points to CSV export when Xero is not connected at all', () => {
      expect(syncBlockedMessage(null)).toMatch(/CSV/);
      expect(syncBlockedMessage(AccountingConnectionStatus.disconnected)).toMatch(/CSV/);
    });
  });
});
