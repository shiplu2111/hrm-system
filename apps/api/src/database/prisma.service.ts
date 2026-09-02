import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createTenantScopeExtension } from '../tenant/prisma-tenant.extension';

function extendWithTenantScope(client: PrismaClient) {
  return client.$extends(createTenantScopeExtension());
}

export type TenantScopedPrismaClient = ReturnType<typeof extendWithTenantScope>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly base = new PrismaClient();
  private scopedClient!: TenantScopedPrismaClient;

  async onModuleInit() {
    await this.base.$connect();
    this.scopedClient = extendWithTenantScope(this.base);
  }

  async onModuleDestroy() {
    await this.base.$disconnect();
  }

  /** Use in request handlers — queries auto-scoped by JWT tenant_id. */
  get scoped(): TenantScopedPrismaClient {
    if (!this.scopedClient) {
      this.scopedClient = extendWithTenantScope(this.base);
    }
    return this.scopedClient;
  }

  /** Use only for auth bootstrap / migrations — bypasses tenant extension. */
  get unscoped(): PrismaClient {
    return this.base;
  }
}
