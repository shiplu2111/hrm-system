import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { ApiResponse as ApiEnvelope, AvailableTenantLanguage } from '@hrm/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PlatformLanguagePacksService } from './platform-language-packs.service';

@ApiTags('public-languages')
@SkipTenantScope()
@Public()
@Controller('public/languages')
export class PublicLanguagesController {
  constructor(private readonly languagePacksService: PlatformLanguagePacksService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=30, s-maxage=30')
  @ApiOperation({
    summary: 'List publicly available language packs',
    description:
      'Returns active language packs from Platform Language Packs (M.3) marked available for tenant and marketing use.',
  })
  @ApiResponse({ status: 200, description: 'Public language packs retrieved successfully' })
  async listPublicLanguages(): Promise<ApiEnvelope<AvailableTenantLanguage[], { total: number }>> {
    const data = await this.languagePacksService.listAvailableForTenants();
    return {
      data,
      meta: { total: data.length },
    };
  }
}
