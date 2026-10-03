import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { AuditLogQueryService } from './audit-log-query.service';
import { AuditLogsController } from './audit-logs.controller';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [AuditLogsController],
  providers: [AuditService, AuditLogQueryService],
  exports: [AuditService],
})
export class AuditModule {}
