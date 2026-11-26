import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:5180'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_PORTAL_URL: z.string().url().default('http://localhost:5174'),
  NEXT_PUBLIC_PLATFORM_URL: z.string().url().default('http://localhost:5176'),
  NEXT_PUBLIC_CACHE_REVALIDATE_SECONDS: z.coerce.number().default(60),
  NEXT_PUBLIC_ANALYTICS_MODE: z.enum(['consent', 'cookieless']).default('consent'),
  NEXT_PUBLIC_ANALYTICS_PROVIDER: z.enum(['plausible', 'first-party', 'none']).default('first-party'),
  NEXT_PUBLIC_ANALYTICS_COOKIELESS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v !== 'false'),
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_ANALYTICS_SCRIPT_URL: z.string().optional(),
  NEXT_PUBLIC_MARKETING_SCRIPT_URL: z.string().optional(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV || 'development',
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:5180',
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  NEXT_PUBLIC_PORTAL_URL: process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:5174',
  NEXT_PUBLIC_PLATFORM_URL: process.env.NEXT_PUBLIC_PLATFORM_URL || 'http://localhost:5176',
  NEXT_PUBLIC_CACHE_REVALIDATE_SECONDS: process.env.NEXT_PUBLIC_CACHE_REVALIDATE_SECONDS || 60,
  NEXT_PUBLIC_ANALYTICS_MODE: process.env.NEXT_PUBLIC_ANALYTICS_MODE || 'consent',
  NEXT_PUBLIC_ANALYTICS_PROVIDER: process.env.NEXT_PUBLIC_ANALYTICS_PROVIDER || 'first-party',
  NEXT_PUBLIC_ANALYTICS_COOKIELESS: process.env.NEXT_PUBLIC_ANALYTICS_COOKIELESS || 'true',
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN: process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || undefined,
  NEXT_PUBLIC_ANALYTICS_SCRIPT_URL: process.env.NEXT_PUBLIC_ANALYTICS_SCRIPT_URL || undefined,
  NEXT_PUBLIC_MARKETING_SCRIPT_URL: process.env.NEXT_PUBLIC_MARKETING_SCRIPT_URL || undefined,
});
