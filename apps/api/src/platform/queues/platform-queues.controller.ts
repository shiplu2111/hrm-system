// apps/api/src/platform/queues/platform-queues.controller.ts
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  BullMqJobItem,
  CleanQueueJobsInput,
  CleanQueueJobsResult,
  JobState,
  QueueJobsResponse,
  QueueSystemOverview,
  RemoveJobInput,
  RemoveJobResult,
  RetryJobResult,
  RetryQueueFailedJobsResult,
} from '@hrm/shared-types';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { PlatformQueuesService } from './platform-queues.service';

interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, any>;
}

@ApiTags('Platform Job Queue Inspector')
@ApiBearerAuth()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/queues')
export class PlatformQueuesController {
  constructor(private readonly queuesService: PlatformQueuesService) {}

  /**
   * Helper to assert Platform Admin or Platform Owner role.
   */
  private assertAdminAccess(req: any) {
    const user = req.platformUser || req.user;
    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Platform authentication required.',
      });
    }

    const role = user.roleName || user.role_name || '';
    if (role !== 'Platform Owner' && role !== 'Platform Admin') {
      // Also allow if user has platform:manage permission
      const permissions: Array<{ module: string; action: string }> = user.permissions || [];
      const canManage = permissions.some((p) => p.module === 'platform' && p.action === 'manage');
      if (!canManage) {
        throw new ForbiddenException({
          code: 'FORBIDDEN',
          message: 'Access restricted: Job Queue Inspector requires Platform Admin or Platform Owner privileges.',
        });
      }
    }

    return {
      id: user.id || user.userId || user.sub,
      email: user.email,
      roleName: role,
      permissions: user.permissions,
    };
  }

  @Get('overview')
  @ApiOperation({ summary: 'List all BullMQ queues, states, and health overview' })
  async getOverview(@Req() req: any): Promise<ApiEnvelope<QueueSystemOverview>> {
    const actor = this.assertAdminAccess(req);
    const data = await this.queuesService.getQueueOverview(actor);
    return { data };
  }

  @Get('jobs')
  @ApiOperation({ summary: 'List jobs across queues filtered by state, search, and prominence' })
  async getJobs(
    @Query('queueName') queueName?: string,
    @Query('state') state?: JobState | 'all',
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('prominentOnly') prominentOnly?: string,
    @Req() req?: any,
  ): Promise<ApiEnvelope<QueueJobsResponse>> {
    const actor = this.assertAdminAccess(req);
    const data = await this.queuesService.getJobs(
      {
        queueName,
        state,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        prominentOnly: prominentOnly === 'true',
      },
      actor,
    );
    return {
      data,
      meta: {
        page: data.page,
        limit: data.limit,
        total: data.total,
        totalPages: data.totalPages,
      },
    };
  }

  @Get(':queueName/jobs/:jobId')
  @ApiOperation({ summary: 'Get full details for a job including failed reason and stacktrace' })
  async getJobDetails(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
    @Req() req: any,
  ): Promise<ApiEnvelope<BullMqJobItem>> {
    const actor = this.assertAdminAccess(req);
    const data = await this.queuesService.getJobDetails(queueName, jobId, actor);
    return { data };
  }

  @Post(':queueName/jobs/:jobId/retry')
  @ApiOperation({ summary: 'Retry a failed or stalled job in a queue' })
  async retryJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
    @Req() req: any,
  ): Promise<ApiEnvelope<RetryJobResult>> {
    const actor = this.assertAdminAccess(req);
    const data = await this.queuesService.retryJob(queueName, jobId, actor);
    return { data };
  }

  @Post(':queueName/retry-failed')
  @ApiOperation({ summary: 'Retry all failed jobs in a queue in batch' })
  async retryFailedJobs(
    @Param('queueName') queueName: string,
    @Req() req: any,
  ): Promise<ApiEnvelope<RetryQueueFailedJobsResult>> {
    const actor = this.assertAdminAccess(req);
    const data = await this.queuesService.retryFailedJobs(queueName, actor);
    return { data };
  }

  @Delete(':queueName/jobs/:jobId')
  @ApiOperation({ summary: 'Permanently remove a job. Requires typed reason for payroll jobs.' })
  async removeJob(
    @Param('queueName') queueName: string,
    @Param('jobId') jobId: string,
    @Body() body: RemoveJobInput,
    @Query('reason') queryReason: string,
    @Req() req: any,
  ): Promise<ApiEnvelope<RemoveJobResult>> {
    const actor = this.assertAdminAccess(req);
    const reason = body?.reason || queryReason;
    const data = await this.queuesService.removeJob(queueName, jobId, { reason }, actor);
    return { data };
  }

  @Post(':queueName/clean')
  @ApiOperation({ summary: 'Clean completed or failed jobs from a queue' })
  async cleanQueue(
    @Param('queueName') queueName: string,
    @Body() body: CleanQueueJobsInput,
    @Req() req: any,
  ): Promise<ApiEnvelope<CleanQueueJobsResult>> {
    const actor = this.assertAdminAccess(req);
    const data = await this.queuesService.cleanQueue(queueName, body, actor);
    return { data };
  }
}
