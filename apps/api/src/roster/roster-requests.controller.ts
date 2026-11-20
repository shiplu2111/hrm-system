import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  ApiResponse as ApiEnvelope,
  OvertimeRequestRecord,
  ShiftSwapRequestRecord,
  WorkflowApprovalRoute,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { DataScopeService } from '../rbac/data-scope.service';
import { RequirePermission, SelfService } from '../rbac/require-permission.decorator';
import { RequireFeature } from '../billing/require-enterprise-feature.decorator';
import {
  CreateOvertimeRequestDto,
  CreateShiftSwapRequestDto,
  DecideEssRequestDto,
  ListEssRequestsQueryDto,
} from './dto/ess-requests.dto';
import { RosterRequestsService } from './roster-requests.service';

@ApiTags('roster-requests')
@ApiBearerAuth('access-token')
@RequireFeature('roster')
@Controller()
export class RosterRequestsController {
  constructor(
    private readonly service: RosterRequestsService,
    private readonly dataScope: DataScopeService,
  ) {}

  // -------------------------------------------------------------------------
  // Shift Swap Requests (MODULES.md §12, §24, §35)
  // -------------------------------------------------------------------------

  @SelfService()
  @Get('companies/:companyId/shift-swap-requests/approval-route')
  @RequirePermission('attendance', 'view')
  @ApiOperation({ summary: 'Preview approval workflow route for shift swap requests' })
  async getShiftSwapApprovalRoute(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<ApiEnvelope<WorkflowApprovalRoute>> {
    return {
      data: await this.service.resolveDefaultRoute(companyId, 'shift_swap_request'),
    };
  }

  @SelfService()
  @Get('companies/:companyId/shift-swap-requests')
  @RequirePermission('attendance', 'view')
  @ApiOperation({ summary: 'List shift swap requests (scoped by role data scope)' })
  async listShiftSwaps(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListEssRequestsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<ShiftSwapRequestRecord[]>> {
    if (query.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, query.employeeId);
    }
    return {
      data: await this.service.listShiftSwaps(
        companyId,
        query,
        await this.dataScope.employeeIdFilter(user),
      ),
    };
  }

  @SelfService()
  @Post('employees/:employeeId/shift-swap-requests')
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Submit a shift swap proposal to workflow approval' })
  async createShiftSwap(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateShiftSwapRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<ShiftSwapRequestRecord>> {
    if (!user.employeeId || user.employeeId !== employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You can only submit shift swap requests for your own record',
      });
    }
    return { data: await this.service.createShiftSwap(employeeId, dto, user) };
  }

  @SelfService()
  @Post('shift-swap-requests/:requestId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Cancel own pending shift swap request' })
  async cancelShiftSwap(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<ShiftSwapRequestRecord>> {
    return { data: await this.service.cancelShiftSwap(requestId, user) };
  }

  @Post('shift-swap-requests/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('attendance', 'approve')
  @ApiOperation({ summary: 'Approve a shift swap workflow step' })
  async approveShiftSwap(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: DecideEssRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<ShiftSwapRequestRecord>> {
    return { data: await this.service.approveShiftSwap(requestId, dto, user) };
  }

  @Post('shift-swap-requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('attendance', 'approve')
  @ApiOperation({ summary: 'Reject a shift swap workflow step' })
  async rejectShiftSwap(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: DecideEssRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<ShiftSwapRequestRecord>> {
    return { data: await this.service.rejectShiftSwap(requestId, dto, user) };
  }

  // -------------------------------------------------------------------------
  // Overtime Requests (MODULES.md §15, §24, §35)
  // -------------------------------------------------------------------------

  @SelfService()
  @Get('companies/:companyId/overtime-requests/approval-route')
  @RequirePermission('attendance', 'view')
  @ApiOperation({ summary: 'Preview approval workflow route for overtime requests' })
  async getOvertimeApprovalRoute(
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ): Promise<ApiEnvelope<WorkflowApprovalRoute>> {
    return {
      data: await this.service.resolveDefaultRoute(companyId, 'overtime_request'),
    };
  }

  @SelfService()
  @Get('companies/:companyId/overtime-requests')
  @RequirePermission('attendance', 'view')
  @ApiOperation({ summary: 'List overtime requests (scoped by role data scope)' })
  async listOvertimeRequests(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListEssRequestsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<OvertimeRequestRecord[]>> {
    if (query.employeeId) {
      await this.dataScope.assertEmployeeInScope(user, query.employeeId);
    }
    return {
      data: await this.service.listOvertimeRequests(
        companyId,
        query,
        await this.dataScope.employeeIdFilter(user),
      ),
    };
  }

  @SelfService()
  @Post('employees/:employeeId/overtime-requests')
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Submit an overtime request to workflow approval' })
  async createOvertimeRequest(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateOvertimeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<OvertimeRequestRecord>> {
    if (!user.employeeId || user.employeeId !== employeeId) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'You can only submit overtime requests for your own record',
      });
    }
    return { data: await this.service.createOvertimeRequest(employeeId, dto, user) };
  }

  @SelfService()
  @Post('overtime-requests/:requestId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Cancel own pending overtime request' })
  async cancelOvertimeRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<OvertimeRequestRecord>> {
    return { data: await this.service.cancelOvertimeRequest(requestId, user) };
  }

  @Post('overtime-requests/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('attendance', 'approve')
  @ApiOperation({ summary: 'Approve an overtime request workflow step' })
  async approveOvertimeRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: DecideEssRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<OvertimeRequestRecord>> {
    return { data: await this.service.approveOvertimeRequest(requestId, dto, user) };
  }

  @Post('overtime-requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('attendance', 'approve')
  @ApiOperation({ summary: 'Reject an overtime request workflow step' })
  async rejectOvertimeRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: DecideEssRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<OvertimeRequestRecord>> {
    return { data: await this.service.rejectOvertimeRequest(requestId, dto, user) };
  }
}

