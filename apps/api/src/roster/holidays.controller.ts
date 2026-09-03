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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreateHolidayDto,
  ListHolidaysQueryDto,
  ResolveHolidayCalendarQueryDto,
  UpdateHolidayDto,
} from './dto/holidays.dto';
import { HolidaysService } from './holidays.service';

@ApiTags('holidays')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get('calendar')
  @RequirePermission('settings', 'view')
  @ApiOperation({
    summary:
      'Resolved holiday calendar merging country, state, company, branch, and employee levels',
  })
  async resolveCalendar(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ResolveHolidayCalendarQueryDto,
  ): Promise<
    ApiEnvelope<Awaited<ReturnType<HolidaysService['resolveCalendar']>>>
  > {
    return { data: await this.holidaysService.resolveCalendar(companyId, query) };
  }

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({
    summary: 'List tenant-managed holidays (company, branch, employee scopes)',
  })
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListHolidaysQueryDto,
  ) {
    const result = await this.holidaysService.list(companyId, query);
    return { data: result.data, meta: { total: result.total } };
  }

  @Post()
  @RequirePermission('settings', 'create')
  @ApiOperation({ summary: 'Create a company, branch, or employee holiday' })
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateHolidayDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<HolidaysService['create']>>>> {
    return { data: await this.holidaysService.create(companyId, dto) };
  }

  @Patch(':holidayId')
  @RequirePermission('settings', 'edit')
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('holidayId', ParseUUIDPipe) holidayId: string,
    @Body() dto: UpdateHolidayDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<HolidaysService['update']>>>> {
    return { data: await this.holidaysService.update(companyId, holidayId, dto) };
  }

  @Delete(':holidayId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('settings', 'delete')
  async remove(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('holidayId', ParseUUIDPipe) holidayId: string,
  ): Promise<void> {
    await this.holidaysService.remove(companyId, holidayId);
  }
}
