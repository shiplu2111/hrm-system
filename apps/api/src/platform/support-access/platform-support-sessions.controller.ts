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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { RequirePlatformPermission } from '../auth/decorators/require-platform-permission.decorator';
import { PlatformAuthGuard } from '../auth/guards/platform-auth.guard';
import { PlatformPermissionsGuard } from '../auth/guards/platform-permissions.guard';
import { RevokeSupportAccessSessionDto } from './dto/platform-support-access.dto';
import { QuerySupportSessionsDto } from './dto/platform-support-sessions.dto';
import { PlatformSupportAccessService } from './platform-support-access.service';

@ApiTags('Platform Support Access Sessions')
@ApiBearerAuth('platform-access-token')
@SkipTenantScope()
@UseGuards(PlatformAuthGuard, PlatformPermissionsGuard)
@Controller('platform/support-access')
export class PlatformSupportSessionsController {
  constructor(
    private readonly supportAccessService: PlatformSupportAccessService,
  ) {}

  @Get('sessions')
  @RequirePlatformPermission('tenant', 'view')
  @ApiOperation({
    summary: 'List cross-tenant support access sessions with audit counts',
  })
  async listAllSessions(@Query() query: QuerySupportSessionsDto) {
    const data = await this.supportAccessService.listAllSessions(query);
    return { data };
  }

  @Get('stats')
  @RequirePlatformPermission('tenant', 'view')
  @ApiOperation({
    summary: 'Aggregate metrics and operational statistics for support access',
  })
  async getStats() {
    const data = await this.supportAccessService.getSupportStats();
    return { data };
  }

  @Post('sessions/:requestId/token')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('tenant', 'view')
  @ApiOperation({
    summary: 'Issue cryptographically signed impersonation token from log view',
  })
  async issueToken(
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

  @Post('sessions/:requestId/revoke')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermission('tenant', 'view')
  @ApiOperation({
    summary: 'Terminate active support session immediately from log view',
  })
  async revokeSession(
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
