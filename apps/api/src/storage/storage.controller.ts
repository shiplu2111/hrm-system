import {
  Controller,
  Get,
  NotFoundException,
  Query,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { getTenantIdFromSession } from '../tenant/tenant.context';
import { StorageService } from './storage.service';

/**
 * Authenticated local-disk file delivery (FILE_STORAGE.md §5).
 * S3 deployments use presigned URLs instead and do not hit this route.
 */
@ApiTags('storage')
@ApiBearerAuth('access-token')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Get('files')
  @RequirePermission('employee', 'view')
  @ApiOperation({
    summary: 'Download a stored file (local driver)',
    description:
      'Serves objects from the local disk driver after RBAC checks. Keys must belong to the current tenant.',
  })
  async downloadFile(
    @Query('key') key: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!key?.trim()) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'File not found',
      });
    }

    const tenantId = getTenantIdFromSession();
    if (tenantId && !key.startsWith(`${tenantId}/`)) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'File not found',
      });
    }

    const exists = await this.storageService.exists(key);
    if (!exists) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'File not found',
      });
    }

    const { buffer, meta } = await this.storageService.read(key);
    res.setHeader(
      'Content-Type',
      meta.contentType ?? 'application/octet-stream',
    );
    if (meta.originalName) {
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${meta.originalName.replace(/"/g, '')}"`,
      );
    }
    res.send(buffer);
  }
}
