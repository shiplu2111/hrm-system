import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { AttendanceService } from './attendance.service';
import { AttendanceCaptureDto, AttendanceDateQueryDto } from './dto/attendance.dto';

@ApiTags('attendance')
@ApiBearerAuth('access-token')
@Controller('employees/:employeeId/attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('today')
  @RequirePermission('attendance', 'view')
  @ApiOperation({ summary: 'Get attendance record and metrics for a date' })
  async getToday(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query() query: AttendanceDateQueryDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['getDayRecord']>>>> {
    return {
      data: await this.attendanceService.getDayRecord(employeeId, query.date),
    };
  }

  @Post('clock-in')
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Clock in (start working)' })
  async clockIn(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: AttendanceCaptureDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['clockIn']>>>> {
    return { data: await this.attendanceService.clockIn(employeeId, dto) };
  }

  @Post('clock-out')
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Clock out (end working)' })
  async clockOut(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: AttendanceCaptureDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['clockOut']>>>> {
    return { data: await this.attendanceService.clockOut(employeeId, dto) };
  }

  @Post('break-start')
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'Start a break' })
  async breakStart(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: AttendanceCaptureDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['breakStart']>>>> {
    return { data: await this.attendanceService.breakStart(employeeId, dto) };
  }

  @Post('break-end')
  @RequirePermission('attendance', 'create')
  @ApiOperation({ summary: 'End the active break' })
  async breakEnd(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: AttendanceCaptureDto,
  ): Promise<ApiEnvelope<Awaited<ReturnType<AttendanceService['breakEnd']>>>> {
    return { data: await this.attendanceService.breakEnd(employeeId, dto) };
  }
}
