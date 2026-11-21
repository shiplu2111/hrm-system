import { Module } from '@nestjs/common';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformSubscriptionsController } from './platform-subscriptions.controller';
import { PlatformSubscriptionsService } from './platform-subscriptions.service';

@Module({
  imports: [PlatformAuthModule, PlatformAuditModule],
  controllers: [PlatformSubscriptionsController],
  providers: [PlatformSubscriptionsService],
  exports: [PlatformSubscriptionsService],
})
export class PlatformSubscriptionsModule {}
