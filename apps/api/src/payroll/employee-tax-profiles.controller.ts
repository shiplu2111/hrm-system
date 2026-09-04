import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import {
  EmployeeTaxProfilesService,
  type UpdateEmployeeTaxProfileInput,
} from './employee-tax-profiles.service';

@ApiTags('tax-profiles')
@ApiBearerAuth('access-token')
@Controller('employees/:employeeId/tax-profile')
export class EmployeeTaxProfilesController {
  constructor(
    private readonly taxProfilesService: EmployeeTaxProfilesService,
  ) {}

  @Get()
  @RequirePermission('payroll', 'view')
  @ApiOperation({
    summary: 'Get employee tax/payment profile (masked — SECURITY.md §2)',
  })
  async getProfile(@Param('employeeId', ParseUUIDPipe) employeeId: string) {
    return { data: await this.taxProfilesService.getMasked(employeeId) };
  }

  @Get('reveal')
  @RequirePermission('payroll', 'edit')
  @ApiOperation({
    summary: 'Reveal full tax ID or bank account on demand (audited)',
  })
  async revealField(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Query('field') field: 'taxIdNumber' | 'bankAccountNumber',
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return {
      data: await this.taxProfilesService.revealField(
        employeeId,
        field,
        user,
        { ipAddress: req.ip, device: req.headers['user-agent'] },
      ),
    };
  }

  @Patch()
  @RequirePermission('payroll', 'edit')
  @ApiOperation({ summary: 'Update tax/payment profile (encrypts sensitive fields)' })
  async updateProfile(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() body: UpdateEmployeeTaxProfileInput,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    return {
      data: await this.taxProfilesService.upsert(employeeId, body, user, {
        ipAddress: req.ip,
        device: req.headers['user-agent'],
      }),
    };
  }
}
