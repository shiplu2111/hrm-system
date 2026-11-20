import {
  Body,
  Controller,
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
  ProfileUpdateRequestRecord,
} from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission, SelfService } from '../rbac/require-permission.decorator';
import {
  DecideProfileUpdateRequestDto,
  ListProfileUpdateRequestsQueryDto,
} from './dto/self-profile.dto';
import { ProfileUpdateRequestsService } from './profile-update-requests.service';

@ApiTags('profile-update-requests')
@ApiBearerAuth('access-token')
@Controller()
export class ProfileUpdateRequestsController {
  constructor(
    private readonly service: ProfileUpdateRequestsService,
  ) {}

  @Get('companies/:companyId/profile-update-requests')
  @RequirePermission('employee', 'edit')
  @ApiOperation({ summary: 'List employee profile update requests for HR review' })
  async listCompanyProfileUpdateRequests(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListProfileUpdateRequestsQueryDto,
  ): Promise<ApiEnvelope<ProfileUpdateRequestRecord[]>> {
    return {
      data: await this.service.listForCompany(companyId, query.status),
    };
  }

  @SelfService()
  @Post('profile-update-requests/:requestId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employee', 'edit')
  @ApiOperation({ summary: 'Cancel own pending profile update request' })
  async cancelProfileUpdateRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<ProfileUpdateRequestRecord>> {
    return { data: await this.service.cancelRequest(requestId, user) };
  }

  @Post('profile-update-requests/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employee', 'edit')
  @ApiOperation({ summary: 'Approve a pending profile update request (HR Admin)' })
  async approveProfileUpdateRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: DecideProfileUpdateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<ProfileUpdateRequestRecord>> {
    return { data: await this.service.approveRequest(requestId, dto, user) };
  }

  @Post('profile-update-requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('employee', 'edit')
  @ApiOperation({ summary: 'Reject a pending profile update request (HR Admin)' })
  async rejectProfileUpdateRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: DecideProfileUpdateRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<ProfileUpdateRequestRecord>> {
    return { data: await this.service.rejectRequest(requestId, dto, user) };
  }
}

