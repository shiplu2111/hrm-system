import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContextStore {
  tenantId: string | null;
  userId: string;
  roleId: string;
  skipScope: boolean;
}

export const tenantContext = new AsyncLocalStorage<TenantContextStore>();

export function getTenantContext(): TenantContextStore | undefined {
  return tenantContext.getStore();
}

/** Tenant ID from JWT session — never read from request params/body. */
export function getTenantIdFromSession(): string | null {
  return tenantContext.getStore()?.tenantId ?? null;
}

export function isTenantScopeSkipped(): boolean {
  return tenantContext.getStore()?.skipScope ?? false;
}

export function runWithTenantContext<T>(
  store: TenantContextStore,
  fn: () => T,
): T {
  return tenantContext.run(store, fn);
}
