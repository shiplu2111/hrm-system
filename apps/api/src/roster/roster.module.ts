import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { LocaleModule } from '../locale/locale.module';
import { OrganizationModule } from '../organization/organization.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { HolidaysController } from './holidays.controller';
import { HolidaysService } from './holidays.service';
import { OtRulesController } from './ot-rules.controller';
import { OtRulesService } from './ot-rules.service';
import { RosterRequestsController } from './roster-requests.controller';
import { RosterRequestsService } from './roster-requests.service';
import { RostersController } from './rosters.controller';
import { RostersService } from './rosters.service';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';

@Module({
  imports: [PrismaModule, OrganizationModule, LocaleModule, WorkflowModule],
  controllers: [
    ShiftsController,
    OtRulesController,
    RostersController,
    HolidaysController,
    RosterRequestsController,
  ],
  providers: [
    ShiftsService,
    OtRulesService,
    RostersService,
    HolidaysService,
    RosterRequestsService,
  ],
  exports: [
    ShiftsService,
    OtRulesService,
    RostersService,
    HolidaysService,
    RosterRequestsService,
  ],
})
export class RosterModule {}
