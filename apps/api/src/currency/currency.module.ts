import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../database/prisma.module';
import { OrganizationModule } from '../organization/organization.module';
import { PlatformExchangeRatesModule } from '../platform/exchange-rates/platform-exchange-rates.module';
import { CurrencyPayrollService } from './currency-payroll.service';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService } from './exchange-rates.service';

@Module({
  imports: [PrismaModule, AuditModule, OrganizationModule, PlatformExchangeRatesModule],
  controllers: [ExchangeRatesController],
  providers: [ExchangeRatesService, CurrencyPayrollService],
  exports: [ExchangeRatesService, CurrencyPayrollService],
})
export class CurrencyModule {}
