import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'List expense categories' })
  async listCategories(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListExpenseCategoriesQueryDto,
  ) {
    return { data: await this.categoriesService.list(companyId, query) };
  }

  @Post('companies/:companyId/expense-categories')
  @RequirePermission('payroll', 'edit')
  async createCategory(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return { data: await this.categoriesService.create(companyId, dto) };
  }

  @Patch('expense-categories/:categoryId')
  @RequirePermission('payroll', 'edit')
  async updateCategory(
    @Param('categoryId', ParseUUIDPipe) categoryId: string,
    @Body() dto: UpdateExpenseCategoryDto,
  ) {
    return { data: await this.categoriesService.update(categoryId, dto) };
  }

  @Get('companies/:companyId/expense-claims')
  @RequirePermission('payroll', 'view')
  async listClaims(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListExpenseClaimsQueryDto,
  ) {
    return { data: await this.claimsService.list(companyId, query) };
  }

  @Get('expense-claims/:claimId')
  @RequirePermission('payroll', 'view')
  async getClaim(@Param('claimId', ParseUUIDPipe) claimId: string) {
    return { data: await this.claimsService.get(claimId) };
  }

  @Post('companies/:companyId/expense-claims')
  @RequirePermission('payroll', 'create')
  async createClaim(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateExpenseClaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.create(companyId, dto, user) };
  }

  @Post('expense-claims/:claimId/submit')
  @RequirePermission('payroll', 'create')
  async submitClaim(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.submit(claimId, user) };
  }

  @Post('expense-claims/:claimId/approve')
  @RequirePermission('payroll', 'approve')
  async approveClaim(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Body() dto: ExpenseClaimActionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.approve(claimId, user, dto) };
  }

  @Post('expense-claims/:claimId/reject')
  @RequirePermission('payroll', 'approve')
  async rejectClaim(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @Body() dto: RejectExpenseClaimDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.reject(claimId, user, dto) };
  }

  @Post('expense-claims/:claimId/cancel')
  @RequirePermission('payroll', 'create')
  async cancelClaim(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.cancel(claimId, user) };
  }

  @Post('expense-claims/:claimId/reimburse')
  @RequirePermission('payroll', 'approve')
  async reimburseClaim(
    @Param('claimId', ParseUUIDPipe) claimId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.claimsService.markReimbursed(claimId, user) };
  }

  @Post('expense-claims/:claimId/receipts')
  @RequirePermission('payroll', 'create')
  @ApiConsumes('multipart/form-data')
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
}
