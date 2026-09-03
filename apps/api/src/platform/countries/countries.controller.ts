import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import type {
  CountryConfiguration,
  CountryRuleRecord,
  CountrySummary,
  TaxBracketRecord,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePermission } from '../../rbac/require-permission.decorator';
import { CountriesService } from './countries.service';
import {
  CreateCountryDto,
  UpdateCountryDto,
  UpdateCountryRuleDto,
  UpsertCountryRuleDto,
  UpsertTaxBracketDto,
} from './dto/country-config.dto';

/** Super Admin country rule configuration — NAVIGATION.md §4, ARCHITECTURE.md §3 */
@ApiTags('platform-countries')
@ApiBearerAuth('access-token')
@SkipTenantScope()
@Controller('platform/countries')
export class CountriesController {
  constructor(private readonly countriesService: CountriesService) {}

  @Get()
  @RequirePermission('platform', 'view')
  @ApiOperation({ summary: 'List countries and configuration metadata' })
  async listCountries(): Promise<ApiEnvelope<CountrySummary[]>> {
    return { data: await this.countriesService.listCountries() };
  }

  @Post()
  @RequirePermission('platform', 'create')
  @ApiOperation({ summary: 'Add a supported country' })
  async createCountry(
    @Body() dto: CreateCountryDto,
  ): Promise<ApiEnvelope<CountrySummary>> {
    return { data: await this.countriesService.createCountry(dto) };
  }

  @Get(':countryId/configuration')
  @RequirePermission('platform', 'view')
  @ApiOperation({
    summary: 'Get effective-dated tax brackets and country rules for a country',
  })
  async getConfiguration(
    @Param('countryId', ParseUUIDPipe) countryId: string,
  ): Promise<ApiEnvelope<CountryConfiguration>> {
    return { data: await this.countriesService.getConfiguration(countryId) };
  }

  @Patch(':countryId')
  @RequirePermission('platform', 'edit')
  @ApiOperation({ summary: 'Update country metadata' })
  async updateCountry(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Body() dto: UpdateCountryDto,
  ): Promise<ApiEnvelope<CountrySummary>> {
    return { data: await this.countriesService.updateCountry(countryId, dto) };
  }

  @Post(':countryId/tax-brackets')
  @RequirePermission('platform', 'edit')
  @ApiOperation({ summary: 'Create a tax bracket version (effective-dated)' })
  async createTaxBracket(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Body() dto: UpsertTaxBracketDto,
  ): Promise<ApiEnvelope<TaxBracketRecord>> {
    return {
      data: await this.countriesService.createTaxBracket(countryId, dto),
    };
  }

  @Patch(':countryId/tax-brackets/:bracketId')
  @RequirePermission('platform', 'edit')
  @ApiOperation({ summary: 'Update a tax bracket version' })
  async updateTaxBracket(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Param('bracketId', ParseUUIDPipe) bracketId: string,
    @Body() dto: UpsertTaxBracketDto,
  ): Promise<ApiEnvelope<TaxBracketRecord>> {
    return {
      data: await this.countriesService.updateTaxBracket(
        countryId,
        bracketId,
        dto,
      ),
    };
  }

  @Post(':countryId/rules')
  @RequirePermission('platform', 'edit')
  @ApiOperation({
    summary: 'Create leave / OT / social security / public holiday rule version',
  })
  async createCountryRule(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Body() dto: UpsertCountryRuleDto,
  ): Promise<ApiEnvelope<CountryRuleRecord>> {
    return {
      data: await this.countriesService.createCountryRule(countryId, dto),
    };
  }

  @Patch(':countryId/rules/:ruleId')
  @RequirePermission('platform', 'edit')
  @ApiOperation({ summary: 'Update a country rule version' })
  async updateCountryRule(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateCountryRuleDto,
  ): Promise<ApiEnvelope<CountryRuleRecord>> {
    return {
      data: await this.countriesService.updateCountryRule(
        countryId,
        ruleId,
        dto,
      ),
    };
  }
}
