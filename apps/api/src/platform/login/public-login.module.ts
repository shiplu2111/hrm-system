import { Module } from '@nestjs/common';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { PrismaModule } from '../../database/prisma.module';
import { MailService } from '../../settings/mail.service';
import { PlatformAuditModule } from '../audit/platform-audit.module';
import { PublicLoginController } from './public-login.controller';
import { PublicLoginService } from './public-login.service';

@Module({
  imports: [PrismaModule, PlatformAuditModule],
  controllers: [PublicLoginController],
  providers: [PublicLoginService, MailService, FieldEncryptionService],
  exports: [PublicLoginService],
})
export class PublicLoginModule {}
