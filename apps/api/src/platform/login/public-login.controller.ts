import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  ApiResponse as ApiEnvelope,
  PublicForgotCompanyResponse,
  PublicLoginDiscoverResponse,
} from '@hrm/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PublicForgotCompanyDto, PublicLoginDiscoverDto } from './dto/public-login.dto';
import { PublicLoginService } from './public-login.service';

@ApiTags('public-login')
@SkipTenantScope()
@Public()
@Controller('public/login')
export class PublicLoginController {
  constructor(private readonly loginService: PublicLoginService) {}

  @Post('discover')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Resolve a tenant login URL from a company subdomain (or dispatch login links via email) without enumerating customers',
  })
  @ApiResponse({ status: 200, description: 'Neutral redirect or check-address instruction' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async discover(
    @Body() dto: PublicLoginDiscoverDto,
  ): Promise<ApiEnvelope<PublicLoginDiscoverResponse>> {
    const data = await this.loginService.discoverLoginTarget(
      dto.identifier,
      dto.portal ?? 'portal',
    );
    return { data };
  }

  @Post('forgot-company')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Email workspace sign-in links for any active tenants associated with the provided work email (strictly non-enumerating)',
  })
  @ApiResponse({ status: 200, description: 'Neutral confirmation always returned' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async forgotCompany(
    @Body() dto: PublicForgotCompanyDto,
  ): Promise<ApiEnvelope<PublicForgotCompanyResponse>> {
    const data = await this.loginService.forgotCompanyAddress(dto.workEmail, dto.website);
    return { data };
  }
}
