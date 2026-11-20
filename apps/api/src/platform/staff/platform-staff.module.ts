import { Module } from '@nestjs/common';
import { CryptoModule } from '../../crypto/crypto.module';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformStaffController } from './platform-staff.controller';
import { PlatformStaffService } from './platform-staff.service';

@Module({
  imports: [
    PrismaModule,
    CryptoModule,
    PlatformAuthModule,
    PlatformAuditModule,
  ],
  controllers: [PlatformStaffController],
  providers: [PlatformStaffService],
  exports: [PlatformStaffService],
})
export class PlatformStaffModule {}
