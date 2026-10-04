import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { DOCUMENT_FILE_POLICY } from '../storage/document-file.policy';
import {
  CreateExpenseCategoryDto,
  CreateExpenseClaimDto,
  ExpenseClaimActionDto,
  ListExpenseCategoriesQueryDto,
  ListExpenseClaimsQueryDto,
  RejectExpenseClaimDto,
  UpdateExpenseCategoryDto,
} from './dto/expense.dto';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseClaimsService } from './expense-claims.service';

@ApiTags('expenses')
@ApiBearerAuth('access-token')
@Controller()
export class ExpensesController {
  constructor(
    private readonly categoriesService: ExpenseCategoriesService,
    private readonly claimsService: ExpenseClaimsService,
  ) {}

  @Get('companies/:companyId/expense-categories')
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'List expense categories with their limits and claim usage' })
  async listCategories(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListExpenseCategoriesQueryDto,
  ) {
    return { data: await this.categoriesService.list(companyId, query) };
  }

  @Post('companies/:companyId/expense-categories')
  @RequirePermission('payroll', 'edit')
  @ApiOperation({ summary: 'Create an expense category' })
  async createCategory(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateExpenseCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.categoriesService.create(companyId, dto, user) };
  }

  @Patch('expense-categories/:categoryId')
  @RequirePermission('payroll', 'edit')
  @ApiOperation({ summary: 'Update an expense category, its limits or active state' })
  async updateCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateExpenseCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.categoriesService.update(categoryId, dto, user) };
  }

  @Get('companies/:companyId/expense-claims')
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'List expense claims' })
  async listClaims(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListExpenseClaimsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.list(companyId, query, user) };
  }

  @Get('expense-claims/:claimId')
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'Expense claim with approval chain, receipts and limit check' })
  async getClaim(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.get(claimId, user) };
  }

  @Post('companies/:companyId/expense-claims')
  @RequirePermission('payroll', 'create')
  @ApiOperation({ summary: 'Create an expense claim (draft, or submitted with `submit: true`)' })
  async createClaim(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateExpenseClaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.create(companyId, dto, user) };
  }

  @Post('expense-claims/:claimId/submit')
  @RequirePermission('payroll', 'create')
  @ApiOperation({ summary: 'Submit a draft claim for approval' })
  async submitClaim(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.submit(claimId, user) };
  }

  @Post('expense-claims/:claimId/approve')
  @RequirePermission('payroll', 'approve')
  @ApiOperation({ summary: 'Approve the current workflow step' })
  async approveClaim(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Body() dto: ExpenseClaimActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.approve(claimId, user, dto) };
  }

  @Post('expense-claims/:claimId/reject')
  @RequirePermission('payroll', 'approve')
  @ApiOperation({ summary: 'Reject the claim (reason required)' })
  async rejectClaim(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Body() dto: RejectExpenseClaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.reject(claimId, user, dto) };
  }

  @Post('expense-claims/:claimId/cancel')
  @RequirePermission('payroll', 'create')
  @ApiOperation({ summary: 'Cancel a draft or pending claim' })
  async cancelClaim(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.cancel(claimId, user) };
  }

  @Post('expense-claims/:claimId/reimburse')
  @RequirePermission('payroll', 'approve')
  @ApiOperation({ summary: 'Record that an approved claim has been paid back' })
  async reimburseClaim(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.markReimbursed(claimId, user) };
  }

  @Post('expense-claims/:claimId/receipts')
  @RequirePermission('payroll', 'create')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Attach a receipt (PDF, JPG or PNG, up to 10 MB)' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: DOCUMENT_FILE_POLICY.maxBytes },
    }),
  )
  async uploadReceipt(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Receipt file is required',
      });
    }
    return { data: await this.claimsService.uploadReceipt(claimId, file, user) };
  }

  @Get('expense-claims/:claimId/receipts/:receiptId/file-url')
  @RequirePermission('payroll', 'view')
  async getReceiptFileUrl(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
  ) {
    return { data: await this.claimsService.getReceiptFileUrl(claimId, receiptId) };
  }

  @Get('expense-claims/:claimId/receipts/:receiptId/file')
  @RequirePermission('payroll', 'view')
  @ApiOperation({ summary: 'Stream a receipt file for viewing or download' })
  async downloadReceipt(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
    @Res() res: Response,
    @Query('disposition') disposition?: string,
  ): Promise<void> {
    const { buffer, contentType, filename } = await this.claimsService.readReceiptFile(
      claimId,
      receiptId,
    );
    res.setHeader('Content-Type', contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const asciiName = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
    res.setHeader(
      'Content-Disposition',
      `${disposition === 'attachment' ? 'attachment' : 'inline'}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    res.send(buffer);
  }
}
