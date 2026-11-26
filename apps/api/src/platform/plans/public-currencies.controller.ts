import { Controller, Get, Header, Headers, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  ApiResponse as ApiEnvelope,
  PublicCurrenciesMeta,
  PublicCurrencyView,
} from '@hrm/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PublicPlansService } from './public-plans.service';

function extractCountryFromAcceptLanguage(header?: string): string | null {
  if (!header) return null;
  const firstLocale = header.split(',')[0]?.split(';')[0]?.trim();
  if (!firstLocale) return null;
  const match = firstLocale.match(/[-_]([A-Za-z]{2})$/);
  return match ? match[1].toUpperCase() : null;
}

@ApiTags('public-currencies')
@SkipTenantScope()
@Public()
@Controller('public/currencies')
export class PublicCurrenciesController {
  constructor(private readonly publicPlansService: PublicPlansService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=30, s-maxage=30')
  @Header('Vary', 'CF-IPCountry, X-Vercel-IP-Country, X-Country-Code')
  @ApiOperation({
    summary: 'List supported public billing currencies and resolve default currency by country',
    description:
      'Returns currencies active on public plans along with active country mappings and resolves a default currency from the country query parameter or geo headers.',
  })
  @ApiQuery({
    name: 'country',
    required: false,
    description: 'ISO country code or slug (e.g. AU, BD, australia) used to pick the default currency.',
  })
  @ApiResponse({ status: 200, description: 'Public currencies retrieved successfully' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async listPublicCurrencies(
    @Query('country') countryQuery?: string,
    @Headers() headers: Record<string, string | string[] | undefined> = {},
  ): Promise<ApiEnvelope<PublicCurrencyView[], PublicCurrenciesMeta>> {
    const headerValue = (key: string): string | undefined => {
      const val = headers[key];
      return Array.isArray(val) ? val[0] : val;
    };

    const countryHint =
      countryQuery ||
      headerValue('x-country-code') ||
      headerValue('cf-ipcountry') ||
      headerValue('x-vercel-ip-country') ||
      extractCountryFromAcceptLanguage(headerValue('accept-language'));

    const { currencies, meta } = await this.publicPlansService.listPublicCurrencies(countryHint);
    return {
      data: currencies,
      meta,
    };
  }
}
