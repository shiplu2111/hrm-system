import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { PrismaModule } from '../database/prisma.module';
import { ApiAccessController, OAuthController } from './api-access.controller';
import { ApiAccessService } from './api-access.service';
import { ApiKeyAuthService } from './api-key-auth.service';
import { OAuthTokenAuthService } from './oauth-token-auth.service';
import { TenantApiKeyService } from './tenant-api-key.service';
import { TenantOAuthService } from './tenant-oauth.service';

@Module({
  imports: [PrismaModule, AuditModule, BillingModule],
  controllers: [ApiAccessController, OAuthController],
  providers: [
    ApiAccessService,
    TenantApiKeyService,
    TenantOAuthService,
    ApiKeyAuthService,
    OAuthTokenAuthService,
  ],
  exports: [ApiKeyAuthService, OAuthTokenAuthService, ApiAccessService],
})
export class ApiAccessModule {}
