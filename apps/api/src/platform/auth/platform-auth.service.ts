import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import type {
  PlatformLogin2faChallenge,
  PlatformLoginHistoryView,
  PlatformLoginResponse,
  PlatformLoginSuccess,
  PlatformSessionView,
  PlatformTotpSetupView,
  PlatformUserView,
} from '@hrm/shared-types';
import { FieldEncryptionService } from '../../crypto/field-encryption.service';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAuditService } from '../audit/platform-audit.service';
import { PlatformLoginDto } from './dto/platform-login.dto';
import {
  PlatformChangePasswordDto,
  PlatformConfirm2faDto,
  Verify2faDto,
} from './dto/verify-2fa.dto';
import { TotpService } from './totp.service';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ACCESS_TOKEN_TTL = process.env.JWT_ACCESS_EXPIRY ?? '15m';

@Injectable()
export class PlatformAuthService {
  private readonly logger = new Logger(PlatformAuthService.name);
  private readonly jwtAccessSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly totpService: TotpService,
    private readonly fieldEncryption: FieldEncryptionService,
    private readonly platformAudit: PlatformAuditService,
  ) {
    this.jwtAccessSecret =
      process.env.JWT_ACCESS_SECRET ?? 'hrm_secret_jwt_access_super_secure_2026';
    this.jwtRefreshSecret =
      process.env.JWT_REFRESH_SECRET ?? 'hrm_secret_jwt_refresh_super_secure_2026';
  }

  async login(
    dto: PlatformLoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformLoginResponse> {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.unscoped.platformUser.findUnique({
      where: { email },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      await this.recordLoginHistory(null, email, 'failed', 'User not found', ipAddress, userAgent);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      await this.recordLoginHistory(user.id, email, 'failed', 'Account inactive', ipAddress, userAgent);
      throw new ForbiddenException({
        code: 'ACCOUNT_INACTIVE',
        message: 'This platform staff account has been deactivated',
      });
    }

    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      await this.recordLoginHistory(user.id, email, 'locked', 'Account locked', ipAddress, userAgent);
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        message: 'Account temporarily locked due to multiple failed attempts. Please try again later.',
      });
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.handleFailedAttempt(user, email, 'Invalid password', ipAddress, userAgent);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    // 2FA is mandatory for every platform user — no opt-out
    let secret = this.decryptSecret(user.totpSecretEncrypted);
    let setupRequired = false;

    if (!secret) {
      // First-time enrollment: generate and assign secret
      secret = this.totpService.generateSecret();
      await this.prisma.unscoped.platformUser.update({
        where: { id: user.id },
        data: {
          totpSecretEncrypted: this.fieldEncryption.encrypt(secret),
          totpEnabled: true,
        },
      });
      setupRequired = true;
    }

    // If TOTP code provided in the login body (1-step login flow)
    if (dto.totpCode) {
      const isValidTotp = this.totpService.verifyCode(secret, dto.totpCode);
      if (!isValidTotp) {
        await this.handleFailedAttempt(user, email, 'Invalid 2FA code', ipAddress, userAgent);
        throw new UnauthorizedException({
          code: 'INVALID_2FA_CODE',
          message: 'Invalid 2FA TOTP code',
        });
      }

      return this.issuePlatformAuthBundle(user, ipAddress, userAgent);
    }

    // 2-step challenge flow: return short-lived MFA challenge token
    const mfaToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        type: 'platform_mfa',
      },
      {
        secret: this.jwtAccessSecret,
        expiresIn: '5m',
        audience: 'platform_mfa',
      },
    );

    await this.recordLoginHistory(
      user.id,
      email,
      '2fa_challenge',
      '2FA challenge issued',
      ipAddress,
      userAgent,
    );

    const challenge: PlatformLogin2faChallenge = {
      requires2fa: true,
      mfaToken,
      ...(setupRequired
        ? {
            setupRequired: true,
            secret,
            qrUri: this.totpService.generateKeyUri(user.email, secret),
          }
        : {}),
    };

    return challenge;
  }

  async verify2fa(
    dto: Verify2faDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformLoginSuccess> {
    let payload: { sub: string; email: string; type: string };
    try {
      payload = await this.jwtService.verifyAsync(dto.mfaToken, {
        secret: this.jwtAccessSecret,
        audience: 'platform_mfa',
      });
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_MFA_TOKEN',
        message: 'MFA challenge session expired or invalid. Please sign in again.',
      });
    }

    if (payload.type !== 'platform_mfa' || !payload.sub) {
      throw new UnauthorizedException({
        code: 'INVALID_MFA_TOKEN',
        message: 'Invalid MFA challenge token',
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

    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Platform staff user not found or deactivated',
      });
    }

    const secret = this.decryptSecret(user.totpSecretEncrypted);
    if (!secret) {
      throw new InternalServerErrorException({
        code: 'TOTP_NOT_CONFIGURED',
        message: '2FA secret not found for user',
      });
    }

    const isValid = this.totpService.verifyCode(secret, dto.totpCode);
    if (!isValid) {
      await this.handleFailedAttempt(user, user.email, 'Invalid 2FA code during verification', ipAddress, userAgent);
      throw new UnauthorizedException({
        code: 'INVALID_2FA_CODE',
        message: 'Invalid 2FA code',
      });
    }

    return this.issuePlatformAuthBundle(user, ipAddress, userAgent);
  }

  async refreshToken(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformLoginSuccess> {
    const tokenHash = this.hashToken(rawRefreshToken);

    const session = await this.prisma.unscoped.platformSession.findFirst({
      where: {
        refreshTokenHash: tokenHash,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            role: {
              include: {
                permissions: true,
              },
            },
          },
        },
      },
    });

    if (!session || !session.user || !session.user.isActive) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired platform refresh token',
      });
    }

    // Revoke old session (refresh token rotation)
    await this.prisma.unscoped.platformSession.update({
      where: { id: session.id },
      data: { isRevoked: true },
    });

    return this.issuePlatformAuthBundle(session.user, ipAddress, userAgent);
  }

  async logout(userId: string, rawRefreshToken?: string, ipAddress?: string, userAgent?: string): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = this.hashToken(rawRefreshToken);
      await this.prisma.unscoped.platformSession.updateMany({
        where: { userId, refreshTokenHash: tokenHash },
        data: { isRevoked: true },
      });
    } else {
      await this.prisma.unscoped.platformSession.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    await this.platformAudit.log({
      userId,
      action: 'logout',
      module: 'platform_auth',
      ipAddress,
      userAgent,
    });
  }

  async getProfile(userId: string): Promise<PlatformUserView> {
    const user = await this.prisma.unscoped.platformUser.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Platform user not found',
      });
    }

    return this.toPlatformUserView(user);
  }

  async changePassword(
    userId: string,
    dto: PlatformChangePasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.unscoped.platformUser.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Platform user not found',
      });
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Current password does not match',
      });
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.unscoped.platformUser.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    await this.platformAudit.log({
      userId,
      action: 'change_password',
      module: 'platform_auth',
      ipAddress,
      userAgent,
    });

    return { success: true };
  }

  async listSessions(
    userId: string,
    currentRefreshToken?: string,
  ): Promise<PlatformSessionView[]> {
    const currentHash = currentRefreshToken ? this.hashToken(currentRefreshToken) : null;
    const sessions = await this.prisma.unscoped.platformSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      expiresAt: s.expiresAt.toISOString(),
      isRevoked: s.isRevoked,
      createdAt: s.createdAt.toISOString(),
      isCurrent: Boolean(currentHash && s.refreshTokenHash === currentHash),
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const session = await this.prisma.unscoped.platformSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException({
        code: 'SESSION_NOT_FOUND',
        message: 'Platform session not found',
      });
    }

    await this.prisma.unscoped.platformSession.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });

    await this.platformAudit.log({
      userId,
      action: 'revoke_session',
      module: 'platform_auth',
      recordId: sessionId,
      ipAddress,
      userAgent,
    });
  }

  async revokeOtherSessions(
    userId: string,
    currentRefreshToken?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const currentHash = currentRefreshToken ? this.hashToken(currentRefreshToken) : null;

    if (currentHash) {
      await this.prisma.unscoped.platformSession.updateMany({
        where: {
          userId,
          isRevoked: false,
          refreshTokenHash: { not: currentHash },
        },
        data: { isRevoked: true },
      });
    } else {
      await this.prisma.unscoped.platformSession.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    }

    await this.platformAudit.log({
      userId,
      action: 'revoke_other_sessions',
      module: 'platform_auth',
      ipAddress,
      userAgent,
    });
  }

  async listLoginHistory(userId: string, limit = 40): Promise<PlatformLoginHistoryView[]> {
    const history = await this.prisma.unscoped.platformLoginHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return history.map((h) => ({
      id: h.id,
      userId: h.userId,
      email: h.email,
      status: h.status,
      failureReason: h.failureReason,
      ipAddress: h.ipAddress,
      userAgent: h.userAgent,
      createdAt: h.createdAt.toISOString(),
    }));
  }

  async setup2fa(userId: string): Promise<PlatformTotpSetupView> {
    const user = await this.prisma.unscoped.platformUser.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Platform user not found',
      });
    }

    const secret = this.totpService.generateSecret();
    const qrUri = this.totpService.generateKeyUri(user.email, secret);
    return { secret, qrUri };
  }

  async confirm2fa(
    userId: string,
    dto: PlatformConfirm2faDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ success: boolean }> {
    const user = await this.prisma.unscoped.platformUser.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Platform user not found',
      });
    }

    const isValid = this.totpService.verifyCode(dto.secret, dto.totpCode);
    if (!isValid) {
      throw new BadRequestException({
        code: 'INVALID_2FA_CODE',
        message: 'Invalid 2FA verification code',
      });
    }

    const encrypted = this.fieldEncryption.encrypt(dto.secret);
    await this.prisma.unscoped.platformUser.update({
      where: { id: userId },
      data: {
        totpSecretEncrypted: encrypted,
        totpEnabled: true,
      },
    });

    await this.platformAudit.log({
      userId,
      action: 'enroll_2fa',
      module: 'platform_auth',
      ipAddress,
      userAgent,
    });

    return { success: true };
  }

  private async issuePlatformAuthBundle(
    user: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<PlatformLoginSuccess> {
    // Reset failed login attempts & update lastLoginAt
    await this.prisma.unscoped.platformUser.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const permissions = (user.role?.permissions ?? []).map((p: any) => ({
      module: p.module,
      action: p.action,
    }));

    // Issue platform JWT with audience "platform"
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role_id: user.roleId,
        role_name: user.role?.name ?? '',
        permissions,
      },
      {
        secret: this.jwtAccessSecret,
        expiresIn: ACCESS_TOKEN_TTL as any,
        audience: 'platform',
      },
    );

    // Issue rotating refresh token
    const rawRefreshToken = randomBytes(48).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.prisma.unscoped.platformSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: tokenHash,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        expiresAt,
      },
    });

    await this.recordLoginHistory(
      user.id,
      user.email,
      'success',
      null,
      ipAddress,
      userAgent,
    );

    await this.platformAudit.log({
      userId: user.id,
      action: 'login',
      module: 'platform_auth',
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900,
      user: this.toPlatformUserView(user),
    };
  }

  private toPlatformUserView(user: any): PlatformUserView {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roleId: user.roleId,
      roleName: user.role?.name ?? '',
      isActive: user.isActive,
      totpEnabled: user.totpEnabled,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
      permissions: (user.role?.permissions ?? []).map((p: any) => ({
        module: p.module,
        action: p.action,
      })),
    };
  }

  private async handleFailedAttempt(
    user: any,
    email: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const attempts = user.failedLoginAttempts + 1;
    let lockedUntil: Date | null = user.lockedUntil;

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    }

    await this.prisma.unscoped.platformUser.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil,
      },
    });

    await this.recordLoginHistory(
      user.id,
      email,
      attempts >= MAX_FAILED_ATTEMPTS ? 'locked' : 'failed',
      reason,
      ipAddress,
      userAgent,
    );
  }

  private async recordLoginHistory(
    userId: string | null,
    email: string,
    status: string,
    failureReason: string | null,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.prisma.unscoped.platformLoginHistory.create({
        data: {
          userId,
          email,
          status,
          failureReason,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });
    } catch (e) {
      this.logger.error(`Failed to record platform login history: ${e}`);
    }
  }

  private decryptSecret(encrypted: string | null): string | null {
    if (!encrypted) return null;
    try {
      return this.fieldEncryption.decrypt(encrypted);
    } catch {
      // In case of unencrypted plaintext (e.g. seed data)
      if (/^[A-Z2-7]{16,64}$/i.test(encrypted.trim())) {
        return encrypted.trim();
      }
      return null;
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
