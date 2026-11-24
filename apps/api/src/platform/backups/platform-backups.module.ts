import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformBackupsService } from './platform-backups.service';
import { PlatformBackupsController } from './platform-backups.controller';

@Module({
  imports: [PrismaModule, PlatformAuthModule, PlatformAuditModule],
  controllers: [PlatformBackupsController],
  providers: [PlatformBackupsService],
  exports: [PlatformBackupsService],
})
export class PlatformBackupsModule {}
