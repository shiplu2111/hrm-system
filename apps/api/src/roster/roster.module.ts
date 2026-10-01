import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { LocaleModule } from '../locale/locale.module';
import { OrganizationModule } from '../organization/organization.module';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';
import { OtRulesController } from './ot-rules.controller';
import { OtRulesService } from './ot-rules.service';
import { RostersController } from './rosters.controller';
import { RostersService } from './rosters.service';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';

@Module({
  imports: [PrismaModule, OrganizationModule, LocaleModule],
  controllers: [ShiftsController, OtRulesController, RostersController, HolidaysController],
  providers: [ShiftsService, OtRulesService, RostersService, HolidaysService],
  exports: [ShiftsService, OtRulesService, RostersService, HolidaysService],
})
export class RosterModule {}
