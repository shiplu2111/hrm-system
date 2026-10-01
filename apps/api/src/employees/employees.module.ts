import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { PortalAccessController } from './portal-access.controller';
import { PortalAccessService } from './portal-access.service';

@Module({
  imports: [PrismaModule, OrganizationModule, WebhooksModule],
  controllers: [EmployeesController, PortalAccessController],
  providers: [EmployeesService, PortalAccessService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
