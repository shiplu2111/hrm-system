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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreateDocumentTypeDto,
  DocumentTypeFieldDto,
  UpdateDocumentTypeDto,
} from './dto/documents.dto';
import { DocumentTypesService } from './document-types.service';

@ApiTags('document-types')
@ApiBearerAuth('access-token')
@Controller('organization/companies/:companyId/document-types')
export class DocumentTypesController {
  constructor(private readonly documentTypesService: DocumentTypesService) {}

  @Get()
  @RequirePermission('settings', 'view')
  @ApiOperation({ summary: 'List admin-defined document types with field schemas' })
  async list(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return { data: await this.documentTypesService.listDocumentTypes(companyId) };
  }

  @Get(':id')
  @RequirePermission('settings', 'view')
  async getOne(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return {
      data: await this.documentTypesService.getDocumentType(companyId, id),
    };
  }

  @Post()
  @RequirePermission('settings', 'create')
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateDocumentTypeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return {
      data: await this.documentTypesService.createDocumentType(
        companyId,
        dto,
        user,
        { ipAddress: req.ip, device: req.headers['user-agent'] },
      ),
    };
  }

  @Patch(':id')
  @RequirePermission('settings', 'edit')
  async update(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDocumentTypeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return {
      data: await this.documentTypesService.updateDocumentType(
        companyId,
        id,
        dto,
        user,
        { ipAddress: req.ip, device: req.headers['user-agent'] },
      ),
    };
  }

  @Put(':id/fields')
  @RequirePermission('settings', 'edit')
  @ApiOperation({ summary: 'Replace configurable fields on a document type' })
  async replaceFields(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() fields: DocumentTypeFieldDto[],
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return {
      data: await this.documentTypesService.replaceDocumentTypeFields(
        companyId,
        id,
        fields,
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
    await this.documentTypesService.deleteDocumentType(companyId, id, user, {
      ipAddress: req.ip,
      device: req.headers['user-agent'],
    });
  }
}
