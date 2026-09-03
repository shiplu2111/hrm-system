import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { ApiResponse as ApiEnvelope } from '@hrm/shared-types';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AUTH_CONSTANTS } from './auth.constants';
import { AuthService } from './auth.service';
import {
  ApiDataLoginResponseDto,
  ApiDataRefreshResponseDto,
  LoginDto,
  RefreshTokenDto,
} from './dto/auth-swagger.dto';
import { parseDurationToMs } from './auth.utils';

@ApiTags('auth')
@Controller('auth')
@Public()
export class AuthController {
  private readonly refreshCookieMaxAge: number;
  private readonly isProduction: boolean;

  constructor(private readonly authService: AuthService) {
    this.refreshCookieMaxAge = parseDurationToMs(
      process.env.JWT_REFRESH_EXPIRY ?? '30d',
    );
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  @Post('login')
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

  @Post('refresh')
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
    const refreshToken =
      dto.refreshToken ??
      (req.cookies?.[AUTH_CONSTANTS.REFRESH_COOKIE_NAME] as string | undefined);

    if (!refreshToken) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is required',
      });
    }

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

  private setRefreshCookie(res: Response, refreshToken: string): void {
    res.cookie(AUTH_CONSTANTS.REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
      maxAge: this.refreshCookieMaxAge,
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
