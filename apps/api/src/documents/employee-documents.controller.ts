import {
  BadRequestException,
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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DOCUMENT_FILE_POLICY } from '../storage/document-file.policy';
import { RequirePermission, SelfService } from '../rbac/require-permission.decorator';
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

  @SelfService()
  @Get()
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'List employee documents' })
  async list(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.employeeDocumentsService.listDocuments(employeeId, user),
    };
  }

  @SelfService()
  @Get(':documentId')
  @RequirePermission('employee', 'view')
  async getOne(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.employeeDocumentsService.getDocument(
        employeeId,
        documentId,
        user,
      ),
    };
  }

  @SelfService()
  @Get(':documentId/file-url')
  @RequirePermission('employee', 'view')
  @ApiOperation({
    summary: 'Get a time-limited download URL for the document file',
  })
  async getFileUrl(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.employeeDocumentsService.getDocumentFileUrl(
        employeeId,
        documentId,
        user,
      ),
    };
  }

  @SelfService()
  @Get(':documentId/download')
  @RequirePermission('employee', 'view')
  @ApiOperation({
    summary: 'Download or stream document file via FileStorage driver (authenticated)',
  })
  async downloadFile(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, meta, filename } =
      await this.employeeDocumentsService.downloadDocumentFile(
        employeeId,
        documentId,
        user,
      );
    res.setHeader('Content-Type', meta.contentType ?? 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${filename.replace(/"/g, '')}"`,
    );
    res.send(buffer);
  }

  @SelfService()
  @Post()
  @RequirePermission('employee', 'create', {
    orAnyOf: [{ module: 'employee', action: 'edit' }],
  })
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

  @SelfService()
  @Post(':documentId/file')
  @RequirePermission('employee', 'edit')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: DOCUMENT_FILE_POLICY.maxBytes },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload or replace the document file attachment' })
  async uploadFile(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'File is required',
      });
    }

    return {
      data: await this.employeeDocumentsService.uploadDocumentFile(
        employeeId,
        documentId,
        file,
        user,
        { ipAddress: req.ip, device: req.headers['user-agent'] },
      ),
    };
  }

  @SelfService()
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
