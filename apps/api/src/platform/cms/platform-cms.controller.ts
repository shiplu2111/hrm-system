import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type {
  ApiResponse as ApiEnvelope,
  CmsAuthorDto,
  CmsCareerDto,
  CmsCareerStatus,
  CmsChangelogEntryDto,
  CmsChangelogTag,
  CmsDashboardSummaryDto,
  CmsFaqDto,
  CmsMediaDto,
  CmsMediaUsageDto,
  CmsMenuDto,
  CmsPageDeletionImpactDto,
  CmsPageDetailDto,
  CmsPageDto,
  CmsPagePresenceResponseDto,
  CmsPageStatus,
  CmsPageVersionDto,
  CmsPostCategoryDto,
  CmsPostDto,
  CmsPostStatus,
  CmsPreviewTokenResponseDto,
  CmsRedirectCsvImportResultDto,
  CmsRedirectRuleDto,
  CmsRedirectType,
  CmsSiteSettingDto,
  CmsSiteSettingsBundleDto,
  CmsSlugAvailabilityDto,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PlatformActorContext } from '../audit/platform-audit.service';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import {
  ApproveLegalCmsDto,
  CmsPresenceHeartbeatDto,
  CreateCmsCustomPageDto,
  CreateCmsPageVersionDto,
  CreateCmsPreviewTokenDto,
  DeleteCmsPageDto,
  DuplicateCmsPageDto,
  ImportCmsRedirectsCsvDto,
  PermanentDeleteCmsPageDto,
  PermanentDeleteCmsPostDto,
  PublishCmsPageDto,
  RejectLegalCmsDto,
  ReorderCmsMenuItemsDto,
  RestoreCmsPageVersionDto,
  ScheduleCmsPublishDto,
  SubmitLegalApprovalDto,
  UnpublishCmsDto,
  UpdateCmsMediaDto,
  UpdateCmsMenuItemDto,
  UpdateCmsPageSlugDto,
  UpdateCmsRedirectDto,
  UpdateStructuredSiteSettingsDto,
  UpdateTrashRetentionDto,
  UpsertCmsAuthorDto,
  UpsertCmsCareerDto,
  UpsertCmsChangelogDto,
  UpsertCmsFaqDto,
  UpsertCmsMenuItemDto,
  UpsertCmsPostCategoryDto,
  UpsertCmsPostDto,
  UpsertCmsRedirectDto,
  UpsertCmsSiteSettingDto,
} from './dto/cms.dto';
import { PlatformCmsService } from './platform-cms.service';

type PlatformCmsRequest = Request & {
  platformUser?: PlatformActorContext & { role_name?: string; userId?: string; sub?: string };
  user?: PlatformActorContext & { role_name?: string; userId?: string; sub?: string };
};

@ApiTags('platform-cms')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/cms')
export class PlatformCmsController {
  constructor(private readonly cmsService: PlatformCmsService) { }

  private getActor(req: PlatformCmsRequest): PlatformActorContext {
    const user = req?.platformUser ?? req?.user;
    return {
      id: user?.id ?? user?.userId ?? user?.sub,
      email: user?.email,
      roleName: user?.roleName ?? user?.role_name,
      timezone:
        user?.timezone ??
        (typeof req?.headers?.['x-timezone'] === 'string' ? req.headers['x-timezone'] : undefined) ??
        'UTC',
      permissions: user?.permissions,
    };
  }

  // =========================================================================
  // Content Dashboard Overview
  // =========================================================================

  @Get('dashboard')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({
    summary:
      'Get CMS Content Dashboard metrics (drafts, scheduled, approvals, missing bn translations, broken links, recent changes)',
  })
  async getDashboardSummary(): Promise<ApiEnvelope<CmsDashboardSummaryDto>> {
    const data = await this.cmsService.getDashboardSummary();
    return { data };
  }

  // =========================================================================
  // Pages Workflow Endpoints
  // =========================================================================

  @Get('pages')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'List platform CMS pages with workflow and localization state' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'kind', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'includeTrashed', required: false })
  async listPages(
    @Query('status') status?: CmsPageStatus | 'all',
    @Query('kind') kind?: 'system' | 'custom' | 'all',
    @Query('search') search?: string,
    @Query('includeTrashed') includeTrashed?: string,
  ): Promise<ApiEnvelope<CmsPageDto[]>> {
    const data = await this.cmsService.listPages({
      status,
      kind,
      search,
      includeTrashed: includeTrashed === 'true',
    });
    return {
      data,
      meta: {
        total: data.length,
        page: 1,
        pageSize: Math.max(1, data.length),
        totalPages: 1,
      },
    };
  }

  @Get('slug-availability')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'Validate live CMS slug format, reserved blocklist, and uniqueness' })
  @ApiQuery({ name: 'slug', required: true })
  async checkSlugAvailability(
    @Query('slug') slug: string,
  ): Promise<ApiEnvelope<CmsSlugAvailabilityDto>> {
    const data = await this.cmsService.checkSlugAvailability(slug || '');
    return { data };
  }

  @Get('menus')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'List all navigation menus including hidden items and broken/unpublished target page flags' })
  async listMenus(): Promise<ApiEnvelope<CmsMenuDto[]>> {
    const data = await this.cmsService.listPlatformMenus();
    return { data };
  }

  @Post('menus/ensure-defaults')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Ensure default Header and Footer CMS menus & columns exist' })
  async ensureDefaultMenus(@Req() req: PlatformCmsRequest): Promise<ApiEnvelope<CmsMenuDto[]>> {
    const data = await this.cmsService.ensureDefaultNavigationMenus(this.getActor(req));
    return { data };
  }

  @Post('menus/:menuId/items')
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Add an internal page link, external link, mega-menu group, or footer column to a menu' })
  async createMenuItem(
    @Param('menuId') menuId: string,
    @Body() dto: UpsertCmsMenuItemDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsMenuDto>> {
    const data = await this.cmsService.createMenuItem(menuId, dto, this.getActor(req));
    return { data };
  }

  @Patch('menus/:menuId/items/:itemId')
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Update menu item labels, target page/URL, openInNewTab, or visibility (hide without delete)' })
  async updateMenuItem(
    @Param('menuId') menuId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCmsMenuItemDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsMenuDto>> {
    const data = await this.cmsService.updateMenuItem(menuId, itemId, dto, this.getActor(req));
    return { data };
  }

  @Delete('menus/:menuId/items/:itemId')
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Delete a menu item or group/column from a navigation menu' })
  async deleteMenuItem(
    @Param('menuId') menuId: string,
    @Param('itemId') itemId: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsMenuDto>> {
    const data = await this.cmsService.deleteMenuItem(menuId, itemId, this.getActor(req));
    return { data };
  }

  @Put('menus/:menuId/reorder')
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Persist drag-and-drop order and parent hierarchy for a navigation menu' })
  async reorderMenuItems(
    @Param('menuId') menuId: string,
    @Body() dto: ReorderCmsMenuItemsDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsMenuDto>> {
    const data = await this.cmsService.reorderMenuItems(menuId, dto, this.getActor(req));
    return { data };
  }

  @Get('pages/:id')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'Get CMS page details and immutable version history' })
  async getPageDetail(@Param('id') id: string): Promise<ApiEnvelope<CmsPageDetailDto>> {
    const data = await this.cmsService.getPageDetail(id);
    return { data };
  }

  @Post('pages')
  @RequirePlatformPermission('cms', 'create')
  @ApiOperation({ summary: 'Create a custom CMS page in draft status with initial v1 snapshot' })
  async createCustomPage(
    @Body() dto: CreateCmsCustomPageDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPageDto>> {
    const data = await this.cmsService.createCustomPage(dto, this.getActor(req));
    return { data };
  }

  @Post('pages/:id/versions')
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({
    summary: 'Save a new immutable page version snapshot with optimistic concurrency conflict protection',
  })
  async createPageVersion(
    @Param('id') id: string,
    @Body() dto: CreateCmsPageVersionDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPageVersionDto>> {
    const data = await this.cmsService.createPageVersion(id, dto, this.getActor(req));
    return { data };
  }

  @Post('pages/:id/versions/:versionId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({
    summary: 'Restore a historical version into a new immutable draft version (never overwrites history)',
  })
  async restorePageVersionAsDraft(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @Body() dto: RestoreCmsPageVersionDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPageVersionDto>> {
    const data = await this.cmsService.restorePageVersionAsDraft(
      id,
      versionId,
      this.getActor(req),
      dto?.note,
    );
    return { data };
  }

  @Get('pages/:id/presence')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'List active staff editors currently viewing or editing a CMS page' })
  async getPagePresence(@Param('id') id: string): Promise<ApiEnvelope<CmsPagePresenceResponseDto>> {
    const data = await this.cmsService.getPagePresence(id);
    return { data };
  }

  @Post('pages/:id/presence')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Send active-editor presence heartbeat and check latest saved version numbers' })
  async recordPagePresence(
    @Param('id') id: string,
    @Body() dto: CmsPresenceHeartbeatDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPagePresenceResponseDto>> {
    const data = await this.cmsService.recordEditorPresence(id, dto, this.getActor(req));
    return { data };
  }

  @Delete('pages/:id/presence')
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Release active-editor presence session when closing the page editor' })
  async releasePagePresence(
    @Param('id') id: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<ApiEnvelope<{ released: true }>> {
    const data = await this.cmsService.removeEditorPresence(id, sessionId || '');
    return { data };
  }

  @Patch('pages/:id')
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Update custom CMS page slug' })
  async updatePage(
    @Param('id') id: string,
    @Body() dto: UpdateCmsPageSlugDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPageDto>> {
    const data = await this.cmsService.updatePage(id, dto, this.getActor(req));
    return { data };
  }

  @Post('pages/:id/preview-token')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'Generate a signed expiring preview token for draft inspection' })
  async createPreviewToken(
    @Param('id') id: string,
    @Body() dto: CreateCmsPreviewTokenDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPreviewTokenResponseDto>> {
    const data = await this.cmsService.createPagePreviewToken(id, dto, this.getActor(req));
    return { data };
  }

  @Post('pages/:id/submit-approval')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Submit a legal page revision for Stage F four-eyes approval' })
  async submitForApproval(
    @Param('id') id: string,
    @Body() dto: SubmitLegalApprovalDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPageDto>> {
    const data = await this.cmsService.submitPageForApproval(id, dto, this.getActor(req));
    return { data };
  }

  @Post('pages/:id/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({
    summary: 'Approve a pending legal page revision (Stage F four-eyes separation of duties)',
  })
  async approveLegalPage(
    @Param('id') id: string,
    @Body() dto: ApproveLegalCmsDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPageDto>> {
    const data = await this.cmsService.approveLegalPage(id, dto, this.getActor(req));
    return { data };
  }

  @Post('pages/:id/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Reject a pending legal page revision with a reason' })
  async rejectLegalPage(
    @Param('id') id: string,
    @Body() dto: RejectLegalCmsDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPageDto>> {
    const data = await this.cmsService.rejectLegalPage(id, dto, this.getActor(req));
    return { data };
  }

  @Post('pages/:id/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Publish CMS page immediately (Content Publisher+ only)' })
  async publishPageNow(
    @Param('id') id: string,
    @Body() dto: PublishCmsPageDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPageDto>> {
    const data = await this.cmsService.publishPageNow(id, dto, this.getActor(req));
    return { data };
  }

  @Post('pages/:id/schedule')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({
    summary: 'Schedule CMS page publication in the staff member timezone (Content Publisher+ only)',
  })
  async schedulePagePublish(
    @Param('id') id: string,
    @Body() dto: ScheduleCmsPublishDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPageDto>> {
    const data = await this.cmsService.schedulePagePublish(id, dto, this.getActor(req));
    return { data };
  }

  @Post('pages/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Unpublish a custom CMS page (Content Publisher+ only)' })
  async unpublishPage(
    @Param('id') id: string,
    @Body() dto: UnpublishCmsDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPageDto>> {
    const data = await this.cmsService.unpublishPage(id, dto, this.getActor(req));
    return { data };
  }

  @Get('pages/:id/deletion-impact')
  @RequirePlatformPermission('cms', 'delete')
  @ApiOperation({ summary: 'Analyze menu links, page backlinks, live status, and redirect options before deleting a custom page' })
  async getPageDeletionImpact(
    @Param('id') id: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPageDeletionImpactDto>> {
    const data = await this.cmsService.getPageDeletionImpact(id, this.getActor(req));
    return { data };
  }

  @Delete('pages/:id')
  @RequirePlatformPermission('cms', 'delete')
  @ApiOperation({ summary: 'Move a custom CMS page to trash (Content Publisher+ only, never system pages)' })
  async trashPage(
    @Param('id') id: string,
    @Body() dto: DeleteCmsPageDto | undefined,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPageDto>> {
    const data = await this.cmsService.trashOrDeletePage(id, this.getActor(req), dto);
    return { data };
  }

  @Delete('pages/:id/permanent')
  @RequirePlatformPermission('cms', 'delete')
  @ApiOperation({ summary: 'Permanently delete a trashed custom CMS page (Content Publisher+ only, typed confirmation, audit logged)' })
  async permanentDeletePage(
    @Param('id') id: string,
    @Body() dto: PermanentDeleteCmsPageDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<{ id: string; slug: string; deleted: true }>> {
    const data = await this.cmsService.permanentDeletePage(id, dto, this.getActor(req));
    return { data };
  }

  @Get('trash/retention')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'Get configured CMS Trash retention window in days (default 30)' })
  async getTrashRetention(): Promise<ApiEnvelope<{ days: number }>> {
    const days = await this.cmsService.getTrashRetentionDays();
    return { data: { days } };
  }

  @Put('trash/retention')
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Update CMS Trash retention window in days (Publisher/Admin only)' })
  async updateTrashRetention(
    @Body() dto: UpdateTrashRetentionDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<{ days: number }>> {
    const data = await this.cmsService.updateTrashRetentionDays(dto.days, this.getActor(req));
    return { data };
  }

  @Post('jobs/purge-trash')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Purge expired trashed custom pages past the configured retention window' })
  async purgeExpiredTrash(): Promise<
    ApiEnvelope<{ purgedCount: number; purgedIds: string[]; retentionDays: number }>
  > {
    const data = await this.cmsService.purgeExpiredTrashedPages(new Date());
    return { data };
  }

  @Post('pages/:id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Restore a trashed custom CMS page back to draft' })
  async restorePage(@Param('id') id: string, @Req() req: PlatformCmsRequest): Promise<ApiEnvelope<CmsPageDto>> {
    const data = await this.cmsService.restorePage(id, this.getActor(req));
    return { data };
  }

  @Post('pages/:id/duplicate')
  @RequirePlatformPermission('cms', 'create')
  @ApiOperation({ summary: 'Duplicate a custom CMS page into a new draft (custom pages only)' })
  async duplicatePage(
    @Param('id') id: string,
    @Body() dto: DuplicateCmsPageDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPageDto>> {
    const data = await this.cmsService.duplicateCustomPage(id, dto, this.getActor(req));
    return { data };
  }

  // =========================================================================
  // Posts, Categories & Authors Workflow Endpoints
  // =========================================================================

  @Get('posts')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'List CMS blog posts with status, category, author, locale, and search filters' })
  async listPosts(
    @Query('status') status?: CmsPostStatus | 'all',
    @Query('categoryId') categoryId?: string,
    @Query('authorId') authorId?: string,
    @Query('localeStatus') localeStatus?: 'all' | 'bn_translated' | 'bn_missing',
    @Query('tag') tag?: string,
    @Query('search') search?: string,
    @Query('includeTrashed') includeTrashed?: string,
  ): Promise<ApiEnvelope<CmsPostDto[]>> {
    const data = await this.cmsService.listPosts({
      status,
      categoryId,
      authorId,
      localeStatus,
      tag,
      search,
      includeTrashed: includeTrashed === 'true' || status === 'trashed' || status === 'all',
    });
    return {
      data,
      meta: {
        total: data.length,
        page: 1,
        pageSize: Math.max(1, data.length),
        totalPages: 1,
      },
    };
  }

  @Get('posts/:id')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'Get a single CMS blog post by ID including full localized content and SEO' })
  async getPostById(@Param('id') id: string): Promise<ApiEnvelope<CmsPostDto>> {
    const data = await this.cmsService.getPostById(id);
    return { data };
  }

  @Post('posts')
  @RequirePlatformPermission('cms', 'create')
  @ApiOperation({ summary: 'Create a blog post in draft status' })
  async createPostDraft(
    @Body() dto: UpsertCmsPostDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPostDto>> {
    const data = await this.cmsService.createPostDraft(dto, this.getActor(req));
    return { data };
  }

  @Patch('posts/:id')
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Edit a CMS blog post draft' })
  async updatePostDraft(
    @Param('id') id: string,
    @Body() dto: Partial<UpsertCmsPostDto>,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPostDto>> {
    const data = await this.cmsService.updatePostDraft(id, dto, this.getActor(req));
    return { data };
  }

  @Post('posts/:id/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  async publishPost(@Param('id') id: string, @Req() req: PlatformCmsRequest): Promise<ApiEnvelope<CmsPostDto>> {
    const data = await this.cmsService.publishPostNow(id, this.getActor(req));
    return { data };
  }

  @Post('posts/:id/schedule')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  async schedulePost(
    @Param('id') id: string,
    @Body() dto: ScheduleCmsPublishDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPostDto>> {
    const data = await this.cmsService.schedulePostPublish(id, dto, this.getActor(req));
    return { data };
  }

  @Post('posts/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  async unpublishPost(@Param('id') id: string, @Req() req: PlatformCmsRequest): Promise<ApiEnvelope<CmsPostDto>> {
    const data = await this.cmsService.unpublishPost(id, this.getActor(req));
    return { data };
  }

  @Delete('posts/:id')
  @RequirePlatformPermission('cms', 'delete')
  async trashPost(@Param('id') id: string, @Req() req: PlatformCmsRequest): Promise<ApiEnvelope<CmsPostDto>> {
    const data = await this.cmsService.trashPost(id, this.getActor(req));
    return { data };
  }

  @Post('posts/:id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  async restorePost(@Param('id') id: string, @Req() req: PlatformCmsRequest): Promise<ApiEnvelope<CmsPostDto>> {
    const data = await this.cmsService.restorePost(id, this.getActor(req));
    return { data };
  }

  @Delete('posts/:id/permanent')
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Permanently delete a trashed blog post after typed confirmation' })
  async permanentlyDeletePost(
    @Param('id') id: string,
    @Body() dto: PermanentDeleteCmsPostDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<{ id: string; slug: string; deleted: true }>> {
    const data = await this.cmsService.permanentlyDeletePost(id, dto.confirmText, this.getActor(req));
    return { data };
  }

  @Get('blog/categories')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'List blog post categories with active post counts' })
  async listPostCategories(): Promise<ApiEnvelope<CmsPostCategoryDto[]>> {
    const data = await this.cmsService.listPostCategories();
    return { data };
  }

  @Post('blog/categories')
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Create a blog post category' })
  async createPostCategory(
    @Body() dto: UpsertCmsPostCategoryDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPostCategoryDto>> {
    const data = await this.cmsService.createPostCategory(dto, this.getActor(req));
    return { data };
  }

  @Patch('blog/categories/:id')
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Update a blog post category' })
  async updatePostCategory(
    @Param('id') id: string,
    @Body() dto: Partial<UpsertCmsPostCategoryDto>,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsPostCategoryDto>> {
    const data = await this.cmsService.updatePostCategory(id, dto, this.getActor(req));
    return { data };
  }

  @Delete('blog/categories/:id')
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Delete an unused blog post category' })
  async deletePostCategory(
    @Param('id') id: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<{ id: string; deleted: true }>> {
    const data = await this.cmsService.deletePostCategory(id, this.getActor(req));
    return { data };
  }

  @Get('blog/authors')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'List blog authors with avatar URLs and post counts' })
  async listAuthors(): Promise<ApiEnvelope<CmsAuthorDto[]>> {
    const data = await this.cmsService.listAuthors();
    return { data };
  }

  @Post('blog/authors')
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Create a blog author profile' })
  async createAuthor(
    @Body() dto: UpsertCmsAuthorDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsAuthorDto>> {
    const data = await this.cmsService.createAuthor(dto, this.getActor(req));
    return { data };
  }

  @Patch('blog/authors/:id')
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Update a blog author profile' })
  async updateAuthor(
    @Param('id') id: string,
    @Body() dto: Partial<UpsertCmsAuthorDto>,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsAuthorDto>> {
    const data = await this.cmsService.updateAuthor(id, dto, this.getActor(req));
    return { data };
  }

  @Delete('blog/authors/:id')
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Delete an unused blog author profile' })
  async deleteAuthor(
    @Param('id') id: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<{ id: string; deleted: true }>> {
    const data = await this.cmsService.deleteAuthor(id, this.getActor(req));
    return { data };
  }

  // =========================================================================
  // Changelog, Careers & Settings Endpoints
  // =========================================================================

  @Get('changelog')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'List all CMS changelog entries with tag, visibility, and search filters' })
  async listChangelog(
    @Query('tag') tag?: CmsChangelogTag | 'all',
    @Query('visibility') visibility?: 'all' | 'published' | 'hidden' | 'trashed',
    @Query('search') search?: string,
    @Query('includeTrashed') includeTrashed?: string,
  ): Promise<ApiEnvelope<CmsChangelogEntryDto[]>> {
    const data = await this.cmsService.listChangelog({
      tag,
      visibility,
      search,
      includeTrashed: includeTrashed === 'true' || visibility === 'trashed',
    });
    return {
      data,
      meta: {
        total: data.length,
        page: 1,
        pageSize: Math.max(1, data.length),
        totalPages: 1,
      },
    };
  }

  @Get('changelog/:id')
  @RequirePlatformPermission('cms', 'view')
  async getChangelogEntry(@Param('id') id: string): Promise<ApiEnvelope<CmsChangelogEntryDto>> {
    const data = await this.cmsService.getChangelogEntry(id);
    return { data };
  }

  @Post('changelog')
  @RequirePlatformPermission('cms', 'create')
  async createChangelogDraft(
    @Body() dto: UpsertCmsChangelogDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsChangelogEntryDto>> {
    const data = await this.cmsService.createChangelogDraft(dto, this.getActor(req));
    return { data };
  }

  @Patch('changelog/:id')
  @RequirePlatformPermission('cms', 'edit')
  async updateChangelogDraft(
    @Param('id') id: string,
    @Body() dto: Partial<UpsertCmsChangelogDto>,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsChangelogEntryDto>> {
    const data = await this.cmsService.updateChangelogDraft(id, dto, this.getActor(req));
    return { data };
  }

  @Post('changelog/:id/publish')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  async publishChangelog(
    @Param('id') id: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsChangelogEntryDto>> {
    const data = await this.cmsService.setChangelogPublishState(id, true, this.getActor(req));
    return { data };
  }

  @Post('changelog/:id/schedule')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  async scheduleChangelog(
    @Param('id') id: string,
    @Body() dto: ScheduleCmsPublishDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsChangelogEntryDto>> {
    const data = await this.cmsService.scheduleChangelogPublish(id, dto, this.getActor(req));
    return { data };
  }

  @Post('changelog/:id/unpublish')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  async unpublishChangelog(
    @Param('id') id: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsChangelogEntryDto>> {
    const data = await this.cmsService.setChangelogPublishState(id, false, this.getActor(req));
    return { data };
  }

  @Delete('changelog/:id')
  @RequirePlatformPermission('cms', 'delete')
  async trashChangelog(
    @Param('id') id: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsChangelogEntryDto>> {
    const data = await this.cmsService.trashChangelog(id, this.getActor(req));
    return { data };
  }

  @Post('changelog/:id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  async restoreChangelog(
    @Param('id') id: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsChangelogEntryDto>> {
    const data = await this.cmsService.restoreChangelog(id, this.getActor(req));
    return { data };
  }

  @Delete('changelog/:id/permanent')
  @RequirePlatformPermission('cms', 'manage')
  async permanentlyDeleteChangelog(
    @Param('id') id: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<{ id: string; slug: string; deleted: true }>> {
    const data = await this.cmsService.permanentlyDeleteChangelog(id, this.getActor(req));
    return { data };
  }

  @Get('careers')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'List all CMS career job listings with status, department, and search filters' })
  async listCareers(
    @Query('status') status?: CmsCareerStatus | 'all',
    @Query('department') department?: string,
    @Query('search') search?: string,
    @Query('includeTrashed') includeTrashed?: string,
  ): Promise<ApiEnvelope<CmsCareerDto[]>> {
    const data = await this.cmsService.listCareers({
      status,
      department,
      search,
      includeTrashed: includeTrashed === 'true',
    });
    return {
      data,
      meta: {
        total: data.length,
        page: 1,
        pageSize: Math.max(1, data.length),
        totalPages: 1,
      },
    };
  }

  @Get('careers/:id')
  @RequirePlatformPermission('cms', 'view')
  async getCareerById(@Param('id') id: string): Promise<ApiEnvelope<CmsCareerDto>> {
    const data = await this.cmsService.getCareerById(id);
    return { data };
  }

  @Post('careers')
  @RequirePlatformPermission('cms', 'create')
  async createCareer(
    @Body() dto: UpsertCmsCareerDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsCareerDto>> {
    const data = await this.cmsService.createCareerDraft(dto, this.getActor(req));
    return { data };
  }

  @Patch('careers/:id')
  @RequirePlatformPermission('cms', 'edit')
  async updateCareer(
    @Param('id') id: string,
    @Body() dto: Partial<UpsertCmsCareerDto>,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsCareerDto>> {
    const data = await this.cmsService.updateCareerDraft(id, dto, this.getActor(req));
    return { data };
  }

  @Post('careers/:id/status')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  async setCareerStatus(
    @Param('id') id: string,
    @Body('status') status: 'draft' | 'open' | 'paused' | 'closed',
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsCareerDto>> {
    const data = await this.cmsService.setCareerStatus(id, status, this.getActor(req));
    return { data };
  }

  @Delete('careers/:id')
  @RequirePlatformPermission('cms', 'delete')
  async trashCareer(
    @Param('id') id: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsCareerDto>> {
    const data = await this.cmsService.trashCareer(id, this.getActor(req));
    return { data };
  }

  @Post('careers/:id/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  async restoreCareer(
    @Param('id') id: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsCareerDto>> {
    const data = await this.cmsService.restoreCareer(id, this.getActor(req));
    return { data };
  }

  @Delete('careers/:id/permanent')
  @RequirePlatformPermission('cms', 'manage')
  async permanentlyDeleteCareer(
    @Param('id') id: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<{ id: string; slug: string; deleted: true }>> {
    const data = await this.cmsService.permanentlyDeleteCareer(id, this.getActor(req));
    return { data };
  }

  @Get('site-settings')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'Get structured website Site Settings bundle (contact, social, announcement bar, footer, cookie wording, SEO, default language)' })
  async getStructuredSiteSettings(): Promise<ApiEnvelope<CmsSiteSettingsBundleDto>> {
    const data = await this.cmsService.getStructuredSiteSettings();
    return { data };
  }

  @Put('site-settings')
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Update structured website Site Settings (Content Publisher+ only, audit logged)' })
  async updateStructuredSiteSettings(
    @Body() dto: UpdateStructuredSiteSettingsDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsSiteSettingsBundleDto>> {
    const data = await this.cmsService.updateStructuredSiteSettings(dto, this.getActor(req));
    return { data };
  }

  @Put('settings')
  @RequirePlatformPermission('cms', 'manage')
  async upsertSiteSetting(
    @Body() dto: UpsertCmsSiteSettingDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsSiteSettingDto>> {
    const data = await this.cmsService.upsertSiteSetting(dto, this.getActor(req));
    return { data };
  }

  @Post('jobs/run-scheduled')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'manage')
  @ApiOperation({ summary: 'Manually trigger processing of due scheduled CMS publications' })
  async runScheduledJob() {
    const data = await this.cmsService.processDueScheduledPublications(new Date());
    return { data };
  }

  // =========================================================================
  // Media Library Endpoints (Stage C.1)
  // =========================================================================

  @Get('media')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'List CMS Media Library assets (filterable by folder, tag, mimeGroup, search)' })
  @ApiQuery({ name: 'folder', required: false })
  @ApiQuery({ name: 'tag', required: false })
  @ApiQuery({ name: 'mimeGroup', required: false, enum: ['all', 'images', 'pdfs'] })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  async listMedia(
    @Query('folder') folder?: string,
    @Query('tag') tag?: string,
    @Query('mimeGroup') mimeGroup?: 'all' | 'images' | 'pdfs',
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<ApiEnvelope<CmsMediaDto[]>> {
    const parsedLimit = limit ? parseInt(limit, 10) : 48;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    const result = await this.cmsService.listMedia({
      folder,
      tag,
      mimeGroup: mimeGroup === 'images' || mimeGroup === 'pdfs' ? mimeGroup : 'all',
      search,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : 48,
      offset: Number.isFinite(parsedOffset) ? parsedOffset : 0,
    });
    return {
      data: result.items,
      meta: {
        total: result.total,
        page: Math.floor((parsedOffset || 0) / Math.max(1, parsedLimit || 48)) + 1,
        pageSize: Math.max(1, parsedLimit || 48),
        totalPages: Math.max(1, Math.ceil(result.total / Math.max(1, parsedLimit || 48))),
      },
    };
  }

  @Post('media')
  @RequirePlatformPermission('cms', 'create')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload an image (EXIF stripped + resized WebP/AVIF variants) or PDF download via FileStorage driver',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  async uploadMedia(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body()
    body: {
      folder?: string;
      tags?: string;
      altEn?: string;
      altBn?: string;
      captionEn?: string;
      captionBn?: string;
      width?: string;
      height?: string;
    },
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsMediaDto>> {
    if (!file) {
      throw new BadRequestException({
        code: 'CMS_MEDIA_FILE_REQUIRED',
        message: 'File ("file" multipart field) is required.',
      });
    }
    const width = body?.width ? parseInt(body.width, 10) : null;
    const height = body?.height ? parseInt(body.height, 10) : null;
    const data = await this.cmsService.uploadMedia(
      {
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        folder: body?.folder,
        tags: body?.tags,
        altEn: body?.altEn,
        altBn: body?.altBn,
        captionEn: body?.captionEn,
        captionBn: body?.captionBn,
        width: Number.isFinite(width) ? width : null,
        height: Number.isFinite(height) ? height : null,
      },
      this.getActor(req),
    );
    return { data };
  }

  @Get('media/:id/usage')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'Inspect every CMS page, blog post, author, and setting referencing this media asset' })
  async getMediaUsage(@Param('id') id: string): Promise<ApiEnvelope<CmsMediaUsageDto>> {
    const data = await this.cmsService.getMediaUsage(id);
    return { data };
  }

  @Patch('media/:id')
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Update CMS media alt text, captions, folder, or tags' })
  async updateMedia(
    @Param('id') id: string,
    @Body() dto: UpdateCmsMediaDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsMediaDto>> {
    const data = await this.cmsService.updateMediaMetadata(id, dto, this.getActor(req));
    return { data };
  }

  @Delete('media/:id')
  @RequirePlatformPermission('cms', 'delete')
  @ApiOperation({ summary: 'Delete an asset from the CMS Media Library (blocked if used on published content)' })
  async deleteMedia(
    @Param('id') id: string,
    @Query('force') force: string | undefined,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<{ id: string; deleted: true }>> {
    const data = await this.cmsService.deleteMedia(id, this.getActor(req), {
      forceDraftUnlink: force === 'true',
    });
    return { data };
  }

  // =========================================================================
  // FAQ Library Endpoints
  // =========================================================================

  @Get('faqs')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'List CMS FAQ library entries for FAQ Library and Page Editor FAQ Picker' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'pageSlug', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'isPublished', required: false })
  async listFaqs(
    @Query('category') category?: string,
    @Query('pageSlug') pageSlug?: string,
    @Query('search') search?: string,
    @Query('isPublished') isPublished?: string,
  ): Promise<ApiEnvelope<CmsFaqDto[]>> {
    const data = await this.cmsService.listFaqs({
      category,
      pageSlug,
      search,
      ...(isPublished === 'true'
        ? { isPublished: true }
        : isPublished === 'false'
          ? { isPublished: false }
          : {}),
    });
    return { data };
  }

  @Post('faqs')
  @RequirePlatformPermission('cms', 'create')
  @ApiOperation({ summary: 'Create a reusable rich-text FAQ entry grouped by topic' })
  async createFaq(
    @Body() dto: UpsertCmsFaqDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsFaqDto>> {
    const data = await this.cmsService.createFaq(dto, this.getActor(req));
    return { data };
  }

  @Patch('faqs/:id')
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Update a FAQ library entry (publish visibility requires cms:manage)' })
  async updateFaq(
    @Param('id') id: string,
    @Body() dto: Partial<UpsertCmsFaqDto>,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsFaqDto>> {
    const data = await this.cmsService.updateFaq(id, dto, this.getActor(req));
    return { data };
  }

  @Delete('faqs/:id')
  @RequirePlatformPermission('cms', 'delete')
  @ApiOperation({ summary: 'Delete a FAQ item from the FAQ library' })
  async deleteFaq(
    @Param('id') id: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<{ id: string; deleted: true }>> {
    const data = await this.cmsService.deleteFaq(id, this.getActor(req));
    return { data };
  }

  // =========================================================================
  // Redirect Rules (301/302, Loop/Chain Detection, Hit Tracking, CSV Import/Export)
  // =========================================================================

  @Get('redirects')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'List CMS redirect rules with hit counts and status' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'redirectType', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  async listRedirects(
    @Query('search') search?: string,
    @Query('redirectType') redirectType?: CmsRedirectType | 'all',
    @Query('isActive') isActive?: 'all' | 'true' | 'false',
  ): Promise<ApiEnvelope<CmsRedirectRuleDto[]>> {
    const data = await this.cmsService.listRedirects({ search, redirectType, isActive });
    return { data };
  }

  @Get('redirects/export-csv')
  @RequirePlatformPermission('cms', 'view')
  @ApiOperation({ summary: 'Export all CMS redirect rules as CSV' })
  async exportRedirectsCsv(@Res() res: Response): Promise<void> {
    const csv = await this.cmsService.exportRedirectsCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cms-redirects.csv"');
    res.status(200).send(csv);
  }

  @Post('redirects/import-csv')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Bulk import CMS redirect rules from CSV with loop & chain validation' })
  async importRedirectsCsv(
    @Body() dto: ImportCmsRedirectsCsvDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsRedirectCsvImportResultDto>> {
    const data = await this.cmsService.importRedirectsCsv(dto.csv, this.getActor(req));
    return { data };
  }

  @Post('redirects')
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Create a manual 301 or 302 redirect rule (blocks loops and chains)' })
  async createRedirect(
    @Body() dto: UpsertCmsRedirectDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsRedirectRuleDto>> {
    const data = await this.cmsService.createRedirect(dto, this.getActor(req));
    return { data };
  }

  @Patch('redirects/:id')
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Update a CMS redirect rule (blocks loops and chains)' })
  async updateRedirect(
    @Param('id') id: string,
    @Body() dto: UpdateCmsRedirectDto,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<CmsRedirectRuleDto>> {
    const data = await this.cmsService.updateRedirect(id, dto, this.getActor(req));
    return { data };
  }

  @Delete('redirects/:id')
  @RequirePlatformPermission('cms', 'edit')
  @ApiOperation({ summary: 'Delete a CMS redirect rule' })
  async deleteRedirect(
    @Param('id') id: string,
    @Req() req: PlatformCmsRequest,
  ): Promise<ApiEnvelope<{ id: string; deleted: true }>> {
    const data = await this.cmsService.deleteRedirect(id, this.getActor(req));
    return { data };
  }
}
