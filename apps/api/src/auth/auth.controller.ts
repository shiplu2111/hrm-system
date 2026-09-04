import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { RequirePermission } from '../rbac/require-permission.decorator';
import type { AuthenticatedUser } from './auth.types';
import { AUTH_CONSTANTS } from './auth.constants';
import { AuthService } from './auth.service';
import {
  ApiDataLoginResponseDto,
  ApiDataRefreshResponseDto,
  ChangePasswordDto,
  LoginDto,
  RefreshTokenDto,
} from './dto/auth-swagger.dto';
import { parseDurationToMs } from './auth.utils';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly refreshCookieMaxAge: number;
  private readonly isProduction: boolean;

  constructor(private readonly authService: AuthService) {
    this.refreshCookieMaxAge = parseDurationToMs(
      process.env.JWT_REFRESH_EXPIRY ?? '30d',
    );
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  @Public()
  @Post('login')
  @Throttle({
    default: {
      limit: AUTH_CONSTANTS.AUTH_RATE_LIMIT,
      ttl: AUTH_CONSTANTS.AUTH_RATE_TTL_MS,
    },
  })
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Tenant-aware login. Provide `tenantSubdomain` (e.g. `demo`) or `tenantId` for tenant users. ' +
      'Platform **Super Admin** omits tenant fields (`tenantId` is null in the JWT). ' +
      'Issues a short-lived JWT access token and a refresh token (also set as httpOnly cookie).',
  })
  @ApiBody({
    type: LoginDto,
    examples: {
      demo: {
        summary: 'Demo tenant (Company Owner)',
        value: {
          email: 'admin@cmsnbd.com',
          password: 'password',
          tenantSubdomain: 'demo',
        },
      },
      super: {
        summary: 'Super Admin (platform — no tenant)',
        value: {
          email: 'super@cmsnbd.com',
          password: 'password',
        },
      },
    },
  })
  @ApiResponse({ status: 201, type: ApiDataLoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials or inactive tenant' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiEnvelope<AuthLoginResponse>> {
    const tokens = await this.authService.login(dto, this.extractContext(req));
    this.setRefreshCookie(res, tokens.refreshToken);

    return {
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: tokens.user,
      },
    };
  }

  @Public()
  @Post('refresh')
  @Throttle({
    default: {
      limit: AUTH_CONSTANTS.AUTH_RATE_LIMIT,
      ttl: AUTH_CONSTANTS.AUTH_RATE_TTL_MS,
    },
  })
  @ApiOperation({
    summary: 'Rotate refresh token and issue new access token',
    description:
      'Pass `refreshToken` in the body or rely on the httpOnly cookie from login. ' +
      'Each refresh invalidates the previous refresh token (rotation).',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiCookieAuth('refresh_token')
  @ApiResponse({ status: 201, type: ApiDataRefreshResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or reused refresh token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiEnvelope<AuthRefreshResponse>> {
    const refreshToken = this.resolveRefreshToken(dto, req)!;

    const tokens = await this.authService.refresh(
      refreshToken,
      this.extractContext(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken);

    return {
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  @Get('sessions')
  @RequirePermission('employee', 'view')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List active sessions/devices (SECURITY.md §4)' })
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const refreshToken = this.resolveRefreshToken({}, req, false);
    return {
      data: await this.authService.listSessions(
        user.id,
        refreshToken,
      ),
    };
  }

  @Delete('sessions/:sessionId')
  @RequirePermission('employee', 'view')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke a session/device' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    await this.authService.revokeSession(user.id, sessionId);
    return { data: { revoked: true } };
  }

  @Post('logout')
  @RequirePermission('employee', 'view')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout current session (revoke refresh token)' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.resolveRefreshToken(dto, req, false);
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    this.clearRefreshCookie(res);
    return { data: { loggedOut: true } };
  }

  @Post('logout-all')
  @RequirePermission('employee', 'view')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke all sessions except the current device' })
  async logoutAll(@CurrentUser() user: AuthenticatedUser, @Req() req: Request) {
    const refreshToken = this.resolveRefreshToken({}, req, false);
    const revokedCount = await this.authService.logoutAll(
      user.id,
      refreshToken,
    );
    return { data: { revokedCount } };
  }

  @Post('change-password')
  @RequirePermission('employee', 'view')
  @ApiBearerAuth('access-token')
  @Throttle({
    default: {
      limit: AUTH_CONSTANTS.AUTH_RATE_LIMIT,
      ttl: AUTH_CONSTANTS.AUTH_RATE_TTL_MS,
    },
  })
  @ApiOperation({
    summary: 'Change password (SECURITY.md §3 policy enforced on new password)',
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      this.extractContext(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return {
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }

  private resolveRefreshToken(
    dto: RefreshTokenDto,
    req: Request,
    required = true,
  ): string | undefined {
    const refreshToken =
      dto.refreshToken ??
      (req.cookies?.[AUTH_CONSTANTS.REFRESH_COOKIE_NAME] as string | undefined);

    if (!refreshToken && required) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is required',
      });
    }

    return refreshToken;
  }

  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(AUTH_CONSTANTS.REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      maxAge: this.refreshCookieMaxAge,
      path: '/api/v1/auth',
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(AUTH_CONSTANTS.REFRESH_COOKIE_NAME, {
      path: '/api/v1/auth',
    });
  }

  private extractContext(req: Request) {
    return {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };
  }
}

interface AuthLoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    tenantId: string | null;
    roleId: string;
    roleName: string;
    employeeId: string | null;
    permissions: { module: string; action: string }[];
  };
}

interface AuthRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
