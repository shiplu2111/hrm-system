import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { MaintenanceService } from './maintenance.service';
import {
  PlatformMaintenanceController,
  SystemStatusController,
} from './platform-maintenance.controller';
import { MaintenanceGuard } from './guards/maintenance.guard';

@Global()
@Module({
  imports: [
    PrismaModule,
    PlatformAuthModule,
    PlatformAuditModule,
  ],
  controllers: [
    PlatformMaintenanceController,
    SystemStatusController,
  ],
  providers: [
    MaintenanceService,
    MaintenanceGuard,
  ],
  exports: [
    MaintenanceService,
    MaintenanceGuard,
  ],
})
export class PlatformMaintenanceModule {}
