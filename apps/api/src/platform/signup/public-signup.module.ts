import { Module } from '@nestjs/common';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { PrismaModule } from '../../database/prisma.module';
import { MailService } from '../../settings/mail.service';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformPlansModule } from '../plans/platform-plans.module';
import { PlatformTenantsModule } from '../tenants/platform-tenants.module';
import { PublicCaptchaService } from './public-captcha.service';
import { PublicSignupController } from './public-signup.controller';
import { PublicSignupService } from './public-signup.service';

@Module({
  imports: [PrismaModule, PlatformAuditModule, PlatformPlansModule, PlatformTenantsModule],
  controllers: [PublicSignupController],
  providers: [
    PublicSignupService,
    PublicCaptchaService,
    MailService,
    FieldEncryptionService,
  ],
  exports: [PublicSignupService, PublicCaptchaService],
})
export class PublicSignupModule {}
