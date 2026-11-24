// apps/api/src/platform/knowledge-base/platform-kb.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformKbController } from './platform-kb.controller';
import { PlatformKbService } from './platform-kb.service';

@Module({
  imports: [PrismaModule, forwardRef(() => PlatformAuthModule)],
  controllers: [PlatformKbController],
  providers: [PlatformKbService],
  exports: [PlatformKbService],
})
export class PlatformKbModule {}
