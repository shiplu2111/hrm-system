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
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DataScopeService } from '../rbac/data-scope.service';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  BulkAssignRosterDto,
  BulkClearRosterDto,
  CreateRosterDto,
  ListRostersQueryDto,
  UpdateRosterDto,
} from './dto/rosters.dto';
import { RostersService } from './rosters.service';

@ApiTags('rosters')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/rosters')
export class RostersController {
  constructor(
    private readonly rostersService: RostersService,
    private readonly dataScope: DataScopeService,
  ) {}

  @Get()
  @RequirePermission('attendance', 'view')
  @ApiOperation({
    summary: 'List roster assignments (employee → shift → date → location)',
  })
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListRostersQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (query.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, query.employeeId);
    }
    const result = await this.rostersService.list(
      companyId,
      query,
      await this.dataScope.employeeIdFilter(user),
    );
    return { data: result.data, meta: { total: result.total } };
  }

  @Get('locations')
  @RequirePermission('attendance', 'view')
  @ApiOperation({ summary: 'Locations available for roster assignment' })
  async listLocations(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<ApiEnvelope<Awaited<ReturnType<RostersService['listLocations']>>>> {
    return { data: await this.rostersService.listLocations(companyId) };
  }

  @Post('bulk')
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Assign a shift to many employees across many dates' })
  async bulkAssign(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: BulkAssignRosterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<RostersService['bulkAssign']>>>> {
    return { data: await this.rostersService.bulkAssign(companyId, dto, user) };
  }

  @Post('bulk-clear')
  @RequirePermission('attendance', 'delete')
  @ApiOperation({ summary: 'Remove roster entries for many employees across many dates' })
  async bulkClear(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: BulkClearRosterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<RostersService['bulkClear']>>>> {
    return { data: await this.rostersService.bulkClear(companyId, dto, user) };
  }

  @Get(':rosterId')
  @RequirePermission('attendance', 'view')
  async get(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('rosterId', ParseUUIDPipe) rosterId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<RostersService['get']>>>> {
    return { data: await this.rostersService.get(companyId, rosterId, user) };
  }

  @Post()
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Assign an employee to a shift on a date' })
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateRosterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<RostersService['create']>>>> {
    return { data: await this.rostersService.create(companyId, dto, user) };
  }

  @Patch(':rosterId')
  @RequirePermission('attendance', 'edit')
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('rosterId', ParseUUIDPipe) rosterId: string,
    @Body() dto: UpdateRosterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<RostersService['update']>>>> {
    return { data: await this.rostersService.update(companyId, rosterId, dto, user) };
  }

  @Delete(':rosterId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('attendance', 'delete')
  async remove(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('rosterId', ParseUUIDPipe) rosterId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.rostersService.remove(companyId, rosterId, user);
  }
}
