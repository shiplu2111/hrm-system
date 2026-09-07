import { BadRequestException, Injectable } from '@nestjs/common';
import type { AccountingProvider } from '@prisma/client';
import type { AccountingGlProvider } from './accounting-gl-provider.interface';
import { XeroGlProvider } from './xero-gl.provider';

@Injectable()
export class AccountingGlProviderFactory {
  constructor(private readonly xeroProvider: XeroGlProvider) {}

  resolve(provider: AccountingProvider): AccountingGlProvider {
    switch (provider) {
      case 'xero':
        return this.xeroProvider;
      case 'quickbooks':
      case 'tally':
        throw new BadRequestException({
          code: 'PROVIDER_NOT_IMPLEMENTED',
          message: `${provider} integration is not available yet`,
        });
      default:
        throw new BadRequestException({
          code: 'UNKNOWN_PROVIDER',
          message: 'Unknown accounting provider',
        });
    }
  }
}
