// apps/api/src/platform/support-tickets/platform-support-tickets.controller.ts
import {
  Body,
  Controller,
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
  CreatePlatformTicketMessageInput,
  PlatformStaffAssignee,
  PlatformSupportQueueResponse,
  PlatformSupportTicketDetail,
  PlatformSupportTicketPriority,
  PlatformSupportTicketStatus,
  PlatformTicketMessageItem,
  SlaStatus,
  UpdatePlatformTicketInput,
} from '@hrm/shared-types';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { PlatformActorContext, PlatformSupportTicketsService } from './platform-support-tickets.service';

interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, any>;
}

@ApiTags('Platform Support Ticket Queue')
@ApiBearerAuth()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/support-tickets')
export class PlatformSupportTicketsController {
  constructor(private readonly supportService: PlatformSupportTicketsService) {}

  private getActor(req: any): PlatformActorContext {
    const user = req.platformUser || req.user;
    return {
      id: user?.id || user?.userId || user?.sub,
      email: user?.email,
      roleName: user?.roleName || user?.role_name,
      permissions: user?.permissions,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List platform support queue across all tenants with SLA tracking and filters' })
  async getQueue(
    @Query('tenantId') tenantId?: string,
    @Query('status') status?: PlatformSupportTicketStatus | 'all',
    @Query('priority') priority?: PlatformSupportTicketPriority | 'all',
    @Query('assigneeId') assigneeId?: string,
    @Query('search') search?: string,
    @Query('slaStatus') slaStatus?: SlaStatus | 'all',
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Req() req?: any,
  ): Promise<ApiEnvelope<PlatformSupportQueueResponse>> {
    const actor = this.getActor(req);
    const data = await this.supportService.getQueue(
      {
        tenantId,
        status,
        priority,
        assigneeId,
        search,
        slaStatus,
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

  @Get('staff')
  @ApiOperation({ summary: 'List active platform staff assignees for support ticket routing' })
  async getStaffAssignees(): Promise<ApiEnvelope<PlatformStaffAssignee[]>> {
    const data = await this.supportService.getStaffAssignees();
    return { data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get full support ticket detail with thread, internal notes, and SLA timers' })
  async getTicketDetail(
    @Param('id') id: string,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformSupportTicketDetail>> {
    const actor = this.getActor(req);
    const data = await this.supportService.getTicketDetail(id, actor);
    return { data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update support ticket status, priority, or staff assignment' })
  async updateTicket(
    @Param('id') id: string,
    @Body() body: UpdatePlatformTicketInput,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformSupportTicketDetail>> {
    const actor = this.getActor(req);
    const data = await this.supportService.updateTicket(id, body, actor);
    return { data };
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Add a customer-visible reply or staff internal note to the ticket' })
  async createMessage(
    @Param('id') id: string,
    @Body() body: CreatePlatformTicketMessageInput,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformTicketMessageItem>> {
    const actor = this.getActor(req);
    const data = await this.supportService.createMessage(id, body, actor);
    return { data };
  }
}
