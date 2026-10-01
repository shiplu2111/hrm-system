import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { ApiKeyAuthService } from '../api-access/api-key-auth.service';
import { OAuthTokenAuthService } from '../api-access/oauth-token-auth.service';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from './allow-pending-password-change.decorator';
import { AUTH_ERROR_CODES } from './auth.constants';

/**
 * Accepts JWT, scoped API keys (`hrm_live_*`), or OAuth access tokens (`oat_*`).
 * API_GUIDELINES.md §4 — tenant_id always derived from credentials, never from request params.
 */
@Injectable()
export class UnifiedAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    private readonly apiKeyAuth: ApiKeyAuthService,
    private readonly oauthTokenAuth: OAuthTokenAuthService,
  ) {
    super();
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
      user?: unknown;
    }>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentication required',
      });
    }

    const token = header.slice('Bearer '.length).trim();
    if (token.startsWith('hrm_')) {
      request.user = await this.apiKeyAuth.authenticate(token);
      return true;
    }
    if (token.startsWith('oat_')) {
      request.user = await this.oauthTokenAuth.authenticate(token);
      return true;
    }

    const activated = (await super.canActivate(context)) as boolean;
    const jwtUser = request.user as
      | { authMethod?: string; mustChangePassword?: boolean }
      | undefined;
    if (jwtUser) {
      jwtUser.authMethod = 'jwt';
      if (jwtUser.mustChangePassword && !this.allowsPendingPasswordChange(context)) {
        throw new ForbiddenException({
          code: AUTH_ERROR_CODES.PASSWORD_CHANGE_REQUIRED,
          message: 'You must change your temporary password before continuing',
        });
      }
    }
    return activated;
  }

  private allowsPendingPasswordChange(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(
        ALLOW_PENDING_PASSWORD_CHANGE_KEY,
        [context.getHandler(), context.getClass()],
      ) === true
    );
  }
}
