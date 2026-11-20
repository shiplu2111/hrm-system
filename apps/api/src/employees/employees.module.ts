import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { EmployeeDirectoryController, EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { PortalAccessController } from './portal-access.controller';
import { PortalAccessService } from './portal-access.service';
import { ProfileUpdateRequestsController } from './profile-update-requests.controller';
import { ProfileUpdateRequestsService } from './profile-update-requests.service';

@Module({
  imports: [PrismaModule, OrganizationModule, WebhooksModule, BillingModule],
  controllers: [
    EmployeesController,
    EmployeeDirectoryController,
    PortalAccessController,
    ProfileUpdateRequestsController,
  ],
  providers: [EmployeesService, PortalAccessService, ProfileUpdateRequestsService],
  exports: [EmployeesService, ProfileUpdateRequestsService],
})
export class EmployeesModule {}
