import { SetMetadata } from '@nestjs/common';

export const SKIP_TENANT_SCOPE_KEY = 'skipTenantScope';

/** Bypass Prisma tenant auto-scoping for this handler (internal/bootstrap only). */
export const SkipTenantScope = () => SetMetadata(SKIP_TENANT_SCOPE_KEY, true);
