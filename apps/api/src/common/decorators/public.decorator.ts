import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skip JWT auth and client-tenant rejection (health, login, refresh). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
