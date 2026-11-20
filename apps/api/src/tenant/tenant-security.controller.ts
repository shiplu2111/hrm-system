import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  ApproveSupportAccessRequestDto,
  RejectSupportAccessRequestDto,
  RevokeSupportAccessRequestDto,
  UpdateSupportAccessPreauthorizationDto,
} from './dto/tenant-security.dto';
import { TenantSecurityService } from './tenant-security.service';

@ApiTags('Tenant Security & Support Access')
@ApiBearerAuth('access-token')
@Controller('tenant/security/support-access')
export class TenantSecurityController {
  constructor(private readonly securityService: TenantSecurityService) {}

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({
    summary: 'Get support access settings and requests for current workspace',
  })
  async getSettings(@CurrentUser() user: AuthenticatedUser) {
    if (!user.tenantId) {
      throw new UnauthorizedException({
        code: 'TENANT_REQUIRED',
        message: 'Tenant context required',
      });
    }
    const data = await this.securityService.getSecuritySettings(user.tenantId);
    return { data };
  }

  @Put('preauthorize')
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary:
      'Enable or disable pre-authorised support access for platform engineers',
  })
  async updatePreauthorization(
    @Body() dto: UpdateSupportAccessPreauthorizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.tenantId) {
      throw new UnauthorizedException({
        code: 'TENANT_REQUIRED',
        message: 'Tenant context required',
      });
    }
    const data = await this.securityService.updatePreauthorization(
      user.tenantId,
      dto.preauthorized,
      user,
    );
    return { data };
  }

  @Post('requests/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary:
      'Company Owner approves platform staff support access request',
  })
  async approveRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: ApproveSupportAccessRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.tenantId) {
      throw new UnauthorizedException({
        code: 'TENANT_REQUIRED',
        message: 'Tenant context required',
      });
    }
    const data = await this.securityService.approveRequest(
      user.tenantId,
      requestId,
      dto,
      user,
    );
    return { data };
  }

  @Post('requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary:
      'Company Owner rejects platform staff support access request',
  })
  async rejectRequest(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: RejectSupportAccessRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.tenantId) {
      throw new UnauthorizedException({
        code: 'TENANT_REQUIRED',
        message: 'Tenant context required',
      });
    }
    const data = await this.securityService.rejectRequest(
      user.tenantId,
      requestId,
      dto,
      user,
    );
    return { data };
  }

  @Post('requests/:requestId/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary: 'Company Owner revokes an active support session immediately',
  })
  async revokeSession(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: RevokeSupportAccessRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!user.tenantId) {
      throw new UnauthorizedException({
        code: 'TENANT_REQUIRED',
        message: 'Tenant context required',
      });
    }
    const data = await this.securityService.revokeActiveSession(
      user.tenantId,
      requestId,
      dto,
      user,
    );
    return { data };
  }
}
