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
import { AttendanceService } from './attendance.service';
import {
  AttendanceCaptureDto,
  AttendanceDateQueryDto,
  CorrectAttendanceDto,
} from './dto/attendance.dto';

@ApiTags('attendance')
@ApiBearerAuth('access-token')
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
}

