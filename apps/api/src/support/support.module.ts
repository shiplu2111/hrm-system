import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { RbacModule } from '../rbac/rbac.module';
import { KbService } from './kb.service';
import { SupportController } from './support.controller';
import { SupportTicketsService } from './support-tickets.service';

@Module({
  imports: [PrismaModule, AuditModule, RbacModule],
  controllers: [SupportController],
  providers: [KbService, SupportTicketsService],
  exports: [KbService, SupportTicketsService],
})
export class SupportModule {}
