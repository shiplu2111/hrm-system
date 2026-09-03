import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { AttendanceSyncService } from './attendance-sync.service';
import { AttendanceSyncController } from './sync.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AttendanceSyncController],
  providers: [AttendanceSyncService],
  exports: [AttendanceSyncService],
})
export class SyncModule {}
