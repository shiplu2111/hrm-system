import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import { AccountingProvider } from '@prisma/client';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AccountingConnectionService } from './accounting-connection.service';

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
    const adminBase =
      process.env.ADMIN_APP_URL?.replace(/\/$/, '') ??
      process.env.APP_URL?.replace(/\/$/, '') ??
      '';

    const redirectWith = (params: Record<string, string>) => {
      const qs = new URLSearchParams({ ...params, tab: 'connections' }).toString();
      const target = adminBase ? `${adminBase}?${qs}` : `/?${qs}`;
      res.redirect(302, target);
    };

    if (error) {
      redirectWith({ xero: 'error', message: error });
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
