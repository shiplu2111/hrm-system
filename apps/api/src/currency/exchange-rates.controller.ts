import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CompanyScopeService } from '../organization/company-scope.service';
import { parseDateOnly } from '../rule-resolver/effective-date.utils';
import { CurrencyPayrollService } from './currency-payroll.service';
import {
  CreateExchangeRateDto,
  ResolveExchangeRateQueryDto,
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
  ) {}

  @Get('tenant/exchange-rates')
  @RequirePermission('settings', 'view')
  async listRates(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.exchangeRatesService.listRates(user.tenantId!),
    };
  }

  @Get('tenant/exchange-rates/overview')
  @RequirePermission('settings', 'view')
  @ApiOperation({
    summary: 'Company base currencies, currency pairs needed by active contracts, and rate history with payroll locks',
  })
  async overview(@CurrentUser() user: AuthenticatedUser) {
    return {
      data: await this.exchangeRatesService.getOverview(user.tenantId!),
    };
  }

  @Get('tenant/exchange-rates/resolve')
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'Rate payroll would use for a pair on a given date' })
  async resolve(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ResolveExchangeRateQueryDto,
  ) {
    return {
      data: await this.exchangeRatesService.resolveRate(
        user.tenantId!,
        query.base,
        query.quote,
        parseDateOnly(query.date.slice(0, 10)),
      ),
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

  @Delete('tenant/exchange-rates/:rateId')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Delete a rate version that no finalized payroll depends on' })
  async deleteRate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('rateId', ParseUUIDPipe) rateId: string,
  ) {
    return {
      data: await this.exchangeRatesService.deleteRate(user.tenantId!, rateId, user),
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
    const view = await this.currencyPayrollService.setCompanyBaseCurrency(
      company.tenantId,
      companyId,
      dto.payrollBaseCurrency ?? null,
      user,
    );
    return { data: { ...view, tenantId: company.tenantId } };
  }
}
