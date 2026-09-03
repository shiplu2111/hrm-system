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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DOCUMENT_FILE_POLICY } from '../storage/document-file.policy';
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

  @Get(':documentId/file-url')
  @RequirePermission('employee', 'view')
  @ApiOperation({
    summary: 'Get a time-limited download URL for the document file',
  })
  async getFileUrl(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return {
      data: await this.employeeDocumentsService.getDocumentFileUrl(
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
