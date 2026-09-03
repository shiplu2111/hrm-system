import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import {
  PrismaEmployeeContextRepository,
  PrismaRuleSourceRepository,
} from './prisma-rule-source.repository';
import { EMPLOYEE_CONTEXT, RULE_SOURCE } from './rule-resolver.constants';
import { RuleResolverService } from './rule-resolver.service';

@Module({
  imports: [PrismaModule],
  providers: [
    RuleResolverService,
    {
      provide: RULE_SOURCE,
      useClass: PrismaRuleSourceRepository,
    },
    {
      provide: EMPLOYEE_CONTEXT,
      useClass: PrismaEmployeeContextRepository,
    },
  ],
  exports: [RuleResolverService],
})
export class RuleResolverModule {}
