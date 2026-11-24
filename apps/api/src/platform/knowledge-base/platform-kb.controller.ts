// apps/api/src/platform/knowledge-base/platform-kb.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreateGlobalKbArticleInput,
  CreateGlobalKbCategoryInput,
  GlobalKbArticleDetail,
  GlobalKbArticlesResponse,
  GlobalKbCategory,
  GlobalKbStatus,
  IncrementArticleViewResult,
  UpdateGlobalKbArticleInput,
  UpdateGlobalKbCategoryInput,
} from '@hrm/shared-types';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformActorContext, PlatformKbService } from './platform-kb.service';

interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, any>;
}

@ApiTags('Platform Global Knowledge Base')
@ApiBearerAuth()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/knowledge-base')
export class PlatformKbController {
  constructor(private readonly kbService: PlatformKbService) {}

  private getActor(req: any): PlatformActorContext {
    const user = req.platformUser || req.user;
    return {
      id: user?.id || user?.userId || user?.sub,
      email: user?.email,
      roleName: user?.roleName || user?.role_name,
      permissions: user?.permissions,
    };
  }

  // ==========================================
  // Categories
  // ==========================================

  @Get('categories')
  @RequirePlatformPermission('support', 'view')
  @ApiOperation({ summary: 'List all global knowledge base categories with article counts' })
  async listCategories(@Req() req?: any): Promise<ApiEnvelope<GlobalKbCategory[]>> {
    const actor = this.getActor(req);
    const data = await this.kbService.listCategories(actor);
    return { data };
  }

  @Post('categories')
  @RequirePlatformPermission('support', 'manage')
  @ApiOperation({ summary: 'Create a new global knowledge base category' })
  async createCategory(
    @Body() body: CreateGlobalKbCategoryInput,
    @Req() req?: any,
  ): Promise<ApiEnvelope<GlobalKbCategory>> {
    const actor = this.getActor(req);
    const data = await this.kbService.createCategory(body, actor);
    return { data };
  }

  @Patch('categories/:id')
  @RequirePlatformPermission('support', 'manage')
  @ApiOperation({ summary: 'Update an existing global knowledge base category' })
  async updateCategory(
    @Param('id') id: string,
    @Body() body: UpdateGlobalKbCategoryInput,
    @Req() req?: any,
  ): Promise<ApiEnvelope<GlobalKbCategory>> {
    const actor = this.getActor(req);
    const data = await this.kbService.updateCategory(id, body, actor);
    return { data };
  }

  @Delete('categories/:id')
  @RequirePlatformPermission('support', 'manage')
  @ApiOperation({ summary: 'Delete an empty global knowledge base category' })
  async deleteCategory(
    @Param('id') id: string,
    @Req() req?: any,
  ): Promise<ApiEnvelope<{ success: boolean; id: string }>> {
    const actor = this.getActor(req);
    const data = await this.kbService.deleteCategory(id, actor);
    return { data };
  }

  // ==========================================
  // Articles
  // ==========================================

  @Get('articles')
  @RequirePlatformPermission('support', 'view')
  @ApiOperation({ summary: 'List global articles with filters (category, country, plan, status, search)' })
  async listArticles(
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('status') status?: GlobalKbStatus | 'all',
    @Query('country') country?: string,
    @Query('plan') plan?: string,
    @Query('tag') tag?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ): Promise<ApiEnvelope<GlobalKbArticlesResponse>> {
    const actor = this.getActor(req);
    const data = await this.kbService.listArticles(
      {
        search,
        categoryId,
        status,
        country,
        plan,
        tag,
        page: page ? parseInt(page, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 20,
      },
      actor,
    );
    return {
      data,
      meta: {
        page: data.page,
        pageSize: data.pageSize,
        total: data.total,
        totalPages: data.totalPages,
      },
    };
  }

  @Get('articles/:id')
  @RequirePlatformPermission('support', 'view')
  @ApiOperation({ summary: 'Get global article details with preview flag' })
  async getArticle(
    @Param('id') id: string,
    @Query('preview') preview?: string,
    @Req() req?: any,
  ): Promise<ApiEnvelope<GlobalKbArticleDetail>> {
    const actor = this.getActor(req);
    const isPreview = preview === 'true' || preview === '1';
    const data = await this.kbService.getArticle(id, { preview: isPreview }, actor);
    return { data };
  }

  @Post('articles')
  @RequirePlatformPermission('support', 'manage')
  @ApiOperation({ summary: 'Create a new global article with country/plan visibility' })
  async createArticle(
    @Body() body: CreateGlobalKbArticleInput,
    @Req() req?: any,
  ): Promise<ApiEnvelope<GlobalKbArticleDetail>> {
    const actor = this.getActor(req);
    const data = await this.kbService.createArticle(body, actor);
    return { data };
  }

  @Patch('articles/:id')
  @RequirePlatformPermission('support', 'manage')
  @ApiOperation({ summary: 'Update an existing global article' })
  async updateArticle(
    @Param('id') id: string,
    @Body() body: UpdateGlobalKbArticleInput,
    @Req() req?: any,
  ): Promise<ApiEnvelope<GlobalKbArticleDetail>> {
    const actor = this.getActor(req);
    const data = await this.kbService.updateArticle(id, body, actor);
    return { data };
  }

  @Delete('articles/:id')
  @RequirePlatformPermission('support', 'manage')
  @ApiOperation({ summary: 'Delete a global article' })
  async deleteArticle(
    @Param('id') id: string,
    @Req() req?: any,
  ): Promise<ApiEnvelope<{ success: boolean; id: string }>> {
    const actor = this.getActor(req);
    const data = await this.kbService.deleteArticle(id, actor);
    return { data };
  }

  @Post('articles/:id/view')
  @RequirePlatformPermission('support', 'view')
  @ApiOperation({ summary: 'Increment article view count' })
  async incrementView(@Param('id') id: string): Promise<ApiEnvelope<IncrementArticleViewResult>> {
    const data = await this.kbService.incrementViewCount(id);
    return { data };
  }
}
