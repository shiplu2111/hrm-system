import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import {
  WorkflowDefinitionsController,
  WorkflowInstancesController,
} from './workflow.controller';
import { WorkflowAssigneeService } from './workflow-assignee.service';
import { WorkflowDefinitionsService } from './workflow-definitions.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowInstancesService } from './workflow-instances.service';

@Module({
  imports: [PrismaModule, OrganizationModule, AuditModule],
  controllers: [WorkflowDefinitionsController, WorkflowInstancesController],
  providers: [
    WorkflowAssigneeService,
    WorkflowDefinitionsService,
    WorkflowEngineService,
    WorkflowInstancesService,
  ],
  exports: [
    WorkflowAssigneeService,
    WorkflowDefinitionsService,
    WorkflowEngineService,
    WorkflowInstancesService,
  ],
})
export class WorkflowModule {}
