import { Body, Controller, Get, Header, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean } from 'class-validator';
import type {
  ApiResponse as ApiEnvelope,
  PublicKbArticleDetail,
  PublicKbArticleSummary,
  PublicKbCategory,
  PublicKbCategoryDetail,
  PublicKbFeedbackResponse,
} from '@hrm/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PublicKbService } from './public-kb.service';

export class PublicKbFeedbackDto {
  @IsBoolean()
  helpful!: boolean;
}

@ApiTags('public-knowledge-base')
@SkipTenantScope()
@Public()
@Controller('public/kb')
export class PublicKbController {
  constructor(private readonly publicKbService: PublicKbService) {}

  @Get('categories')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=10, stale-while-revalidate=30')
  @ApiOperation({
    summary: 'List public Help Center categories that contain at least one public published article',
  })
  async listCategories(): Promise<ApiEnvelope<PublicKbCategory[]>> {
    const data = await this.publicKbService.listPublicCategories();
    return { data };
  }

  @Get('categories/:slug')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=10, stale-while-revalidate=30')
  @ApiOperation({ summary: 'Get a public Help Center category and its public published articles' })
  async getCategoryBySlug(@Param('slug') slug: string): Promise<ApiEnvelope<PublicKbCategoryDetail>> {
    const data = await this.publicKbService.getPublicCategoryBySlug(slug);
    return { data };
  }

  @Get('articles')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=10, stale-while-revalidate=30')
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categorySlug', required: false })
  @ApiOperation({
    summary: 'List or typo-tolerantly search public, published Help Center articles',
  })
  async listArticles(
    @Query('search') search?: string,
    @Query('categorySlug') categorySlug?: string,
  ): Promise<ApiEnvelope<PublicKbArticleSummary[], { total: number; query: string | null; typoTolerant: boolean }>> {
    const data = await this.publicKbService.listPublicArticles({ search, categorySlug });
    return {
      data,
      meta: {
        total: data.length,
        query: search?.trim() || null,
        typoTolerant: true,
      },
    };
  }

  @Get('articles/:slug')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=10, stale-while-revalidate=30')
  @ApiOperation({
    summary: 'Get a single public, published Help Center article and related public articles',
  })
  async getArticleBySlug(@Param('slug') slug: string): Promise<ApiEnvelope<PublicKbArticleDetail>> {
    const data = await this.publicKbService.getPublicArticleBySlug(slug);
    return { data };
  }

  @Post('articles/:slug/view')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Increment view count for a public published Help Center article' })
  async trackView(
    @Param('slug') slug: string,
  ): Promise<ApiEnvelope<{ articleId: string; viewCount: number }>> {
    const data = await this.publicKbService.incrementPublicView(slug);
    return { data };
  }

  @Post('articles/:slug/feedback')
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @ApiOperation({ summary: 'Submit Was this helpful? feedback on a public Help Center article' })
  async submitFeedback(
    @Param('slug') slug: string,
    @Body() dto: PublicKbFeedbackDto,
  ): Promise<ApiEnvelope<PublicKbFeedbackResponse>> {
    const data = await this.publicKbService.recordFeedback(slug, dto.helpful);
    return { data };
  }
}
