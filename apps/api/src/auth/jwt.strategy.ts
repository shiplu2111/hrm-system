import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { AccessTokenPayload, AuthenticatedUser } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret =
      process.env.JWT_ACCESS_SECRET ||
      (process.env.NODE_ENV !== 'production'
        ? 'hrm_secret_jwt_access_super_secure_2026'
        : undefined);
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: AccessTokenPayload & { aud?: string }): AuthenticatedUser {
    // Explicit rejection of platform tokens on tenant APIs (Prompt A.0 requirement):
    // "Tenant APIs must reject platform-audience tokens, and platform APIs must reject tenant tokens."
    if (payload.aud === 'platform') {
      throw new UnauthorizedException({
        code: 'PLATFORM_TOKEN_NOT_ALLOWED',
        message: 'Platform staff tokens cannot be used on tenant APIs. Use a tenant user token.',
      });
    }

    if (!payload.sub || !payload.role_id) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Invalid access token',
      });
    }

    return {
      id: payload.sub,
      tenantId: payload.tenant_id ?? null,
      roleId: payload.role_id,
      roleName: payload.role_name ?? '',
      employeeId: payload.employee_id ?? null,
      email: '',
      permissions: payload.permissions ?? [],
      dataScope: payload.data_scope,
      mustChangePassword: payload.must_change_password === true,
      isSupportAccess: payload.support_access === true,
      supportRequestId: payload.support_request_id,
      platformUserId: payload.platform_user_id,
      staffName: payload.staff_name,
      staffEmail: payload.staff_email,
      accessMode: payload.access_mode,
    };
  }
}
