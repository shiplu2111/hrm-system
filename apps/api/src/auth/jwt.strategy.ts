import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { AccessTokenPayload, AuthenticatedUser } from './auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      throw new Error('JWT_ACCESS_SECRET is not configured');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  validate(payload: AccessTokenPayload): AuthenticatedUser {
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
    };
  }
}
