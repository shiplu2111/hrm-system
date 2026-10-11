import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { AccountingProvider } from '@prisma/client';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AccountingConnectionService } from './accounting-connection.service';

/** Must match the admin route for the `accounting-connections` page. */
const CONNECTIONS_PAGE_PATH = '/operations/accounting/connections';

@ApiTags('integrations')
@ApiExcludeController(false)
@Controller('integrations')
export class AccountingOAuthController {
  constructor(
    private readonly connectionService: AccountingConnectionService,
  ) {}

  @Public()
  @Get('xero/callback')
  async xeroCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    // APP_URL is the API's own address, so it can't stand in for the admin app.
    const adminBase = (
      process.env.ADMIN_APP_URL ??
      (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5174')
    ).replace(/\/$/, '');

    const redirectWith = (params: Record<string, string>) => {
      const qs = new URLSearchParams(params).toString();
      res.redirect(302, `${adminBase}${CONNECTIONS_PAGE_PATH}?${qs}`);
    };

    if (error) {
      redirectWith({
        xero: 'error',
        message:
          error === 'access_denied'
            ? 'Access was not granted in Xero, so nothing was connected.'
            : `Xero returned an error: ${error}`,
      });
      return;
    }

    if (!code || !state) {
      redirectWith({
        xero: 'error',
        message: 'Missing authorization code or state',
      });
      return;
    }

    try {
      const result = await this.connectionService.completeOAuthCallback(
        AccountingProvider.xero,
        code,
        state,
      );
      redirectWith({
        xero: 'connected',
        org: result.orgName,
        companyId: result.companyId,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to connect Xero';
      redirectWith({ xero: 'error', message });
    }
  }
}
