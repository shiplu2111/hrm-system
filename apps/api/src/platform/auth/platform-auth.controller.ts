import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import type {
  PlatformLoginHistoryView,
  PlatformLoginResponse,
  PlatformLoginSuccess,
  PlatformSessionView,
  PlatformTotpSetupView,
  PlatformUserView,
} from '@hrm/shared-types';
import { Public } from '../../common/decorators/public.decorator';
import { SkipTenantScope } from '../../common/decorators/skip-tenant-scope.decorator';
import { PlatformLoginDto } from './dto/platform-login.dto';
import {
  PlatformChangePasswordDto,
  PlatformConfirm2faDto,
  PlatformRefreshTokenDto,
  Verify2faDto,
} from './dto/verify-2fa.dto';
import { PlatformAuthGuard } from './guards/platform-auth.guard';
import { PlatformAuthService } from './platform-auth.service';

const REFRESH_COOKIE = 'platform_refresh_token';

@ApiTags('platform-auth')
@SkipTenantScope()
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Platform staff login with mandatory 2FA (TOTP)',
    description:
      'Separate platform staff login. Issues a JWT with audience "platform". ' +
      'If totpCode is provided, completes login in 1 step; otherwise returns an MFA challenge token.',
  })
  @ApiResponse({ status: 200, description: 'Platform login successful or 2FA challenge' })
  @ApiResponse({ status: 401, description: 'Invalid credentials or invalid 2FA code' })
  async login(
    @Body() dto: PlatformLoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiEnvelope<PlatformLoginResponse>> {
    const result = await this.platformAuthService.login(dto, ip, userAgent);

    if ('refreshToken' in result && result.refreshToken) {
      this.setRefreshCookie(res, result.refreshToken);
    }

    return { data: result };
  }

  @Public()
  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify platform 2FA TOTP code (step 2)',
    description:
      'Completes platform staff authentication after receiving a 2FA challenge. Issues a JWT with audience "platform".',
  })
  @ApiResponse({ status: 200, description: '2FA verified, platform tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired MFA token or TOTP code' })
  async verify2fa(
    @Body() dto: Verify2faDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiEnvelope<PlatformLoginSuccess>> {
    const result = await this.platformAuthService.verify2fa(dto, ip, userAgent);
    this.setRefreshCookie(res, result.refreshToken);
    return { data: result };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate platform refresh token' })
  @ApiResponse({ status: 200, description: 'New platform access token and refresh token' })
  @ApiResponse({ status: 401, description: 'Invalid or revoked platform refresh token' })
  async refresh(
    @Body() dto: Partial<PlatformRefreshTokenDto>,
    @Req() req: Request,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiEnvelope<PlatformLoginSuccess>> {
    const token = dto.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return {
        data: await this.platformAuthService.refreshToken('', ip, userAgent),
      };
    }

    const result = await this.platformAuthService.refreshToken(token, ip, userAgent);
    this.setRefreshCookie(res, result.refreshToken);
    return { data: result };
  }

  @UseGuards(PlatformAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('platform-access-token')
  @ApiOperation({ summary: 'Logout platform staff session' })
  async logout(
    @Req() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiEnvelope<{ success: boolean }>> {
    const userId = req.platformUser?.id ?? req.user?.id;
    const cookieToken = req.cookies?.[REFRESH_COOKIE];

    if (userId) {
      await this.platformAuthService.logout(userId, cookieToken, ip, userAgent);
    }

    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { data: { success: true } };
  }

  @UseGuards(PlatformAuthGuard)
  @Get('me')
  @ApiBearerAuth('platform-access-token')
  @ApiOperation({ summary: 'Get current authenticated platform staff profile' })
  async me(@Req() req: any): Promise<ApiEnvelope<PlatformUserView>> {
    const userId = req.platformUser?.id ?? req.user?.id;
    const profile = await this.platformAuthService.getProfile(userId);
    return { data: profile };
  }

  @UseGuards(PlatformAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('platform-access-token')
  @ApiOperation({ summary: 'Change current platform staff password' })
  async changePassword(
    @Req() req: any,
    @Body() dto: PlatformChangePasswordDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<ApiEnvelope<{ success: boolean }>> {
    const userId = req.platformUser?.id ?? req.user?.id;
    const result = await this.platformAuthService.changePassword(userId, dto, ip, userAgent);
    return { data: result };
  }

  @UseGuards(PlatformAuthGuard)
  @Get('sessions')
  @ApiBearerAuth('platform-access-token')
  @ApiOperation({ summary: 'List active sessions for current platform user' })
  async listSessions(@Req() req: any): Promise<ApiEnvelope<PlatformSessionView[]>> {
    const userId = req.platformUser?.id ?? req.user?.id;
    const cookieToken = req.cookies?.[REFRESH_COOKIE];
    const sessions = await this.platformAuthService.listSessions(userId, cookieToken);
    return { data: sessions };
  }

  @UseGuards(PlatformAuthGuard)
  @Post('sessions/:id/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('platform-access-token')
  @ApiOperation({ summary: 'Revoke an active platform session' })
  async revokeSession(
    @Req() req: any,
    @Param('id') sessionId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<ApiEnvelope<{ success: boolean }>> {
    const userId = req.platformUser?.id ?? req.user?.id;
    await this.platformAuthService.revokeSession(userId, sessionId, ip, userAgent);
    return { data: { success: true } };
  }

  @UseGuards(PlatformAuthGuard)
  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('platform-access-token')
  @ApiOperation({ summary: 'Revoke all other active platform sessions' })
  async revokeOtherSessions(
    @Req() req: any,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<ApiEnvelope<{ success: boolean }>> {
    const userId = req.platformUser?.id ?? req.user?.id;
    const cookieToken = req.cookies?.[REFRESH_COOKIE];
    await this.platformAuthService.revokeOtherSessions(userId, cookieToken, ip, userAgent);
    return { data: { success: true } };
  }

  @UseGuards(PlatformAuthGuard)
  @Get('login-history')
  @ApiBearerAuth('platform-access-token')
  @ApiOperation({ summary: 'Get recent login history for current platform user' })
  async loginHistory(@Req() req: any): Promise<ApiEnvelope<PlatformLoginHistoryView[]>> {
    const userId = req.platformUser?.id ?? req.user?.id;
    const history = await this.platformAuthService.listLoginHistory(userId);
    return { data: history };
  }

  @UseGuards(PlatformAuthGuard)
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('platform-access-token')
  @ApiOperation({ summary: 'Generate new TOTP 2FA secret and QR code URI for re-enrolment' })
  async setup2fa(@Req() req: any): Promise<ApiEnvelope<PlatformTotpSetupView>> {
    const userId = req.platformUser?.id ?? req.user?.id;
    const setup = await this.platformAuthService.setup2fa(userId);
    return { data: setup };
  }

  @UseGuards(PlatformAuthGuard)
  @Post('2fa/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('platform-access-token')
  @ApiOperation({ summary: 'Confirm 2FA enrolment with verification code' })
  async confirm2fa(
    @Req() req: any,
    @Body() dto: PlatformConfirm2faDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
  ): Promise<ApiEnvelope<{ success: boolean }>> {
    const userId = req.platformUser?.id ?? req.user?.id;
    const result = await this.platformAuthService.confirm2fa(userId, dto, ip, userAgent);
    return { data: result };
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}
