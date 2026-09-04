import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { Permission, User } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AUTH_CONSTANTS, AUTH_ERROR_CODES, lockoutDurationMs } from './auth.constants';
import type {
  AccessTokenPayload,
  AuthenticatedUser,
  AuthSessionView,
  PermissionClaim,
} from './auth.types';
import {
  generateRefreshTokenValue,
  generateTokenFamilyId,
  hashToken,
  parseDurationToMs,
  parseDurationToSeconds,
} from './auth.utils';
import type { LoginDto } from './dto/auth-swagger.dto';
import {
  assertPasswordMeetsPolicy,
  hashPassword,
} from './password-policy.utils';

type UserWithRole = User & {
  role: {
    name: string;
    permissions: Permission[];
  };
};

export interface AuthTokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: AuthenticatedUser;
}

interface RefreshContext {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly accessExpiry: string;
  private readonly refreshExpiryMs: number;
  private readonly accessExpiresInSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    this.accessSecret = this.requireEnv('JWT_ACCESS_SECRET');
    this.accessExpiry = process.env.JWT_ACCESS_EXPIRY ?? '15m';
    this.refreshExpiryMs = parseDurationToMs(
      process.env.JWT_REFRESH_EXPIRY ?? '30d',
    );
    this.accessExpiresInSeconds = parseDurationToSeconds(this.accessExpiry);
  }

  async login(dto: LoginDto, context: RefreshContext): Promise<AuthTokenBundle> {
    const user = await this.resolveUserForLogin(dto);

    if (!user.isActive) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.ACCOUNT_INACTIVE,
        message: 'Account is inactive',
      });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.ACCOUNT_LOCKED,
        message: 'Account is temporarily locked due to failed login attempts',
      });
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.recordFailedLogin(user.id, user.failedLoginAttempts);
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    if (user.tenantId) {
      const userTenant = await this.prisma.unscoped.tenant.findUnique({
        where: { id: user.tenantId },
      });
      if (!userTenant) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_CODES.TENANT_NOT_FOUND,
          message: 'Tenant not found',
        });
      }
      this.assertTenantActive(userTenant.status);
    }

    await this.prisma.unscoped.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    return this.issueTokenBundle(user, context, generateTokenFamilyId());
  }

  async refresh(
    refreshToken: string,
    context: RefreshContext,
  ): Promise<AuthTokenBundle> {
    const tokenHash = hashToken(refreshToken);
    const storedToken = await this.prisma.unscoped.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            role: {
              include: { permissions: true },
            },
          },
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN,
        message: 'Invalid refresh token',
      });
    }

    if (storedToken.revokedAt) {
      await this.revokeTokenFamily(storedToken.familyId);
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.REFRESH_TOKEN_REUSED,
        message: 'Refresh token has already been used',
      });
    }

    if (storedToken.expiresAt <= new Date()) {
      await this.revokeRefreshToken(storedToken.id);
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN,
        message: 'Refresh token has expired',
      });
    }

    const user = storedToken.user;
    if (!user.isActive) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.ACCOUNT_INACTIVE,
        message: 'Account is inactive',
      });
    }

    if (user.tenantId) {
      const tenant = await this.prisma.unscoped.tenant.findUnique({
        where: { id: user.tenantId },
      });
      if (!tenant) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_CODES.TENANT_NOT_FOUND,
          message: 'Tenant not found',
        });
      }
      this.assertTenantActive(tenant.status);
    }

    await this.revokeRefreshToken(storedToken.id);

    return this.issueTokenBundle(user, context, storedToken.familyId);
  }

  async listSessions(
    userId: string,
    currentRefreshToken?: string,
  ): Promise<AuthSessionView[]> {
    const currentHash = currentRefreshToken
      ? hashToken(currentRefreshToken)
      : null;
    const rows = await this.prisma.unscoped.refreshToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      isCurrent: currentHash ? row.tokenHash === currentHash : false,
      isRevoked: row.revokedAt !== null,
      isExpired: row.expiresAt <= new Date(),
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const row = await this.prisma.unscoped.refreshToken.findFirst({
      where: { id: sessionId, userId },
    });
    if (!row) {
      throw new NotFoundException({
        code: AUTH_ERROR_CODES.SESSION_NOT_FOUND,
        message: 'Session not found',
      });
    }
    if (!row.revokedAt) {
      await this.revokeRefreshToken(row.id);
    }
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashToken(refreshToken);
    const stored = await this.prisma.unscoped.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (stored && !stored.revokedAt) {
      await this.revokeRefreshToken(stored.id);
    }
  }

  async logoutAll(userId: string, exceptRefreshToken?: string): Promise<number> {
    const exceptHash = exceptRefreshToken
      ? hashToken(exceptRefreshToken)
      : undefined;
    const result = await this.prisma.unscoped.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptHash ? { NOT: { tokenHash: exceptHash } } : {}),
      },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    context: RefreshContext,
  ): Promise<AuthTokenBundle> {
    assertPasswordMeetsPolicy(newPassword);

    const user = await this.prisma.unscoped.user.findUnique({
      where: { id: userId },
      include: {
        role: { include: { permissions: true } },
      },
    });
    if (!user) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'User not found',
      });
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Current password is incorrect',
      });
    }

    const samePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (samePassword) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.WEAK_PASSWORD,
        message: 'New password must differ from the current password',
      });
    }

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.unscoped.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.logoutAll(userId);

    return this.issueTokenBundle(user, context, generateTokenFamilyId());
  }

  buildAuthenticatedUser(user: UserWithRole): AuthenticatedUser {
    return {
      id: user.id,
      tenantId: user.tenantId,
      roleId: user.roleId,
      roleName: user.role.name,
      employeeId: user.employeeId,
      email: user.email,
      permissions: this.toPermissionClaims(user.role.permissions),
    };
  }

  private async issueTokenBundle(
    user: UserWithRole,
    context: RefreshContext,
    familyId: string,
  ): Promise<AuthTokenBundle> {
    const authenticatedUser = this.buildAuthenticatedUser(user);
    const accessToken = await this.signAccessToken(authenticatedUser);
    const refreshToken = generateRefreshTokenValue();
    const expiresAt = new Date(Date.now() + this.refreshExpiryMs);

    await this.prisma.unscoped.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        familyId,
        expiresAt,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessExpiresInSeconds,
      user: authenticatedUser,
    };
  }

  private async signAccessToken(user: AuthenticatedUser): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      tenant_id: user.tenantId,
      role_id: user.roleId,
      role_name: user.roleName,
      employee_id: user.employeeId,
      permissions: user.permissions,
    };

    return this.jwtService.signAsync(
      { ...payload },
      {
        secret: this.accessSecret,
        expiresIn: this.accessExpiresInSeconds,
      },
    );
  }

  private async resolveUserForLogin(dto: LoginDto): Promise<UserWithRole> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const roleInclude = {
      role: { include: { permissions: true } },
    } as const;

    if (dto.tenantSubdomain || dto.tenantId) {
      const tenant = await this.resolveTenantOrThrow(
        dto.tenantSubdomain,
        dto.tenantId,
      );
      this.assertTenantActive(tenant.status);

      const user = await this.prisma.unscoped.user.findFirst({
        where: {
          email: normalizedEmail,
          tenantId: tenant.id,
        },
        include: roleInclude,
      });

      if (!user) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
          message: 'Invalid email or password',
        });
      }

      return user;
    }

    const matches = await this.prisma.unscoped.user.findMany({
      where: { email: normalizedEmail },
      include: roleInclude,
    });

    if (matches.length === 0) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.INVALID_CREDENTIALS,
        message: 'Invalid email or password',
      });
    }

    if (matches.length > 1) {
      throw new UnauthorizedException({
        code: 'TENANT_SELECTION_REQUIRED',
        message:
          'Multiple accounts found for this email — provide tenantSubdomain or tenantId',
      });
    }

    return matches[0];
  }

  private async resolveTenantOrThrow(
    tenantSubdomain?: string,
    tenantId?: string,
  ) {
    const tenant = await this.resolveTenant(tenantSubdomain, tenantId);
    if (!tenant) {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.TENANT_NOT_FOUND,
        message: 'Tenant not found',
      });
    }
    return tenant;
  }

  private async resolveTenant(
    tenantSubdomain?: string,
    tenantId?: string,
  ) {
    if (tenantSubdomain) {
      const tenant = await this.prisma.unscoped.tenant.findUnique({
        where: { subdomain: tenantSubdomain },
      });
      if (!tenant) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_CODES.TENANT_NOT_FOUND,
          message: 'Tenant not found',
        });
      }
      return tenant;
    }

    if (tenantId) {
      const tenant = await this.prisma.unscoped.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!tenant) {
        throw new UnauthorizedException({
          code: AUTH_ERROR_CODES.TENANT_NOT_FOUND,
          message: 'Tenant not found',
        });
      }
      return tenant;
    }

    return null;
  }

  private async recordFailedLogin(
    userId: string,
    currentAttempts: number,
  ): Promise<void> {
    const nextAttempts = currentAttempts + 1;
    const lockMs = lockoutDurationMs(nextAttempts);

    await this.prisma.unscoped.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: nextAttempts,
        lockedUntil:
          lockMs > 0 ? new Date(Date.now() + lockMs) : null,
      },
    });
  }

  private assertTenantActive(status: string): void {
    if (status !== 'active') {
      throw new UnauthorizedException({
        code: AUTH_ERROR_CODES.TENANT_SUSPENDED,
        message: 'Tenant is not active',
      });
    }
  }

  private async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.prisma.unscoped.refreshToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });
  }

  private async revokeTokenFamily(familyId: string): Promise<void> {
    await this.prisma.unscoped.refreshToken.updateMany({
      where: {
        familyId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  private toPermissionClaims(permissions: Permission[]): PermissionClaim[] {
    return permissions.map((permission) => ({
      module: permission.module,
      action: permission.action,
    }));
  }

  private requireEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`${name} is not configured`);
    }
    return value;
  }
}
