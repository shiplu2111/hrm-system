import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { UnifiedAuthGuard } from '../auth/unified-auth.guard';
import { ApiAccessModule } from '../api-access/api-access.module';
import { EnterpriseFeatureGuard } from '../billing/enterprise-feature.guard';
import { BillingModule } from '../billing/billing.module';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RbacModule } from '../rbac/rbac.module';
import { RejectClientTenantInterceptor } from './reject-client-tenant.interceptor';
import { TenantInterceptor } from './tenant.interceptor';

@Global()
@Module({
  imports: [RbacModule, ApiAccessModule, BillingModule],
  providers: [
    UnifiedAuthGuard,
    {
      provide: APP_GUARD,
      useClass: UnifiedAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: EnterpriseFeatureGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RejectClientTenantInterceptor,
    },
  ],
})
export class TenantModule {}
