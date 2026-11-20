import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformSandboxService } from './platform-sandbox.service';
import { PlatformTenantLifecycleService } from './platform-tenant-lifecycle.service';
import { PlatformTenantsController } from './platform-tenants.controller';
import { PlatformTenantsService } from './platform-tenants.service';
import { TenantLifecycleQueueService } from './tenant-lifecycle-queue.service';

@Module({
  imports: [PrismaModule, PlatformAuditModule, PlatformAuthModule],
  controllers: [PlatformTenantsController],
  providers: [
    PlatformTenantsService,
    PlatformTenantLifecycleService,
    PlatformSandboxService,
    TenantLifecycleQueueService,
  ],
  exports: [
    PlatformTenantsService,
    PlatformTenantLifecycleService,
    PlatformSandboxService,
    TenantLifecycleQueueService,
  ],
})
export class PlatformTenantsModule {}
