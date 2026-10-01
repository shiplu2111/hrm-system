import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { CompanyScopeService } from './company-scope.service';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrgChartService } from './org-chart.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, OrgChartService, CompanyScopeService],
  exports: [CompanyScopeService],
})
export class OrganizationModule {}
