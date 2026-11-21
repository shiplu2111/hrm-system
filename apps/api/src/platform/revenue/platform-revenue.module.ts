import { Module } from '@nestjs/common';
import { PlatformAuthModule } from '../auth/platform-auth.module';
import { PlatformRevenueController } from './platform-revenue.controller';
import { PlatformRevenueService } from './platform-revenue.service';

@Module({
  imports: [PlatformAuthModule],
  controllers: [PlatformRevenueController],
  providers: [PlatformRevenueService],
  exports: [PlatformRevenueService],
})
export class PlatformRevenueModule {}
