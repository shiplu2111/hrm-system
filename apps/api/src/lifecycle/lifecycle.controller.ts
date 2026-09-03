import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { LifecycleEventType } from '@prisma/client';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CreateLifecycleEventDto } from './dto/lifecycle.dto';
import { LifecycleService } from './lifecycle.service';

@ApiTags('employee-lifecycle')
@ApiBearerAuth('access-token')
@Controller('employees/:employeeId/lifecycle-events')
export class LifecycleController {
  constructor(private readonly lifecycleService: LifecycleService) {}

  @Get()
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'List lifecycle events for an employee' })
  @ApiQuery({ name: 'eventType', required: false, enum: LifecycleEventType })
  async listEvents(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('eventType') eventType?: LifecycleEventType,
  ): Promise<ApiEnvelope<Awaited<ReturnType<LifecycleService['listEvents']>>>> {
    return {
      data: await this.lifecycleService.listEvents(employeeId, eventType),
    };
  }

  @Get(':eventId')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'Get a lifecycle event by ID' })
  async getEvent(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<ApiEnvelope<Awaited<ReturnType<LifecycleService['getEvent']>>>> {
    return { data: await this.lifecycleService.getEvent(eventId) };
  }

  @Post()
  @RequirePermission('employee', 'edit')
  @ApiOperation({
    summary:
      'Record a lifecycle event (promotion, transfer, confirmation, etc.)',
  })
  async createEvent(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateLifecycleEventDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<ApiEnvelope<Awaited<ReturnType<LifecycleService['createEvent']>>>> {
    return {
      data: await this.lifecycleService.createEvent(employeeId, dto, user, {
        ipAddress: req.ip,
        device: req.headers['user-agent'],
      }),
    };
  }
}
