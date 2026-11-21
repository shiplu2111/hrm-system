import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CustomDomainService } from './custom-domain.service';
import { CustomDomainController } from './custom-domain.controller';
import { DnsVerificationService } from './dns/dns-verification.service';
import { AutomaticTlsProvider } from './tls/tls-certificate.provider';
import { CustomDomainQueueService } from './custom-domain-queue.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CustomDomainController],
  providers: [
    CustomDomainService,
    DnsVerificationService,
    AutomaticTlsProvider,
    CustomDomainQueueService,
  ],
  exports: [
    CustomDomainService,
    DnsVerificationService,
    AutomaticTlsProvider,
    CustomDomainQueueService,
  ],
})
export class CustomDomainsModule {}
