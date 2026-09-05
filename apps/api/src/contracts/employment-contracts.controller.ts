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
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { DOCUMENT_FILE_POLICY } from '../storage/document-file.policy';
import {
  CreateEmploymentContractDto,
  ListEmploymentContractsQueryDto,
  RenewEmploymentContractDto,
  ContractRenewalActionDto,
  UpdateEmploymentContractDto,
  UploadContractDocumentDto,
} from './dto/employment-contract.dto';
import { EmploymentContractsService } from './employment-contracts.service';

@ApiTags('employment-contracts')
@ApiBearerAuth('access-token')
@Controller()
export class EmploymentContractsController {
  constructor(private readonly contractsService: EmploymentContractsService) {}

  @Get('companies/:companyId/employment-contracts')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'List employment contracts for a company' })
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListEmploymentContractsQueryDto,
  ) {
    return { data: await this.contractsService.list(companyId, query) };
  }

  @Get('employment-contracts/:contractId')
  @RequirePermission('employee', 'view')
  async get(@Param('contractId', ParseUUIDPipe) contractId: string) {
    return { data: await this.contractsService.get(contractId) };
  }

  @Post('companies/:companyId/employment-contracts')
  @RequirePermission('employee', 'create')
  async create(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateEmploymentContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.contractsService.create(companyId, dto, user) };
  }

  @Patch('employment-contracts/:contractId')
  @RequirePermission('employee', 'edit')
  async update(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: UpdateEmploymentContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.contractsService.update(contractId, dto, user) };
  }

  @Post('employment-contracts/:contractId/activate')
  @RequirePermission('employee', 'edit')
  async activate(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.contractsService.activate(contractId, user) };
  }

  @Post('employment-contracts/:contractId/terminate')
  @RequirePermission('employee', 'edit')
  async terminate(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.contractsService.terminate(contractId, user) };
  }

  @Post('employment-contracts/:contractId/renew')
  @RequirePermission('employee', 'create')
  async renew(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: RenewEmploymentContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.contractsService.renew(contractId, dto, user) };
  }

  @Post('employment-contracts/:contractId/submit-renewal')
  @RequirePermission('employee', 'edit')
  async submitRenewal(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.contractsService.submitRenewal(contractId, user) };
  }

  @Post('employment-contracts/:contractId/approve-renewal')
  @RequirePermission('employee', 'edit')
  async approveRenewal(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: ContractRenewalActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.contractsService.approveRenewal(contractId, user, dto),
    };
  }

  @Post('employment-contracts/:contractId/reject-renewal')
  @RequirePermission('employee', 'edit')
  async rejectRenewal(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: ContractRenewalActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return {
      data: await this.contractsService.rejectRenewal(contractId, user, dto),
    };
  }

  @Post('employment-contracts/:contractId/documents')
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
      required: ['file', 'label'],
      properties: {
        file: { type: 'string', format: 'binary' },
        label: { type: 'string' },
      },
    },
  })
  async uploadDocument(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Body() dto: UploadContractDocumentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'File is required',
      });
    }
    return {
      data: await this.contractsService.uploadDocument(
        contractId,
        dto.label,
        file,
        user,
      ),
    };
  }

  @Get('employment-contracts/:contractId/documents/:documentId/file-url')
  @RequirePermission('employee', 'view')
  async getDocumentUrl(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return {
      data: await this.contractsService.getDocumentFileUrl(contractId, documentId),
    };
  }

  @Delete('employment-contracts/:contractId/documents/:documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('employee', 'delete')
  async deleteDocument(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.contractsService.deleteDocument(contractId, documentId, user);
  }
}
