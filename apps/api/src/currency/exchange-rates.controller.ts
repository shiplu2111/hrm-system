import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CompanyScopeService } from '../organization/company-scope.service';
import { PrismaService } from '../database/prisma.service';
import { CurrencyPayrollService } from './currency-payroll.service';
import {
  CreateExchangeRateDto,
  UpdateCompanyPayrollCurrencyDto,
  UpdateExchangeRateDto,
} from './dto/exchange-rates.dto';
import { ExchangeRatesService } from './exchange-rates.service';

@ApiTags('currency')
@ApiBearerAuth('access-token')
@Controller()
export class ExchangeRatesController {
  constructor(
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly currencyPayrollService: CurrencyPayrollService,
    private readonly companyScope: CompanyScopeService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('tenant/exchange-rates')
  @RequirePermission('settings', 'view')
  async listRates(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.exchangeRatesService.listRates(user.tenantId!),
    };
  }

  @Post('tenant/exchange-rates')
  @RequirePermission('settings', 'edit')
  async createRate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExchangeRateDto,
  ) {
    return {
      data: await this.exchangeRatesService.createRate(
        user.tenantId!,
        dto,
        user,
      ),
    };
  }

  @Patch('tenant/exchange-rates/:rateId')
  @RequirePermission('settings', 'edit')
  async updateRate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateId', ParseUUIDPipe) rateId: string,
    @Body() dto: UpdateExchangeRateDto,
  ) {
    return {
      data: await this.exchangeRatesService.updateRate(
        user.tenantId!,
        rateId,
        dto,
        user,
      ),
    };
  }

  @Get('organization/companies/:companyId/payroll-currency')
  @RequirePermission('settings', 'view')
  async getCompanyPayrollCurrency(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    await this.companyScope.assertCompanyInTenant(companyId);
    const baseCurrency =
      await this.currencyPayrollService.resolveCompanyBaseCurrency(companyId);
    return { data: { companyId, payrollBaseCurrency: baseCurrency } };
  }

  @Patch('organization/companies/:companyId/payroll-currency')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Set company payroll base currency override' })
  async updateCompanyPayrollCurrency(
    @CurrentUser() user: AuthenticatedUser,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: UpdateCompanyPayrollCurrencyDto,
  ) {
    const company = await this.companyScope.assertCompanyInTenant(companyId);
    const row = await this.prisma.unscoped.company.update({
      where: { id: companyId },
      data: {
        payrollBaseCurrency:
          dto.payrollBaseCurrency?.toUpperCase().trim() ?? null,
      },
      select: { id: true, payrollBaseCurrency: true, country: { select: { currency: true } } },
    });
    return {
      data: {
        companyId: row.id,
        payrollBaseCurrency:
          row.payrollBaseCurrency ?? row.country.currency,
        tenantId: company.tenantId,
      },
    };
  }
}
