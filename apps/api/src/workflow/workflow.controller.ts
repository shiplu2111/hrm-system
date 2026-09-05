import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WorkflowEntityType } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreateWorkflowDefinitionDto,
  ListWorkflowDefinitionsQueryDto,
  ListWorkflowInstancesQueryDto,
  UpdateWorkflowDefinitionDto,
  WorkflowActionDto,
} from './dto/workflow.dto';
import { WorkflowDefinitionsService } from './workflow-definitions.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowInstancesService } from './workflow-instances.service';

const ENTITY_AUDIT_MODULE: Record<WorkflowEntityType, string> = {
  leave_request: 'leave',
  expense_claim: 'expense',
  payroll_adjustment: 'payroll',
  contract: 'employee',
};

@ApiTags('workflow-definitions')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/workflow-definitions')
export class WorkflowDefinitionsController {
  constructor(private readonly definitionsService: WorkflowDefinitionsService) {}

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'List reusable workflow definitions for a company' })
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListWorkflowDefinitionsQueryDto,
  ) {
    return { data: await this.definitionsService.list(companyId, query) };
  }

  @Get(':definitionId')
  @RequirePermission('settings', 'view')
  async get(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('definitionId', ParseUUIDPipe) definitionId: string,
  ) {
    return { data: await this.definitionsService.get(companyId, definitionId) };
  }

  @Post()
  @RequirePermission('settings', 'create')
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateWorkflowDefinitionDto,
  ) {
    return { data: await this.definitionsService.create(companyId, dto) };
  }

  @Patch(':definitionId')
  @RequirePermission('settings', 'edit')
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('definitionId', ParseUUIDPipe) definitionId: string,
    @Body() dto: UpdateWorkflowDefinitionDto,
  ) {
    return { data: await this.definitionsService.update(companyId, definitionId, dto) };
  }
}

@ApiTags('workflow-instances')
@ApiBearerAuth('access-token')
@Controller()
export class WorkflowInstancesController {
  constructor(
    private readonly instancesService: WorkflowInstancesService,
    private readonly engine: WorkflowEngineService,
  ) {}

  @Get('companies/:companyId/workflow-instances')
  @RequirePermission('settings', 'view')
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListWorkflowInstancesQueryDto,
  ) {
    const result = await this.instancesService.list(companyId, query);
    return { data: result.data, meta: { total: result.total } };
  }

  @Get('companies/:companyId/workflow-instances/pending-for-me')
  @RequirePermission('settings', 'view')
  async pendingForMe(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.instancesService.listPendingForUser(companyId, user) };
  }

  @Get('workflow-instances/:instanceId')
  @RequirePermission('settings', 'view')
  async get(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return { data: await this.instancesService.get(instanceId) };
  }

  @Post('workflow-instances/:instanceId/approve')
  @RequirePermission('settings', 'edit')
  async approve(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: WorkflowActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const instance = await this.instancesService.get(instanceId);
    const result = await this.engine.approve({
      instanceId,
      user,
      comment: dto.comment,
      audit: {
        tenantId: instance.tenantId,
        module: ENTITY_AUDIT_MODULE[instance.entityType],
        recordId: instance.entityId,
      },
    });
    return { data: result };
  }

  @Post('workflow-instances/:instanceId/reject')
  @RequirePermission('settings', 'edit')
  async reject(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: WorkflowActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const instance = await this.instancesService.get(instanceId);
    const result = await this.engine.reject({
      instanceId,
      user,
      comment: dto.comment,
      audit: {
        tenantId: instance.tenantId,
        module: ENTITY_AUDIT_MODULE[instance.entityType],
        recordId: instance.entityId,
      },
    });
    return { data: result };
  }
}
