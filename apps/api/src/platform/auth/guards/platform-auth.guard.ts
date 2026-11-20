import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { PrismaService } from '../../../database/prisma.service';

export interface PlatformJwtPayload {
  sub: string;
  email: string;
  role_id: string;
  role_name: string;
  permissions: Array<{ module: string; action: string }>;
  aud: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class PlatformAuthGuard implements CanActivate {
  private readonly jwtAccessSecret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {
    this.jwtAccessSecret =
      process.env.JWT_ACCESS_SECRET ?? 'hrm_secret_jwt_access_super_secure_2026';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      platformUser?: unknown;
      user?: unknown;
    }>();

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Platform authentication token required',
      });
    }

    const token = authHeader.slice('Bearer '.length).trim();

    let payload: PlatformJwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<PlatformJwtPayload>(token, {
        secret: this.jwtAccessSecret,
      });
    } catch {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Invalid or expired platform access token',
      });
    }

    // Explicit rejection of tenant tokens on platform APIs (Prompt A.0 requirement):
    // "Tenant APIs must reject platform-audience tokens, and platform APIs must reject tenant tokens."
    if (payload.aud !== 'platform') {
      throw new UnauthorizedException({
        code: 'TENANT_TOKEN_NOT_ALLOWED',
        message: 'Tenant tokens cannot be used on platform APIs. Use a platform staff token.',
      });
    }

    if (!payload.sub || !payload.role_id) {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN_CLAIMS',
        message: 'Malformed platform token claims',
      });
    }

    const user = await this.prisma.unscoped.platformUser.findUnique({
      where: { id: payload.sub },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'Platform staff user not found',
      });
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        code: 'ACCOUNT_INACTIVE',
        message: 'Platform staff account is deactivated',
      });
    }

    const platformUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions: user.role.permissions.map((p: any) => ({
        module: p.module,
        action: p.action,
      })),
      tenantId: null, // Platform staff has no tenant_id
    };

    request.platformUser = platformUser;
    request.user = platformUser;

    return true;
  }
}
