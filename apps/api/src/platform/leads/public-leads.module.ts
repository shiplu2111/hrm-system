import { Module } from '@nestjs/common';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { PrismaModule } from '../../database/prisma.module';
import { MailService } from '../../settings/mail.service';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PublicSignupModule } from '../signup/public-signup.module';
import { PlatformLeadsController } from './platform-leads.controller';
import { PlatformLeadsService } from './platform-leads.service';
import { PublicLeadsController } from './public-leads.controller';
import { PublicLeadsService } from './public-leads.service';
import { PublicNewsletterController, PublicNewsletterService } from './public-newsletter';

@Module({
  imports: [PrismaModule, PlatformAuditModule, PlatformAuthModule, PublicSignupModule],
  controllers: [PublicLeadsController, PlatformLeadsController, PublicNewsletterController],
  providers: [
    PublicLeadsService,
    PlatformLeadsService,
    PublicNewsletterService,
    MailService,
    FieldEncryptionService,
  ],
  exports: [PublicLeadsService, PlatformLeadsService, PublicNewsletterService],
})
export class PublicLeadsModule {}
