// apps/api/src/platform/queues/platform-queues.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformQueuesController } from './platform-queues.controller';
import { PlatformQueuesService } from './platform-queues.service';

@Module({
  imports: [PrismaModule, forwardRef(() => PlatformAuthModule)],
  controllers: [PlatformQueuesController],
  providers: [PlatformQueuesService],
  exports: [PlatformQueuesService],
})
export class PlatformQueuesModule {}
