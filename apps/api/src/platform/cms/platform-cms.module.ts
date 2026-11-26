import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { StorageModule } from '../../storage/storage.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { CmsRevalidationService } from './cms-revalidation.service';
import { CmsSchedulerService } from './cms-scheduler.service';
import { PlatformCmsController } from './platform-cms.controller';
import { PlatformCmsService } from './platform-cms.service';
import { PublicContentController } from './public-content.controller';

@Module({
  imports: [PrismaModule, StorageModule, PlatformAuditModule, PlatformAuthModule],
  controllers: [PlatformCmsController, PublicContentController],
  providers: [CmsRevalidationService, PlatformCmsService, CmsSchedulerService],
  exports: [PlatformCmsService, CmsRevalidationService],
})
export class PlatformCmsModule {}
