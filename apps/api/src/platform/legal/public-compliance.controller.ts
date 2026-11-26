import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type {
  ApiResponse as ApiEnvelope,
  PublicDpaMetadataResponse,
  PublicSubprocessorsResponse,
} from '@hrm/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PublicComplianceService } from './public-compliance.service';

@ApiTags('public-legal')
@SkipTenantScope()
@Public()
@Throttle({ default: { limit: 60, ttl: 60000 } })
@Controller('public/legal')
export class PublicComplianceController {
  constructor(private readonly complianceService: PublicComplianceService) {}

  @Get('dpa')
  @ApiOperation({
    summary: 'Get Data Processing Agreement metadata and FileStorage PDF download URL',
  })
  @ApiResponse({ status: 200, description: 'DPA document metadata' })
  async getDpaMetadata(): Promise<ApiEnvelope<PublicDpaMetadataResponse>> {
    const data = await this.complianceService.getDpaMetadata();
    return { data };
  }

  @Get('dpa/pdf')
  @ApiOperation({
    summary: 'Download Data Processing Agreement (DPA) PDF stored via the FileStorage driver',
  })
  @ApiResponse({ status: 200, description: 'PDF binary stream' })
  async downloadDpaPdf(@Res() res: Response): Promise<void> {
    const file = await this.complianceService.getDpaPdfFile();
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Content-Length', String(file.buffer.byteLength));
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(file.buffer);
  }

  @Get('subprocessors')
  @ApiOperation({
    summary: 'List active third-party subprocessors derived dynamically from platform settings',
  })
  @ApiResponse({ status: 200, description: 'Active subprocessors list and last updated date' })
  async getSubprocessors(): Promise<ApiEnvelope<PublicSubprocessorsResponse>> {
    const data = await this.complianceService.getSubprocessorsOverview();
    return { data };
  }
}
