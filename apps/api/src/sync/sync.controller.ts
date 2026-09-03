import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  AttendanceSyncService,
  type AttendanceSyncItemResult,
} from './attendance-sync.service';
import { AttendanceSyncBatchDto } from './dto/attendance-sync.dto';

@ApiTags('sync')
@ApiBearerAuth('access-token')
@Controller('sync')
export class AttendanceSyncController {
  constructor(private readonly attendanceSyncService: AttendanceSyncService) {}

  @Post('attendance')
  @RequirePermission('attendance', 'create')
  @ApiOperation({
    summary: 'Batch sync offline attendance events (OFFLINE_SYNC.md §4)',
  })
  async syncAttendance(
    @Body() dto: AttendanceSyncBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<{ results: AttendanceSyncItemResult[] }>> {
    return {
      data: {
        results: await this.attendanceSyncService.syncBatch(
          dto.deviceId,
          dto.events,
          user,
        ),
      },
    };
  }
}
