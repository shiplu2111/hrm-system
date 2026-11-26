import { Controller, Get, Header, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { ApiResponse as ApiEnvelope, PublicCountryView } from '@hrm/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { CountriesService } from './countries.service';

@ApiTags('public-countries')
@SkipTenantScope()
@Public()
@Controller('public/countries')
export class PublicCountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=10, s-maxage=10, stale-while-revalidate=30')
  @ApiOperation({
    summary: 'List active supported countries for the public marketing website',
    description:
      'Returns only countries with status = active. Never exposes specific tax rates, rule values, internal notes, or tenant counts.',
  })
  @ApiResponse({ status: 200, description: 'Active public countries retrieved successfully' })
  async listActiveCountries(): Promise<ApiEnvelope<PublicCountryView[]>> {
    const data = await this.countriesService.listPublicCountries();
    return { data };
  }

  @Get(':slug')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=10, s-maxage=10, stale-while-revalidate=30')
  @ApiOperation({
    summary: 'Get a single active country by slug or ISO code for the public website',
    description: 'Returns 404 if the country does not exist or is not active.',
  })
  @ApiResponse({ status: 200, description: 'Active country retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Active country not found' })
  async getActiveCountry(@Param('slug') slug: string): Promise<ApiEnvelope<PublicCountryView>> {
    const data = await this.countriesService.getPublicCountryBySlug(slug);
    return { data };
  }
}
