import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { LifecycleModule } from '../lifecycle/lifecycle.module';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { Performance360Service } from './performance-360.service';
import { PerformanceController } from './performance.controller';
import { PerformanceLifecycleService } from './performance-lifecycle.service';
import { PerformanceReviewWorkflowService } from './performance-review-workflow.service';
import { PerformanceReviewsService } from './performance-reviews.service';
import { PerformanceService } from './performance.service';

@Module({
  imports: [PrismaModule, OrganizationModule, AuditModule, WorkflowModule, LifecycleModule],
  controllers: [PerformanceController],
  providers: [
    PerformanceService,
    PerformanceReviewsService,
    PerformanceReviewWorkflowService,
    Performance360Service,
    PerformanceLifecycleService,
  ],
  exports: [PerformanceService, PerformanceReviewsService],
})
export class PerformanceModule {}
