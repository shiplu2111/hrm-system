import { Module } from '@nestjs/common';
import { PrismaModule } from '../../database/prisma.module';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformDashboardController } from './platform-dashboard.controller';
import { PlatformDashboardService } from './platform-dashboard.service';

@Module({
  imports: [PrismaModule, PlatformAuthModule],
  controllers: [PlatformDashboardController],
  providers: [PlatformDashboardService],
  exports: [PlatformDashboardService],
})
export class PlatformDashboardModule {}
