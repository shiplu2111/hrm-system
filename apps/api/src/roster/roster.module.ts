import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';
import { RostersController } from './rosters.controller';
import { RostersService } from './rosters.service';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';

@Module({
  imports: [PrismaModule, OrganizationModule],
  controllers: [ShiftsController, RostersController, HolidaysController],
  providers: [ShiftsService, RostersService, HolidaysService],
  exports: [ShiftsService, RostersService, HolidaysService],
})
export class RosterModule {}
