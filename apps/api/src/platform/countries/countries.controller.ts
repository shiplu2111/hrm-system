import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import type {
  BulkImportStatesResult,
  CountryConfigStatusView,
  CountryConfiguration,
  CountryRuleRecord,
  CountrySummary,
  InheritingTenantsResponse,
  RuleVersionDiffResult,
  RuleVersionView,
  StateProvinceView,
  TaxBracketRecord,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { CountriesService } from './countries.service';
import { RuleVersionsService } from './rule-versions.service';
import {
  BulkImportStatesDto,
  CreateCountryDto,
  CreateStateProvinceDto,
  UpdateCountryDto,
  UpdateCountryRuleDto,
  UpdateStateProvinceDto,
  UpsertCountryRuleDto,
  UpsertTaxBracketDto,
} from './dto/country-config.dto';
import {
  CreateRuleVersionDto,
  QueryRuleVersionsDto,
  UpdateRuleVersionDto,
} from './dto/rule-version.dto';

/** Super Admin country rule configuration — NAVIGATION.md §4, ARCHITECTURE.md §3 */
@ApiTags('platform-countries')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/countries')
export class CountriesController {
  constructor(
    private readonly countriesService: CountriesService,
    private readonly ruleVersionsService: RuleVersionsService,
  ) {}

  @Get()
  @RequirePlatformPermission('country', 'view')
  @ApiOperation({ summary: 'List countries and configuration metadata' })
  async listCountries(): Promise<ApiEnvelope<CountrySummary[]>> {
    return { data: await this.countriesService.listCountries() };
  }

  @Post()
  @RequirePlatformPermission('country', 'create')
  @ApiOperation({ summary: 'Add a supported country' })
  async createCountry(
    @Body() dto: CreateCountryDto,
  ): Promise<ApiEnvelope<CountrySummary>> {
    return { data: await this.countriesService.createCountry(dto) };
  }

  @Get(':countryId/config-status')
  @RequirePlatformPermission('country', 'view')
  @ApiOperation({
    summary: 'Check readiness and completion of country rule categories',
  })
  async getCountryConfigStatus(
    @Param('countryId', ParseUUIDPipe) countryId: string,
  ): Promise<ApiEnvelope<CountryConfigStatusView>> {
    return {
      data: await this.countriesService.getCountryConfigStatus(countryId),
    };
  }

  @Get(':countryId/configuration')
  @RequirePlatformPermission('country', 'view')
  @ApiOperation({
    summary: 'Get effective-dated tax brackets and country rules for a country',
  })
  async getConfiguration(
    @Param('countryId', ParseUUIDPipe) countryId: string,
  ): Promise<ApiEnvelope<CountryConfiguration>> {
    return { data: await this.countriesService.getConfiguration(countryId) };
  }

  @Get(':countryId/inheriting-tenants')
  @RequirePlatformPermission('country', 'view')
  @ApiOperation({
    summary: 'List tenants and companies inheriting public holidays from this country and state',
  })
  async getInheritingTenants(
    @Param('countryId', ParseUUIDPipe) countryId: string,
  ): Promise<ApiEnvelope<InheritingTenantsResponse>> {
    return { data: await this.countriesService.getInheritingTenants(countryId) };
  }

  @Patch(':countryId')
  @RequirePlatformPermission('country', 'edit')
  @ApiOperation({ summary: 'Update country metadata' })
  async updateCountry(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Body() dto: UpdateCountryDto,
  ): Promise<ApiEnvelope<CountrySummary>> {
    return { data: await this.countriesService.updateCountry(countryId, dto) };
  }

  // --- States / Provinces ---

  @Get(':countryId/states')
  @RequirePlatformPermission('country', 'view')
  @ApiOperation({ summary: 'List states and provinces for a country' })
  async listStates(
    @Param('countryId', ParseUUIDPipe) countryId: string,
  ): Promise<ApiEnvelope<StateProvinceView[]>> {
    return { data: await this.countriesService.listStates(countryId) };
  }

  @Post(':countryId/states')
  @RequirePlatformPermission('country', 'edit')
  @ApiOperation({ summary: 'Add a state/province to a country' })
  async createState(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Body() dto: CreateStateProvinceDto,
  ): Promise<ApiEnvelope<StateProvinceView>> {
    return { data: await this.countriesService.createState(countryId, dto) };
  }

  @Patch(':countryId/states/:stateId')
  @RequirePlatformPermission('country', 'edit')
  @ApiOperation({ summary: 'Update or retire a state/province' })
  async updateState(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Param('stateId', ParseUUIDPipe) stateId: string,
    @Body() dto: UpdateStateProvinceDto,
  ): Promise<ApiEnvelope<StateProvinceView>> {
    return {
      data: await this.countriesService.updateState(countryId, stateId, dto),
    };
  }

  @Post(':countryId/states/bulk-import')
  @RequirePlatformPermission('country', 'edit')
  @ApiOperation({ summary: 'Bulk import states/provinces from CSV data' })
  async bulkImportStates(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Body() dto: BulkImportStatesDto,
  ): Promise<ApiEnvelope<BulkImportStatesResult>> {
    return {
      data: await this.countriesService.bulkImportStates(countryId, dto),
    };
  }

  @Delete(':countryId/states/:stateId')
  @RequirePlatformPermission('country', 'edit')
  @ApiOperation({ summary: 'Remove a state/province' })
  async deleteState(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Param('stateId', ParseUUIDPipe) stateId: string,
  ): Promise<ApiEnvelope<{ success: boolean }>> {
    await this.countriesService.deleteState(countryId, stateId);
    return { data: { success: true } };
  }

  // --- Tax Brackets ---

  @Post(':countryId/tax-brackets')
  @RequirePlatformPermission('country', 'edit')
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
  @RequirePlatformPermission('country', 'edit')
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

  // --- Country Rules ---

  @Post(':countryId/rules')
  @RequirePlatformPermission('country', 'edit')
  @ApiOperation({
    summary: 'Create leave / OT / social security / public holiday / employment rule version',
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
  @RequirePlatformPermission('country', 'edit')
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

  // --- RuleVersion Framework Endpoints ---

  @Get(':countryId/rule-versions')
  @RequirePlatformPermission('country', 'view')
  @ApiOperation({
    summary: 'List all rule versions for a rule set and scope',
  })
  async listRuleVersions(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Query() query: QueryRuleVersionsDto,
  ): Promise<ApiEnvelope<RuleVersionView[]>> {
    return {
      data: await this.ruleVersionsService.listVersions(countryId, query),
    };
  }

  @Get(':countryId/rule-versions/diff')
  @RequirePlatformPermission('country', 'view')
  @ApiOperation({
    summary: 'Compare two rule versions and produce side-by-side diff',
  })
  async compareRuleVersions(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Query('baseVersionId', ParseUUIDPipe) baseVersionId: string,
    @Query('compareVersionId', ParseUUIDPipe) compareVersionId: string,
  ): Promise<ApiEnvelope<RuleVersionDiffResult>> {
    return {
      data: await this.ruleVersionsService.compareVersions(
        countryId,
        baseVersionId,
        compareVersionId,
      ),
    };
  }

  @Get(':countryId/rule-versions/:versionId')
  @RequirePlatformPermission('country', 'view')
  @ApiOperation({ summary: 'Get a specific rule version by ID' })
  async getRuleVersion(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ): Promise<ApiEnvelope<RuleVersionView>> {
    return {
      data: await this.ruleVersionsService.getVersion(countryId, versionId),
    };
  }

  @Post(':countryId/rule-versions')
  @RequirePlatformPermission('country', 'edit')
  @ApiOperation({
    summary: 'Create a new rule version with source reference and change note',
  })
  async createRuleVersion(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Body() dto: CreateRuleVersionDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<RuleVersionView>> {
    const actorId =
      (req as any).platformUser?.id ??
      (req as any).user?.id ??
      (req as any).user?.email ??
      'system';

    return {
      data: await this.ruleVersionsService.createVersion(
        countryId,
        dto,
        actorId,
      ),
    };
  }

  @Patch(':countryId/rule-versions/:versionId')
  @RequirePlatformPermission('country', 'edit')
  @ApiOperation({
    summary: 'Update an existing rule version (immutability enforced on published)',
  })
  async updateRuleVersion(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Body() dto: UpdateRuleVersionDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<RuleVersionView>> {
    const actorId =
      (req as any).platformUser?.id ??
      (req as any).user?.id ??
      (req as any).user?.email ??
      'system';

    return {
      data: await this.ruleVersionsService.updateVersion(
        countryId,
        versionId,
        dto,
        actorId,
      ),
    };
  }

  @Post(':countryId/rule-versions/:versionId/publish')
  @RequirePlatformPermission('country', 'edit')
  @ApiOperation({
    summary: 'Publish a draft rule version (validates non-overlapping dates)',
  })
  async publishRuleVersion(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Req() req: Request,
  ): Promise<ApiEnvelope<RuleVersionView>> {
    const actorId =
      (req as any).platformUser?.id ??
      (req as any).user?.id ??
      (req as any).user?.email ??
      'system';

    return {
      data: await this.ruleVersionsService.publishVersion(
        countryId,
        versionId,
        actorId,
      ),
    };
  }

  @Delete(':countryId/rule-versions/:versionId')
  @RequirePlatformPermission('country', 'edit')
  @ApiOperation({ summary: 'Delete a draft rule version' })
  async deleteRuleVersion(
    @Param('countryId', ParseUUIDPipe) countryId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
    @Req() req: Request,
  ): Promise<ApiEnvelope<{ success: boolean }>> {
    const actorId =
      (req as any).platformUser?.id ??
      (req as any).user?.id ??
      (req as any).user?.email ??
      'system';

    await this.ruleVersionsService.deleteVersion(countryId, versionId, actorId);
    return { data: { success: true } };
  }
}
