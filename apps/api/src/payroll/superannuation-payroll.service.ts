import { Injectable } from '@nestjs/common';
import { RuleResolverService } from '../rule-resolver/rule-resolver.service';
import {
  parseSuperannuationRates,
  type ResolvedSuperannuationRates,
} from './superannuation.utils';

const SOCIAL_SECURITY_RULE_TYPE = 'social_security';

@Injectable()
export class SuperannuationPayrollService {
  constructor(private readonly ruleResolver: RuleResolverService) {}

  async resolveRatesForEmployee(
    employeeId: string,
    calculationDate: Date,
  ): Promise<ResolvedSuperannuationRates | null> {
    const resolved = await this.ruleResolver.resolveForEmployee(
      employeeId,
      SOCIAL_SECURITY_RULE_TYPE,
      calculationDate,
    );

    return parseSuperannuationRates(resolved.payload);
  }
}

export { SOCIAL_SECURITY_RULE_TYPE };
