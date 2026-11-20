import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformSupportAccessController } from './platform-support-access.controller';
import { PlatformSupportAccessService } from './platform-support-access.service';
import { PlatformSupportSessionsController } from './platform-support-sessions.controller';

@Module({
  imports: [
    PrismaModule,
    PlatformAuthModule,
    PlatformAuditModule,
    NotificationsModule,
  ],
  controllers: [
    PlatformSupportAccessController,
    PlatformSupportSessionsController,
  ],
  providers: [PlatformSupportAccessService],
  exports: [PlatformSupportAccessService],
})
export class PlatformSupportAccessModule {}
