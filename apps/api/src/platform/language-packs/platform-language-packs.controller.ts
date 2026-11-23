import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import type {
  AvailableTenantLanguage,
  ImportTranslationsResult,
  MissingKeysReport,
  PlatformLanguagePackDetail,
  PlatformLanguagePackSummary,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformLanguagePacksService } from './platform-language-packs.service';
import {
  CreateLanguagePackDto,
  ImportTranslationsDto,
  QueryLanguagePacksDto,
  SetLanguageAvailabilityDto,
  UpdateLanguagePackDto,
} from './dto/platform-language-packs.dto';

@ApiTags('platform-language-packs')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/language-packs')
export class PlatformLanguagePacksController {
  constructor(
    private readonly languagePacksService: PlatformLanguagePacksService,
  ) {}

  @Get()
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'List all supported language packs with translation completeness' })
  async list(
    @Query() query: QueryLanguagePacksDto,
  ): Promise<ApiEnvelope<PlatformLanguagePackSummary[]>> {
    const data = await this.languagePacksService.listLanguagePacks(query);
    return { data };
  }

  @Get('available-for-tenants')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'List all language packs marked as available for tenant selection' })
  async listAvailableForTenants(): Promise<ApiEnvelope<AvailableTenantLanguage[]>> {
    const data = await this.languagePacksService.listAvailableForTenants();
    return { data };
  }

  @Get(':code')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Get details and full translations of a specific language pack' })
  async getOne(
    @Param('code') code: string,
  ): Promise<ApiEnvelope<PlatformLanguagePackDetail>> {
    const data = await this.languagePacksService.getLanguagePack(code);
    return { data };
  }

  @Get(':code/missing-keys')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Generate a missing-keys report comparing against baseline reference language' })
  async getMissingKeysReport(
    @Param('code') code: string,
  ): Promise<ApiEnvelope<MissingKeysReport>> {
    const data = await this.languagePacksService.getMissingKeysReport(code);
    return { data };
  }

  @Get(':code/export')
  @RequirePlatformPermission('platform', 'view')
  @ApiOperation({ summary: 'Export translation catalog as JSON file or missing-keys template' })
  async exportCatalog(
    @Param('code') code: string,
    @Query('format') format: 'nested' | 'flat' | 'missing-template',
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.languagePacksService.exportTranslations(code, format);
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.status(200).json(result.data);
  }

  @Post(':code/import')
  @RequirePlatformPermission('platform', 'manage')
  @ApiOperation({ summary: 'Import translation file (JSON) to update language catalog' })
  async importCatalog(
    @Param('code') code: string,
    @Body() dto: ImportTranslationsDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<ImportTranslationsResult>> {
    const user = (req as any).platformUser;
    const data = await this.languagePacksService.importTranslations(
      code,
      dto,
      user?.id,
    );
    return { data };
  }

  @Patch(':code/availability')
  @RequirePlatformPermission('platform', 'manage')
  @ApiOperation({ summary: 'Mark language as available or unavailable to tenants' })
  async setAvailability(
    @Param('code') code: string,
    @Body() dto: SetLanguageAvailabilityDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<PlatformLanguagePackSummary>> {
    const user = (req as any).platformUser;
    const data = await this.languagePacksService.setAvailability(
      code,
      dto,
      user?.id,
    );
    return { data };
  }

  @Post()
  @RequirePlatformPermission('platform', 'manage')
  @ApiOperation({ summary: 'Register a new supported language pack' })
  async create(
    @Body() dto: CreateLanguagePackDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<PlatformLanguagePackDetail>> {
    const user = (req as any).platformUser;
    const data = await this.languagePacksService.createLanguagePack(
      dto,
      user?.id,
    );
    return { data };
  }

  @Patch(':code')
  @RequirePlatformPermission('platform', 'manage')
  @ApiOperation({ summary: 'Update language pack metadata' })
  async update(
    @Param('code') code: string,
    @Body() dto: UpdateLanguagePackDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<PlatformLanguagePackSummary>> {
    const user = (req as any).platformUser;
    const data = await this.languagePacksService.updateLanguagePack(
      code,
      dto,
      user?.id,
    );
    return { data };
  }
}
