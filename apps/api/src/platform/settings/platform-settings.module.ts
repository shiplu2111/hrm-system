import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { CryptoModule } from '../../crypto/crypto.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  imports: [
    PrismaModule,
    CryptoModule,
    PlatformAuthModule,
    PlatformAuditModule,
  ],
  controllers: [PlatformSettingsController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
