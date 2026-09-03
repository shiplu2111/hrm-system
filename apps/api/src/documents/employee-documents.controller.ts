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
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  CreateEmployeeDocumentDto,
  UpdateEmployeeDocumentDto,
} from './dto/documents.dto';
import { EmployeeDocumentsService } from './employee-documents.service';

@ApiTags('employee-documents')
@ApiBearerAuth('access-token')
@Controller('employees/:employeeId/documents')
export class EmployeeDocumentsController {
  constructor(
    private readonly employeeDocumentsService: EmployeeDocumentsService,
  ) {}

  @Get()
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'List employee documents' })
  async list(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return {
      data: await this.employeeDocumentsService.listDocuments(employeeId),
    };
  }

  @Get(':documentId')
  @RequirePermission('employee', 'view')
  async getOne(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return {
      data: await this.employeeDocumentsService.getDocument(
        employeeId,
        documentId,
      ),
    };
  }

  @Post()
  @RequirePermission('employee', 'create')
  async create(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateEmployeeDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return {
      data: await this.employeeDocumentsService.createDocument(
        employeeId,
        dto,
        user,
        { ipAddress: req.ip, device: req.headers['user-agent'] },
      ),
    };
  }

  @Patch(':documentId')
  @RequirePermission('employee', 'edit')
  async update(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: UpdateEmployeeDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return {
      data: await this.employeeDocumentsService.updateDocument(
        employeeId,
        documentId,
        dto,
        user,
        { ipAddress: req.ip, device: req.headers['user-agent'] },
      ),
    };
  }

  @Post(':documentId/verify')
  @RequirePermission('employee', 'approve')
  @ApiOperation({ summary: 'Verify an employee document' })
  async verify(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return {
      data: await this.employeeDocumentsService.verifyDocument(
        employeeId,
        documentId,
        user,
        { ipAddress: req.ip, device: req.headers['user-agent'] },
      ),
    };
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('employee', 'delete')
  async remove(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<void> {
    await this.employeeDocumentsService.deleteDocument(
      employeeId,
      documentId,
      user,
      { ipAddress: req.ip, device: req.headers['user-agent'] },
    );
  }
}
