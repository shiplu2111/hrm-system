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
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CreateShiftDto, UpdateShiftDto } from './dto/shifts.dto';
import { ShiftsService } from './shifts.service';

@ApiTags('shifts')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'List shift definitions for a company' })
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<ApiEnvelope<Awaited<ReturnType<ShiftsService['list']>>>> {
    return { data: await this.shiftsService.list(companyId) };
  }

  @Get(':shiftId')
  @RequirePermission('settings', 'view')
  async get(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
  ): Promise<ApiEnvelope<Awaited<ReturnType<ShiftsService['get']>>>> {
    return { data: await this.shiftsService.get(companyId, shiftId) };
  }

  @Post()
  @RequirePermission('settings', 'create')
  @ApiOperation({ summary: 'Create a shift definition' })
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateShiftDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<ShiftsService['create']>>>> {
    return { data: await this.shiftsService.create(companyId, dto) };
  }

  @Patch(':shiftId')
  @RequirePermission('settings', 'edit')
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
    @Body() dto: UpdateShiftDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<ShiftsService['update']>>>> {
    return { data: await this.shiftsService.update(companyId, shiftId, dto) };
  }

  @Delete(':shiftId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('settings', 'delete')
  async remove(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('shiftId', ParseUUIDPipe) shiftId: string,
  ): Promise<void> {
    await this.shiftsService.remove(companyId, shiftId);
  }
}
