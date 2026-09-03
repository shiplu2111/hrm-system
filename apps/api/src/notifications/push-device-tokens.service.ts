import { Injectable } from '@nestjs/common';
import { PushPlatform } from '@prisma/client';
import type { RegisterPushTokenInput } from '@hrm/shared-types';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PushDeviceTokensService {
  constructor(private readonly prisma: PrismaService) {}

  async register(
    user: AuthenticatedUser,
    input: RegisterPushTokenInput,
  ): Promise<{ registered: true }> {
    const platform =
      input.platform === 'ios' ? PushPlatform.ios : PushPlatform.android;

    await this.prisma.pushDeviceToken.upsert({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId: input.deviceId,
        },
      },
      create: {
        tenantId: user.tenantId!,
        userId: user.id,
        deviceId: input.deviceId,
        token: input.token,
        platform,
        lastSeenAt: new Date(),
      },
      update: {
        token: input.token,
        platform,
        lastSeenAt: new Date(),
      },
    });

    return { registered: true };
  }

  async unregister(user: AuthenticatedUser, deviceId: string): Promise<void> {
    await this.prisma.pushDeviceToken.deleteMany({
      where: { userId: user.id, deviceId },
    });
  }

  async listTokensForUser(userId: string): Promise<string[]> {
    const rows = await this.prisma.unscoped.pushDeviceToken.findMany({
      where: { userId },
      select: { token: true },
    });
    return rows.map((row) => row.token);
  }

  async removeInvalidTokens(tokens: string[]): Promise<void> {
    if (tokens.length === 0) return;
    await this.prisma.unscoped.pushDeviceToken.deleteMany({
      where: { token: { in: tokens } },
    });
  }
}
