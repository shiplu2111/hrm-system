import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreatePayComponentDto,
  UpdatePayComponentDto,
} from './dto/pay-components.dto';
import { PayComponentsService } from './pay-components.service';

@ApiTags('pay-components')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/pay-components')
export class PayComponentsController {
  constructor(private readonly payComponentsService: PayComponentsService) {}

  @Get()
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'List admin-defined pay components (earnings/deductions)' })
  async list(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.payComponentsService.list(companyId) };
  }

  @Post()
  @RequirePermission('payroll', 'create')
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreatePayComponentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.payComponentsService.create(companyId, dto, user),
    };
  }

  @Patch(':componentId')
  @RequirePermission('payroll', 'edit')
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('componentId', ParseUUIDPipe) componentId: string,
    @Body() dto: UpdatePayComponentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.payComponentsService.update(
        companyId,
        componentId,
        dto,
        user,
      ),
    };
  }

  @Delete(':componentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('payroll', 'delete')
  async remove(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('componentId', ParseUUIDPipe) componentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.payComponentsService.remove(companyId, componentId, user);
  }
}
