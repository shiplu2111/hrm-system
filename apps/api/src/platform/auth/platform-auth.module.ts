import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CryptoModule } from '../../crypto/crypto.module';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformPermissionsGuard } from './guards/platform-permissions.guard';
import { PlatformAuthGuard } from './guards/platform-auth.guard';
import { PlatformAuthController } from './platform-auth.controller';
import { PlatformAuthService } from './platform-auth.service';
import { TotpService } from './totp.service';

@Module({
  imports: [
    PrismaModule,
    CryptoModule,
    forwardRef(() => PlatformAuditModule),
    JwtModule.register({
      secret:
        process.env.JWT_ACCESS_SECRET ??
        'hrm_secret_jwt_access_super_secure_2026',
      signOptions: {
        expiresIn: (process.env.JWT_ACCESS_EXPIRY as any) ?? '15m',
      },
    }),
  ],
  controllers: [PlatformAuthController],
  providers: [
    PlatformAuthService,
    TotpService,
    PlatformAuthGuard,
    PlatformPermissionsGuard,
  ],
  exports: [
    PlatformAuthService,
    TotpService,
    PlatformAuthGuard,
    PlatformPermissionsGuard,
    JwtModule,
  ],
})
export class PlatformAuthModule {}
