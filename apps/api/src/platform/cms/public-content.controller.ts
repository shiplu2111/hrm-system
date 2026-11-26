import { Controller, Get, NotFoundException, Param, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { buildCmsETag, isIfNoneMatchHit } from './cms.utils';
import { PlatformCmsService } from './platform-cms.service';

@ApiTags('public-content')
@SkipTenantScope()
@Public()
@Throttle({ default: { limit: 120, ttl: 60000 } })
@Controller('public/content')
export class PublicContentController {
  constructor(private readonly cmsService: PlatformCmsService) { }

  private sendCachedJson(
    req: Request,
    res: Response,
    payload: unknown,
    cacheControl = 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
  ): void {
    const etag = buildCmsETag(payload);
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('ETag', etag);
    res.setHeader('Vary', 'Accept-Encoding');

    if (isIfNoneMatchHit(req.headers['if-none-match'], etag)) {
      res.status(304).end();
      return;
    }

    res.status(200).json(payload);
  }

  @Get('preview')
  @ApiOperation({
    summary: 'Resolve a DRAFT page snapshot using a signed expiring preview token (never indexed)',
  })
  @ApiQuery({ name: 'token', required: true })
  @ApiResponse({ status: 200, description: 'Draft preview payload with X-Robots-Tag: noindex' })
  @ApiResponse({ status: 401, description: 'Missing, invalid, or expired preview token' })
  async getDraftPreview(
    @Query('token') queryToken: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    const headerToken =
      typeof req.headers['x-cms-preview-token'] === 'string'
        ? req.headers['x-cms-preview-token']
        : undefined;
    const authHeader = req.headers.authorization;
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length).trim()
        : undefined;

    const data = await this.cmsService.resolvePreviewByToken(
      queryToken ?? headerToken ?? bearerToken,
    );
    res.status(200).json({ data });
  }

  @Get('pages')
  @ApiOperation({ summary: 'List published non-noindex CMS pages for website sitemap and routing' })
  @ApiQuery({ name: 'kind', required: false, enum: ['system', 'custom'] })
  async listPublishedPages(
    @Query('kind') kind: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const filterKind = kind === 'system' || kind === 'custom' ? kind : undefined;
    const data = await this.cmsService.listPublicPublishedPages(filterKind);
    this.sendCachedJson(req, res, { data, meta: { total: data.length } });
  }

  @Get('pages/:slug')
  @ApiOperation({
    summary: 'Get published CMS page by slug and locale (with English fallback, ETag & cache headers)',
  })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'bn'] })
  @ApiResponse({ status: 200, description: 'Published CMS page content' })
  @ApiResponse({ status: 304, description: 'Not Modified (ETag match)' })
  @ApiResponse({ status: 404, description: 'Published page not found' })
  async getPublishedPage(
    @Param('slug') slug: string,
    @Query('locale') locale: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.cmsService.resolvePublishedPage(slug, locale || 'en');
    if (!data) {
      throw new NotFoundException(`Published CMS page "${slug}" not found.`);
    }
    this.sendCachedJson(req, res, { data });
  }

  @Get('menus')
  @ApiOperation({ summary: 'Get active navigation menus with locale labels and caching headers' })
  @ApiQuery({ name: 'location', required: false })
  @ApiQuery({ name: 'slug', required: false })
  async getPublicMenus(
    @Query('location') location: string | undefined,
    @Query('slug') slug: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.cmsService.listPublicMenus({ location, slug });
    this.sendCachedJson(
      req,
      res,
      { data, meta: { total: data.length } },
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
  }

  @Get('posts')
  @ApiOperation({ summary: 'List published blog posts with pagination, categories, and caching headers' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'bn'] })
  @ApiQuery({ name: 'categorySlug', required: false })
  @ApiQuery({ name: 'authorSlug', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async listPublishedPosts(
    @Query('locale') locale: string | undefined,
    @Query('categorySlug') categorySlug: string | undefined,
    @Query('authorSlug') authorSlug: string | undefined,
    @Query('tag') tag: string | undefined,
    @Query('search') search: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.cmsService.listPublicPosts({
      locale: locale || 'en',
      categorySlug,
      authorSlug,
      tag,
      search,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
    this.sendCachedJson(req, res, {
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
        hasPublishedPosts: result.hasPublishedPosts,
        categories: result.categories,
      },
    });
  }

  @Get('posts/:slug')
  @ApiOperation({ summary: 'Get a single published blog post by slug and locale' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'bn'] })
  async getPublishedPostBySlug(
    @Param('slug') slug: string,
    @Query('locale') locale: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.cmsService.getPublicPostBySlug(slug, locale || 'en');
    if (!data) {
      throw new NotFoundException(`Published blog post "${slug}" not found.`);
    }
    this.sendCachedJson(req, res, { data });
  }

  @Get('changelog')
  @ApiOperation({ summary: 'List published changelog entries in reverse release-date order' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'bn'] })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  async listPublishedChangelog(
    @Query('locale') locale: string | undefined,
    @Query('tag') tag: string | undefined,
    @Query('page') page: string | undefined,
    @Query('pageSize') pageSize: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.cmsService.listPublicChangelog({
      locale: locale || 'en',
      tag,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
    this.sendCachedJson(req, res, {
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
    });
  }

  @Get('careers')
  @ApiOperation({ summary: 'List open career job listings with caching headers' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'bn'] })
  @ApiQuery({ name: 'department', required: false })
  async listPublicCareers(
    @Query('locale') locale: string | undefined,
    @Query('department') department: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.cmsService.listPublicCareers({
      locale: locale || 'en',
      department,
    });
    this.sendCachedJson(req, res, {
      data: result.items,
      meta: { total: result.items.length },
    });
  }

  @Get('careers/:slug')
  @ApiOperation({ summary: 'Get an open or closed career listing by slug (closed returns friendly status metadata)' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'bn'] })
  async getPublicCareerBySlug(
    @Param('slug') slug: string,
    @Query('locale') locale: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const data = await this.cmsService.getPublicCareerBySlug(slug, locale || 'en');
    if (!data) {
      throw new NotFoundException(`Published career listing "${slug}" not found.`);
    }
    this.sendCachedJson(req, res, { data });
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get public CMS site settings with caching headers and ETag' })
  async getPublicSettings(@Req() req: Request, @Res() res: Response): Promise<void> {
    const data = await this.cmsService.listPublicSiteSettings();
    this.sendCachedJson(
      req,
      res,
      { data },
      'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
  }

  @Get('faqs')
  @ApiOperation({ summary: 'List published CMS FAQ items by topic, pageSlug, or explicit IDs for FAQ blocks' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'bn'] })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'pageSlug', required: false })
  @ApiQuery({ name: 'ids', required: false, description: 'Comma-separated FAQ UUIDs' })
  @ApiQuery({ name: 'limit', required: false })
  async listPublicFaqs(
    @Query('locale') locale: string | undefined,
    @Query('category') category: string | undefined,
    @Query('pageSlug') pageSlug: string | undefined,
    @Query('ids') idsRaw: string | undefined,
    @Query('limit') limitRaw: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const ids = idsRaw
      ? idsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const limit = limitRaw ? parseInt(limitRaw, 10) : 50;
    const data = await this.cmsService.listPublicFaqs({
      locale: locale || 'en',
      category,
      pageSlug,
      ids,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    this.sendCachedJson(req, res, {
      data,
      meta: { total: data.length },
    });
  }

  @Get('redirects')
  @ApiOperation({ summary: 'Resolve an active public redirect rule for a retired page path' })
  @ApiQuery({ name: 'path', required: true })
  async getPublicRedirect(
    @Query('path') rawPath: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const rule = await this.cmsService.resolvePublicRedirect(rawPath || '/');
    if (!rule) {
      throw new NotFoundException(`No active redirect found for "${rawPath || '/'}".`);
    }
    this.sendCachedJson(
      req,
      res,
      { data: rule },
      'private, no-store, no-cache, must-revalidate',
    );
  }

  @Get('media/:id/file')
  @ApiOperation({
    summary:
      'Serve a public CMS Media Library asset (original, ?variant=thumb|medium|webp|avif, or ?download=1)',
  })
  @ApiQuery({ name: 'variant', required: false, enum: ['thumb', 'medium', 'webp', 'avif'] })
  @ApiQuery({ name: 'download', required: false })
  async getPublicMediaFile(
    @Param('id') id: string,
    @Query('variant') variant?: string,
    @Query('download') download?: string,
    @Res() res?: Response,
  ): Promise<void> {
    const validVariant =
      variant === 'thumb' || variant === 'medium' || variant === 'webp' || variant === 'avif'
        ? variant
        : undefined;
    const { media, buffer, mimeType } = await this.cmsService.getPublicMediaFile(id, validVariant);
    res!.setHeader('Content-Type', mimeType);
    res!.setHeader('X-Content-Type-Options', 'nosniff');
    res!.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    if (mimeType === 'image/svg+xml') {
      res!.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    }
    const disposition = download === '1' || download === 'true' ? 'attachment' : 'inline';
    res!.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${media.originalName.replace(/"/g, '')}"`,
    );
    res!.status(200).send(buffer);
  }
}
