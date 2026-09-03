import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CustomFieldEntityType } from '@prisma/client';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import {
  CreateCustomFieldDto,
  UpdateCustomFieldDto,
} from '../documents/dto/documents.dto';

@ApiTags('custom-fields')
@ApiBearerAuth('access-token')
@Controller('organization/companies/:companyId/custom-fields')
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'List custom field definitions for a company' })
  @ApiQuery({ name: 'entityType', required: false, enum: CustomFieldEntityType })
  @ApiQuery({ name: 'contextId', required: false })
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('entityType') entityType?: CustomFieldEntityType,
    @Query('contextId') contextId?: string,
  ) {
    return {
      data: await this.customFieldsService.listFields(
        companyId,
        entityType,
        contextId ?? undefined,
      ),
    };
  }

  @Post()
  @RequirePermission('settings', 'create')
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCustomFieldDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return {
      data: await this.customFieldsService.createField(companyId, dto, user, {
        ipAddress: req.ip,
        device: req.headers['user-agent'],
      }),
    };
  }

  @Patch(':id')
  @RequirePermission('settings', 'edit')
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomFieldDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return {
      data: await this.customFieldsService.updateField(
        companyId,
        id,
        dto,
        user,
        { ipAddress: req.ip, device: req.headers['user-agent'] },
      ),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('settings', 'delete')
  async remove(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.customFieldsService.deleteField(companyId, id, user, {
      ipAddress: req.ip,
      device: req.headers['user-agent'],
    });
  }
}
