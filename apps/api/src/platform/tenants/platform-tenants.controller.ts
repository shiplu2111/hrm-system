import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type {
  ApiResponse as ApiEnvelope,
  PlatformTenantSummary,
  SandboxTenantSummary,
  TenantProvisioningResult,
} from '@hrm/shared-types';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import {
  CreateSandboxTenantDto,
  DeleteSandboxTenantDto,
  ResetSandboxTenantDto,
} from './dto/sandbox-tenant.dto';
import {
  CancelTenantDto,
  HardDeleteTenantDto,
  ProvisionTenantDto,
  RestoreTenantDto,
  ScheduleDeletionDto,
  SuspendTenantDto,
} from './dto/tenant-lifecycle.dto';
import { PlatformSandboxService } from './platform-sandbox.service';
import { PlatformTenantLifecycleService } from './platform-tenant-lifecycle.service';
import { PlatformTenantsService } from './platform-tenants.service';
import { TenantLifecycleQueueService } from './tenant-lifecycle-queue.service';

@ApiTags('platform-tenants')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/tenants')
export class PlatformTenantsController {
  constructor(
    private readonly tenantsService: PlatformTenantsService,
    private readonly lifecycleService: PlatformTenantLifecycleService,
    private readonly sandboxService: PlatformSandboxService,
    private readonly lifecycleQueue: TenantLifecycleQueueService,
  ) {}

  @Get()
  @RequirePlatformPermission('tenant', 'view')
  @ApiOperation({
    summary:
      'List all provisioned tenants with search, multi-field filters, sortable columns, and pagination metadata (platform scoped)',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'plan', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'createdFrom', required: false })
  @ApiQuery({ name: 'createdTo', required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['name', 'plan', 'employees', 'status', 'created', 'lastActivity'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  async listTenants(
    @Query('search') search?: string,
    @Query('plan') plan?: string,
    @Query('status') status?: string,
    @Query('country') country?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
    @Query('sortBy') sortBy?: 'name' | 'plan' | 'employees' | 'status' | 'created' | 'lastActivity',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') pageStr?: string,
    @Query('pageSize') pageSizeStr?: string,
  ): Promise<ApiEnvelope<PlatformTenantSummary[]>> {
    const page = pageStr ? parseInt(pageStr, 10) : undefined;
    const pageSize = pageSizeStr ? parseInt(pageSizeStr, 10) : undefined;

    const result = await this.tenantsService.listTenantsPaged({
      search,
      plan,
      status,
      country,
      createdFrom,
      createdTo,
      sortBy,
      sortOrder,
      page,
      pageSize,
    });

    return {
      data: result.items,
      meta: {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    };
  }

  @Post('provision')
  @RequirePlatformPermission('tenant', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Provision new tenant workspace (BullMQ job). Creates tenant, first company, roles, doc types, policies, notification templates, and initial owner user.',
  })
  async provisionTenant(
    @Body() dto: ProvisionTenantDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<TenantProvisioningResult>> {
    const actorUserId = req.user?.id;
    const result = await this.lifecycleQueue.enqueueProvisioning(
      dto,
      actorUserId,
    );
    return { data: result };
  }

  @Post('process-scheduled-deletions')
  @RequirePlatformPermission('tenant', 'delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Execute background hard deletion for all pending_deletion tenants whose grace period has expired.',
  })
  async processScheduledDeletions(@Req() req: any): Promise<
    ApiEnvelope<{
      processedCount: number;
      deletedTenantIds: string[];
    }>
  > {
    const actorUserId = req.user?.id;
    const result =
      await this.lifecycleQueue.enqueueProcessScheduledDeletions(actorUserId);
    return { data: result };
  }

  @Get('sandbox')
  @RequirePlatformPermission('tenant', 'view')
  @ApiOperation({
    summary: 'List all flagged sandbox demo tenants (non-billable)',
  })
  async listSandboxTenants(): Promise<ApiEnvelope<SandboxTenantSummary[]>> {
    const list = await this.sandboxService.listSandboxTenants();
    return { data: list };
  }

  @Get('sandbox/:id')
  @RequirePlatformPermission('tenant', 'view')
  @ApiOperation({
    summary: 'Get single sandbox tenant by ID',
  })
  async getSandboxTenant(
    @Param('id') id: string,
  ): Promise<ApiEnvelope<SandboxTenantSummary>> {
    const item = await this.sandboxService.getSandboxTenant(id);
    return { data: item };
  }

  @Post('sandbox')
  @RequirePlatformPermission('tenant', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Create flagged sandbox tenant seeded with sample demo data (non-billable)',
  })
  async createSandboxTenant(
    @Body() dto: CreateSandboxTenantDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<SandboxTenantSummary>> {
    const actorUserId = req.user?.id;
    const item = await this.sandboxService.createSandboxTenant(
      dto,
      actorUserId,
    );
    return { data: item };
  }

  @Post('sandbox/:id/reset')
  @RequirePlatformPermission('tenant', 'edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset sandbox tenant back to baseline sample data',
  })
  async resetSandboxTenant(
    @Param('id') id: string,
    @Body() dto: ResetSandboxTenantDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<SandboxTenantSummary>> {
    const actorUserId = req.user?.id;
    const item = await this.sandboxService.resetSandboxTenant(
      id,
      dto,
      actorUserId,
    );
    return { data: item };
  }

  @Delete('sandbox/:id')
  @RequirePlatformPermission('tenant', 'delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Immediately purge sandbox demo tenant workspace',
  })
  async deleteSandboxTenant(
    @Param('id') id: string,
    @Body() dto: DeleteSandboxTenantDto,
    @Req() req: any,
  ): Promise<
    ApiEnvelope<{ success: boolean; tenantId: string; message: string }>
  > {
    const actorUserId = req.user?.id;
    const res = await this.sandboxService.deleteSandboxTenant(
      id,
      dto,
      actorUserId,
    );
    return { data: res };
  }

  @Get(':id')
  @RequirePlatformPermission('tenant', 'view')
  @ApiOperation({
    summary:
      'Get platform-level tenant metadata by ID. Never exposes tenant business data.',
  })
  async getTenant(
    @Param('id') id: string,
  ): Promise<ApiEnvelope<PlatformTenantSummary>> {
    const tenant = await this.tenantsService.getTenant(id);
    return {
      data: tenant,
    };
  }

  @Post(':id/suspend')
  @RequirePlatformPermission('tenant', 'edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Suspend tenant workspace. Selectable mode: read_only or fully_blocked. Requires mandatory reason and writes to platform audit log.',
  })
  async suspendTenant(
    @Param('id') id: string,
    @Body() dto: SuspendTenantDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformTenantSummary>> {
    const actorUserId = req.user?.id;
    const tenant = await this.lifecycleService.suspendTenant(
      id,
      dto,
      actorUserId,
    );
    return { data: tenant };
  }

  @Post(':id/restore')
  @RequirePlatformPermission('tenant', 'edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Restore suspended, cancelled, or pending_deletion tenant back to active or trial status. Requires mandatory reason.',
  })
  async restoreTenant(
    @Param('id') id: string,
    @Body() dto: RestoreTenantDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformTenantSummary>> {
    const actorUserId = req.user?.id;
    const tenant = await this.lifecycleService.restoreTenant(
      id,
      dto,
      actorUserId,
    );
    return { data: tenant };
  }

  @Post(':id/cancel')
  @RequirePlatformPermission('tenant', 'edit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cancel tenant subscription / account. Requires mandatory reason.',
  })
  async cancelTenant(
    @Param('id') id: string,
    @Body() dto: CancelTenantDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformTenantSummary>> {
    const actorUserId = req.user?.id;
    const tenant = await this.lifecycleService.cancelTenant(
      id,
      dto,
      actorUserId,
    );
    return { data: tenant };
  }

  @Post(':id/schedule-deletion')
  @RequirePlatformPermission('tenant', 'delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Schedule tenant for deletion with a 30-day grace period (configurable). Hard delete blocked until grace period elapses. Requires mandatory reason.',
  })
  async scheduleDeletion(
    @Param('id') id: string,
    @Body() dto: ScheduleDeletionDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformTenantSummary>> {
    const actorUserId = req.user?.id;
    const tenant = await this.lifecycleService.scheduleDeletion(
      id,
      dto,
      actorUserId,
    );
    return { data: tenant };
  }

  @Post(':id/cancel-deletion')
  @RequirePlatformPermission('tenant', 'delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Cancel scheduled deletion of tenant workspace. Restores to active and clears deletion timer. Requires mandatory reason.',
  })
  async cancelDeletion(
    @Param('id') id: string,
    @Body() dto: RestoreTenantDto,
    @Req() req: any,
  ): Promise<ApiEnvelope<PlatformTenantSummary>> {
    const actorUserId = req.user?.id;
    const tenant = await this.lifecycleService.cancelDeletion(
      id,
      dto,
      actorUserId,
    );
    return { data: tenant };
  }

  @Post(':id/hard-delete')
  @RequirePlatformPermission('tenant', 'delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Execute hard deletion of tenant through a logged job only after the 30-day grace period has passed. Requires mandatory reason.',
  })
  async hardDeleteTenant(
    @Param('id') id: string,
    @Body() dto: HardDeleteTenantDto,
    @Req() req: any,
  ): Promise<
    ApiEnvelope<{ success: boolean; tenantId: string; message: string }>
  > {
    const actorUserId = req.user?.id;
    const result = await this.lifecycleQueue.enqueueHardDelete(
      tenantId(id),
      dto,
      actorUserId,
    );
    return { data: result };
  }
}

function tenantId(id: string): string {
  return id;
}
