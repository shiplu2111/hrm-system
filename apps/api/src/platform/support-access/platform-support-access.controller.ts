import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import {
  CreateSupportAccessRequestDto,
  RevokeSupportAccessSessionDto,
} from './dto/platform-support-access.dto';
import { PlatformSupportAccessService } from './platform-support-access.service';

@ApiTags('Platform Support Access')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/tenants/:tenantId/support-access')
export class PlatformSupportAccessController {
  constructor(
    private readonly supportAccessService: PlatformSupportAccessService,
  ) {}

  @Post('request')
  @RequirePlatformPermission('support', 'manage')
  @ApiOperation({
    summary: 'Request time-boxed support access grant for a tenant (max 4h)',
  })
  async requestAccess(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateSupportAccessRequestDto,
    @Req() req: any,
  ) {
    const staff = req.platformUser ?? req.user;
    const data = await this.supportAccessService.requestAccess(
      tenantId,
      dto,
      staff,
    );
    return { data };
  }

  @Get('requests')
  @RequirePlatformPermission('support', 'view')
  @ApiOperation({ summary: 'List support access requests for tenant' })
  async listRequests(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    const data = await this.supportAccessService.listRequests(tenantId);
    return { data };
  }

  @Get('active')
  @RequirePlatformPermission('support', 'view')
  @ApiOperation({ summary: 'Get currently active support session for tenant' })
  async getActiveSession(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    const data = await this.supportAccessService.getActiveSession(tenantId);
    return { data };
  }

  @Post('requests/:requestId/token')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('support', 'impersonate')
  @ApiOperation({
    summary:
      'Issue cryptographically signed impersonation token for approved support grant',
  })
  async issueToken(
    @Param('tenantId', ParseUUIDPipe) _tenantId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Req() req: any,
  ) {
    const staff = req.platformUser ?? req.user;
    const data = await this.supportAccessService.issueImpersonationToken(
      requestId,
      staff,
    );
    return { data };
  }

  @Post('requests/:requestId/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('support', 'manage')
  @ApiOperation({ summary: 'Terminate active support session early' })
  async revokeSession(
    @Param('tenantId', ParseUUIDPipe) _tenantId: string,
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: RevokeSupportAccessSessionDto,
    @Req() req: any,
  ) {
    const staff = req.platformUser ?? req.user;
    const data = await this.supportAccessService.revokeSession(
      requestId,
      dto,
      staff,
    );
    return { data };
  }
}
