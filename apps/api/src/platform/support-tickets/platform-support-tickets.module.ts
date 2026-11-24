// apps/api/src/platform/support-tickets/platform-support-tickets.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformSupportTicketsController } from './platform-support-tickets.controller';
import { PlatformSupportTicketsService } from './platform-support-tickets.service';

@Module({
  imports: [PrismaModule, forwardRef(() => PlatformAuthModule)],
  controllers: [PlatformSupportTicketsController],
  providers: [PlatformSupportTicketsService],
  exports: [PlatformSupportTicketsService],
})
export class PlatformSupportTicketsModule {}
