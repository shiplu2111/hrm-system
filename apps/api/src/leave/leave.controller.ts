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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  AccrueLeaveQueryDto,
  CreateLeavePolicyDto,
  CreateLeaveRequestDto,
  CreateLeaveTypeDto,
  LeaveApprovalActionDto,
  ListLeaveRequestsQueryDto,
  RunYearEndDto,
  UpdateLeavePolicyDto,
  UpdateLeaveTypeDto,
} from './dto/leave.dto';
import { LeaveBalancesService } from './leave-balances.service';
import { LeavePoliciesService } from './leave-policies.service';
import { LeaveRequestsService } from './leave-requests.service';
import { LeaveTypesService } from './leave-types.service';

@ApiTags('leave-types')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/leave-types')
export class LeaveTypesController {
  constructor(private readonly leaveTypesService: LeaveTypesService) {}

  @Get()
  @RequirePermission('leave', 'view')
  async list(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.leaveTypesService.list(companyId) };
  }

  @Post()
  @RequirePermission('settings', 'create')
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateLeaveTypeDto,
  ) {
    return { data: await this.leaveTypesService.create(companyId, dto) };
  }

  @Patch(':leaveTypeId')
  @RequirePermission('settings', 'edit')
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('leaveTypeId', ParseUUIDPipe) leaveTypeId: string,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    return { data: await this.leaveTypesService.update(companyId, leaveTypeId, dto) };
  }

  @Delete(':leaveTypeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('settings', 'delete')
  async remove(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('leaveTypeId', ParseUUIDPipe) leaveTypeId: string,
  ): Promise<void> {
    await this.leaveTypesService.remove(companyId, leaveTypeId);
  }
}

@ApiTags('leave-policies')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/leave-policies')
export class LeavePoliciesController {
  constructor(private readonly leavePoliciesService: LeavePoliciesService) {}

  @Get()
  @RequirePermission('leave', 'view')
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('leaveTypeId') leaveTypeId?: string,
  ) {
    return { data: await this.leavePoliciesService.list(companyId, leaveTypeId) };
  }

  @Post()
  @RequirePermission('settings', 'create')
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateLeavePolicyDto,
  ) {
    return { data: await this.leavePoliciesService.create(companyId, dto) };
  }

  @Patch(':policyId')
  @RequirePermission('settings', 'edit')
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('policyId', ParseUUIDPipe) policyId: string,
    @Body() dto: UpdateLeavePolicyDto,
  ) {
    return { data: await this.leavePoliciesService.update(companyId, policyId, dto) };
  }
}

@ApiTags('leave-balances')
@ApiBearerAuth('access-token')
@Controller()
export class LeaveBalancesController {
  constructor(private readonly leaveBalancesService: LeaveBalancesService) {}

  @Get('employees/:employeeId/leave-balances')
  @RequirePermission('leave', 'view')
  @ApiOperation({ summary: 'Leave balances with accrual applied as of today' })
  async listForEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: AccrueLeaveQueryDto,
  ) {
    return {
      data: await this.leaveBalancesService.listForEmployee(employeeId, query.asOf),
    };
  }

  @Post('employees/:employeeId/leave-balances/accrue')
  @RequirePermission('leave', 'edit')
  async accrueEmployee(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: AccrueLeaveQueryDto,
  ) {
    return {
      data: await this.leaveBalancesService.accrueEmployee(employeeId, query.asOf),
    };
  }

  @Post('companies/:companyId/leave-balances/year-end')
  @RequirePermission('settings', 'edit')
  async runYearEnd(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: RunYearEndDto,
  ) {
    return {
      data: await this.leaveBalancesService.runYearEnd(companyId, dto.leaveYear),
    };
  }
}

@ApiTags('leave-requests')
@ApiBearerAuth('access-token')
@Controller()
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Get('companies/:companyId/leave-requests')
  @RequirePermission('leave', 'view')
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListLeaveRequestsQueryDto,
  ) {
    const result = await this.leaveRequestsService.list(companyId, query);
    return { data: result.data, meta: { total: result.total } };
  }

  @Get('leave-requests/:requestId')
  @RequirePermission('leave', 'view')
  async get(@Param('requestId', ParseUUIDPipe) requestId: string) {
    return { data: await this.leaveRequestsService.get(requestId) };
  }

  @Post('employees/:employeeId/leave-requests')
  @RequirePermission('leave', 'create')
  async create(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateLeaveRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.leaveRequestsService.create(employeeId, dto, user) };
  }

  @Post('leave-requests/:requestId/submit')
  @RequirePermission('leave', 'create')
  async submit(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.leaveRequestsService.submit(requestId, user) };
  }

  @Post('leave-requests/:requestId/approve')
  @RequirePermission('leave', 'approve')
  async approve(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: LeaveApprovalActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.leaveRequestsService.approve(requestId, user, dto) };
  }

  @Post('leave-requests/:requestId/reject')
  @RequirePermission('leave', 'approve')
  async reject(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: LeaveApprovalActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.leaveRequestsService.reject(requestId, user, dto) };
  }

  @Post('leave-requests/:requestId/cancel')
  @RequirePermission('leave', 'create')
  async cancel(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.leaveRequestsService.cancel(requestId, user) };
  }
}
