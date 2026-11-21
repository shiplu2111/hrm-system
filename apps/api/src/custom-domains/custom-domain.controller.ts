import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CustomDomainService } from './custom-domain.service';
import { CustomDomainQueueService } from './custom-domain-queue.service';
import { CreateCustomDomainDto } from './dto/custom-domain.dto';
import type {
  ApiResponse as ApiEnvelope,
  CustomDomainView,
  VerifyCustomDomainResult,
} from '@hrm/shared-types';

@ApiTags('Custom Domains')
@ApiBearerAuth('access-token')
@Controller('custom-domains')
export class CustomDomainController {
  constructor(
    private readonly domainService: CustomDomainService,
    private readonly queueService: CustomDomainQueueService,
  ) {}

  @Post()
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary: 'Add a custom domain (MODULES.md §01)',
    description:
      'Registers a custom domain for the organization and returns the required DNS records (CNAME, TXT) to configure.',
  })
  @ApiResponse({ status: 201, description: 'Domain registered; DNS instructions returned' })
  async createCustomDomain(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCustomDomainDto,
    @Req() req: Request,
  ): Promise<ApiEnvelope<CustomDomainView>> {
    const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
    const domain = await this.domainService.createCustomDomain(
      user.tenantId!,
      dto,
      user.id,
      meta,
    );

    // Enqueue verification job
    await this.queueService.enqueueDomainVerification(user.tenantId!, domain.id);

    return { data: domain };
  }

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({
    summary: 'List custom domains for the current organization',
  })
  async listCustomDomains(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApiEnvelope<CustomDomainView[]>> {
    const domains = await this.domainService.listCustomDomains(user.tenantId!);
    return { data: domains };
  }

  @Get(':id')
  @RequirePermission('settings', 'view')
  @ApiOperation({
    summary: 'Get custom domain details and DNS verification status',
  })
  async getCustomDomain(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiEnvelope<CustomDomainView>> {
    const domain = await this.domainService.getCustomDomain(user.tenantId!, id);
    return { data: domain };
  }

  @Post(':id/verify')
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary: 'Trigger DNS check and TLS certificate provisioning',
    description:
      'Checks if TXT and CNAME records exist. Upon verification, immediately provisions automated TLS certificate.',
  })
  async verifyCustomDomain(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ApiEnvelope<VerifyCustomDomainResult>> {
    const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
    const result = await this.domainService.verifyCustomDomain(
      user.tenantId!,
      id,
      user.id,
      meta,
    );
    return { data: result };
  }

  @Delete(':id')
  @RequirePermission('settings', 'edit')
  @ApiOperation({
    summary: 'Remove custom domain and deprovision TLS certificate',
  })
  async deleteCustomDomain(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<ApiEnvelope<{ deleted: boolean }>> {
    const meta = { ipAddress: req.ip, userAgent: req.headers['user-agent'] };
    await this.domainService.deleteCustomDomain(user.tenantId!, id, user.id, meta);
    return { data: { deleted: true } };
  }
}
