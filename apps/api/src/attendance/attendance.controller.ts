import {
  Body,
  Controller,
  Get,
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
import { RequirePermission, SelfService } from '../rbac/require-permission.decorator';
import { RequireFeature } from '../billing/require-enterprise-feature.decorator';
import { AttendanceService } from './attendance.service';
import {
  AttendanceCaptureDto,
  AttendanceDateQueryDto,
  AttendanceHistoryQueryDto,
  CorrectAttendanceDto,
  ListCompanyCorrectionsQueryDto,
  ReviewAttendanceCorrectionDto,
  SubmitAttendanceCorrectionDto,
} from './dto/attendance.dto';

@ApiTags('attendance')
@ApiBearerAuth('access-token')
@RequireFeature('attendance')
@Controller('employees/:employeeId/attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly dataScope: DataScopeService,
  ) {}

  @SelfService()
  @Get('today')
  @RequirePermission('attendance', 'view')
  @ApiOperation({ summary: 'Get attendance record and metrics for a date' })
  async getToday(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: AttendanceDateQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['getDayRecord']>>>> {
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    return {
      data: await this.attendanceService.getDayRecord(employeeId, query.date),
    };
  }

  @SelfService()
  @Get('history')
  @RequirePermission('attendance', 'view')
  @ApiOperation({
    summary: 'Get attendance calendar/list history for a date range (ATTENDANCE_LOGIC.md)',
  })
  async getHistory(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: AttendanceHistoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['getEmployeeHistory']>>>> {
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    return {
      data: await this.attendanceService.getEmployeeHistory(employeeId, query),
    };
  }

  @SelfService()
  @Post('clock-in')
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Clock in (start working)' })
  async clockIn(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: AttendanceCaptureDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['clockIn']>>>> {
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    return { data: await this.attendanceService.clockIn(employeeId, dto) };
  }

  @SelfService()
  @Post('clock-out')
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Clock out (end working)' })
  async clockOut(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: AttendanceCaptureDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['clockOut']>>>> {
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    return { data: await this.attendanceService.clockOut(employeeId, dto) };
  }

  @SelfService()
  @Post('break-start')
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Start a break' })
  async breakStart(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: AttendanceCaptureDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['breakStart']>>>> {
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    return { data: await this.attendanceService.breakStart(employeeId, dto) };
  }

  @SelfService()
  @Post('break-end')
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'End the active break' })
  async breakEnd(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: AttendanceCaptureDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['breakEnd']>>>> {
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    return { data: await this.attendanceService.breakEnd(employeeId, dto) };
  }

  @Patch('correct')
  @RequirePermission('attendance', 'edit')
  @ApiOperation({ summary: 'Admin manual time correction with audit trail' })
  async correctAttendance(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CorrectAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['correctAttendance']>>>> {
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    return {
      data: await this.attendanceService.correctAttendance(employeeId, dto, user),
    };
  }

  @SelfService()
  @Get('corrections')
  @RequirePermission('attendance', 'view')
  @ApiOperation({ summary: 'Get attendance correction audit history for employee' })
  async getCorrections(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: AttendanceDateQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['getCorrections']>>>> {
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    return {
      data: await this.attendanceService.getCorrections(employeeId, query.date),
    };
  }

  @SelfService()
  @Post('corrections')
  @RequirePermission('attendance', 'create')
  @ApiOperation({
    summary: 'Submit an employee attendance correction / regularization request',
  })
  async submitCorrection(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: SubmitAttendanceCorrectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<
    ApiEnvelope<Awaited<ReturnType<AttendanceService['submitCorrectionRequest']>>>
  > {
    await this.dataScope.assertEmployeeInScope(user, employeeId);
    return {
      data: await this.attendanceService.submitCorrectionRequest(
        employeeId,
        dto,
        user,
      ),
    };
  }
}

@ApiTags('attendance')
@ApiBearerAuth('access-token')
@Controller('companies/:companyId/attendance')
export class CompanyAttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('daily')
  @RequirePermission('attendance', 'view')
  @ApiOperation({ summary: 'Get live daily attendance hub overview for company' })
  async getCompanyDaily(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: AttendanceDateQueryDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['getCompanyDailyAttendance']>>>> {
    return {
      data: await this.attendanceService.getCompanyDailyAttendance(companyId, query.date),
    };
  }

  @Get('corrections')
  @RequirePermission('attendance', 'approve', {
    orAnyOf: [{ module: 'attendance', action: 'edit' }],
  })
  @ApiOperation({ summary: 'List employee attendance correction requests for company' })
  async listCompanyCorrections(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListCompanyCorrectionsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<
    ApiEnvelope<Awaited<ReturnType<AttendanceService['listCompanyCorrections']>>>
  > {
    return {
      data: await this.attendanceService.listCompanyCorrections(
        companyId,
        query.status,
        user,
      ),
    };
  }
}

@ApiTags('attendance')
@ApiBearerAuth('access-token')
@Controller('attendance/corrections')
export class AttendanceCorrectionController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post(':correctionId/approve')
  @RequirePermission('attendance', 'approve', {
    orAnyOf: [{ module: 'attendance', action: 'edit' }],
  })
  @ApiOperation({ summary: 'Approve a pending attendance correction request' })
  async approveCorrection(
    @Param('correctionId', ParseUUIDPipe) correctionId: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['approveCorrection']>>>> {
    return {
      data: await this.attendanceService.approveCorrection(
        correctionId,
        user,
        dto.comment,
      ),
    };
  }

  @Post(':correctionId/reject')
  @RequirePermission('attendance', 'approve', {
    orAnyOf: [{ module: 'attendance', action: 'edit' }],
  })
  @ApiOperation({ summary: 'Reject a pending attendance correction request' })
  async rejectCorrection(
    @Param('correctionId', ParseUUIDPipe) correctionId: string,
    @Body() dto: ReviewAttendanceCorrectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['rejectCorrection']>>>> {
    return {
      data: await this.attendanceService.rejectCorrection(
        correctionId,
        user,
        dto.comment,
      ),
    };
  }
}
