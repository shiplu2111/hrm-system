import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { ApiAccessModule } from '../../api-access/api-access.module';
import { PlatformAnnouncementsService } from './platform-announcements.service';
import { PlatformAnnouncementsController } from './platform-announcements.controller';
import { TenantAnnouncementsController } from './tenant-announcements.controller';

@Global()
@Module({
  imports: [
    PrismaModule,
    PlatformAuthModule,
    PlatformAuditModule,
    NotificationsModule,
    ApiAccessModule,
  ],
  controllers: [
    PlatformAnnouncementsController,
    TenantAnnouncementsController,
  ],
  providers: [
    PlatformAnnouncementsService,
  ],
  exports: [
    PlatformAnnouncementsService,
  ],
})
export class PlatformAnnouncementsModule {}
