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
  CreateRosterDto,
  ListRostersQueryDto,
  UpdateRosterDto,
} from './dto/rosters.dto';
import { RostersService } from './rosters.service';

@ApiTags('rosters')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/rosters')
export class RostersController {
  constructor(private readonly rostersService: RostersService) {}

  @Get()
  @RequirePermission('attendance', 'view')
  @ApiOperation({
    summary: 'List roster assignments (employee → shift → date → location)',
  })
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListRostersQueryDto,
  ) {
    const result = await this.rostersService.list(companyId, query);
    return { data: result.data, meta: { total: result.total } };
  }

  @Get(':rosterId')
  @RequirePermission('attendance', 'view')
  async get(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('rosterId', ParseUUIDPipe) rosterId: string,
  ): Promise<ApiEnvelope<Awaited<ReturnType<RostersService['get']>>>> {
    return { data: await this.rostersService.get(companyId, rosterId) };
  }

  @Post()
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Assign an employee to a shift on a date' })
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateRosterDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<RostersService['create']>>>> {
    return { data: await this.rostersService.create(companyId, dto) };
  }

  @Patch(':rosterId')
  @RequirePermission('attendance', 'edit')
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('rosterId', ParseUUIDPipe) rosterId: string,
    @Body() dto: UpdateRosterDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<RostersService['update']>>>> {
    return { data: await this.rostersService.update(companyId, rosterId, dto) };
  }

  @Delete(':rosterId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('attendance', 'delete')
  async remove(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('rosterId', ParseUUIDPipe) rosterId: string,
  ): Promise<void> {
    await this.rostersService.remove(companyId, rosterId);
  }
}
