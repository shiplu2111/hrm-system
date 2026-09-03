import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface AuditLogInput {
  tenantId: string | null;
  userId: string;
  action: AuditAction;
  module: string;
  recordId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  device?: string | null;
}

type AuditClient = Prisma.TransactionClient | PrismaService['unscoped'];

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    input: AuditLogInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma.unscoped;
    await client.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        action: input.action,
        module: input.module,
        recordId: input.recordId,
        oldValue:
          input.oldValue != null
            ? (input.oldValue as Prisma.InputJsonValue)
            : undefined,
        newValue:
          input.newValue != null
            ? (input.newValue as Prisma.InputJsonValue)
            : undefined,
        ipAddress: input.ipAddress ?? null,
        device: input.device ?? null,
      },
    });
  }
}
