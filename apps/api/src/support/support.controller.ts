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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission, SelfService } from '../rbac/require-permission.decorator';
import {
  CreateKbArticleDto,
  CreateKbCategoryDto,
  CreateSupportTicketDto,
  CreateSupportTicketMessageDto,
  ListKbArticlesQueryDto,
  SupportQueueQueryDto,
  UpdateKbArticleDto,
  UpdateKbCategoryDto,
  UpdateSupportTicketDto,
} from './dto/support.dto';
import { KbService } from './kb.service';
import { SupportTicketsService } from './support-tickets.service';

@ApiTags('support')
@ApiBearerAuth('access-token')
@Controller('tenant/support')
export class SupportController {
  constructor(
    private readonly kbService: KbService,
    private readonly ticketsService: SupportTicketsService,
  ) {}

  // ---- Knowledge base (read: support view; write: support edit) ----

  @SelfService()
  @Get('kb/categories')
  @RequirePermission('support', 'view')
  async listCategories(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.kbService.listCategories(user.tenantId!, user),
    };
  }

  @Post('kb/categories')
  @RequirePermission('support', 'edit')
  async createCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateKbCategoryDto,
  ) {
    return {
      data: await this.kbService.createCategory(user.tenantId!, dto, user),
    };
  }

  @Patch('kb/categories/:categoryId')
  @RequirePermission('support', 'edit')
  async updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateKbCategoryDto,
  ) {
    return {
      data: await this.kbService.updateCategory(
        user.tenantId!,
        categoryId,
        dto,
        user,
      ),
    };
  }

  @Delete('kb/categories/:categoryId')
  @RequirePermission('support', 'edit')
  @ApiOperation({ summary: 'Delete an empty knowledge base category' })
  async deleteCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
  ) {
    await this.kbService.deleteCategory(user.tenantId!, categoryId, user);
    return { data: { deleted: true, categoryId } };
  }

  @SelfService()
  @Get('kb/articles')
  @RequirePermission('support', 'view')
  async listArticles(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListKbArticlesQueryDto,
  ) {
    return {
      data: await this.kbService.listArticles(user.tenantId!, user, query),
    };
  }

  @SelfService()
  @Get('kb/articles/:articleId')
  @RequirePermission('support', 'view')
  async getArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Query('preview') preview?: string,
  ) {
    return {
      data: await this.kbService.getArticle(user.tenantId!, articleId, user, {
        preview: preview === 'true',
      }),
    };
  }

  @Post('kb/articles')
  @RequirePermission('support', 'edit')
  async createArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateKbArticleDto,
  ) {
    return {
      data: await this.kbService.createArticle(user.tenantId!, dto, user),
    };
  }

  @Patch('kb/articles/:articleId')
  @RequirePermission('support', 'edit')
  async updateArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('articleId', ParseUUIDPipe) articleId: string,
    @Body() dto: UpdateKbArticleDto,
  ) {
    return {
      data: await this.kbService.updateArticle(
        user.tenantId!,
        articleId,
        dto,
        user,
      ),
    };
  }

  @Delete('kb/articles/:articleId')
  @RequirePermission('support', 'edit')
  @ApiOperation({ summary: 'Delete a knowledge base article' })
  async deleteArticle(
    @CurrentUser() user: AuthenticatedUser,
    @Param('articleId', ParseUUIDPipe) articleId: string,
  ) {
    await this.kbService.deleteArticle(user.tenantId!, articleId, user);
    return { data: { deleted: true, articleId } };
  }

  // ---- Support tickets ----

  @Get('queue')
  @RequirePermission('support', 'edit')
  @ApiOperation({ summary: 'Agent ticket queue with filters, status counts and paging' })
  async listQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: SupportQueueQueryDto,
  ) {
    return {
      data: await this.ticketsService.listQueue(user.tenantId!, user, query),
    };
  }

  @Get('agents')
  @RequirePermission('support', 'edit')
  @ApiOperation({ summary: 'Users who can be assigned support tickets' })
  async listAgents(@CurrentUser() user: AuthenticatedUser) {
    return { data: await this.ticketsService.listAgents(user.tenantId!) };
  }

  @SelfService()
  @Get('tickets')
  @RequirePermission('support', 'view')
  async listTickets(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.ticketsService.listTickets(user.tenantId!, user),
    };
  }

  @SelfService()
  @Get('tickets/:ticketId')
  @RequirePermission('support', 'view')
  async getTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    return {
      data: await this.ticketsService.getTicket(user.tenantId!, ticketId, user),
    };
  }

  @SelfService()
  @Post('tickets')
  @RequirePermission('support', 'create')
  async createTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return {
      data: await this.ticketsService.createTicket(user.tenantId!, dto, user),
    };
  }

  @Patch('tickets/:ticketId')
  @RequirePermission('support', 'edit')
  async updateTicket(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    return {
      data: await this.ticketsService.updateTicket(
        user.tenantId!,
        ticketId,
        dto,
        user,
      ),
    };
  }

  @SelfService()
  @Post('tickets/:ticketId/messages')
  @RequirePermission('support', 'view')
  async addMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateSupportTicketMessageDto,
  ) {
    return {
      data: await this.ticketsService.addMessage(
        user.tenantId!,
        ticketId,
        dto,
        user,
      ),
    };
  }
}
