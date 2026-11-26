import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export interface CachedCmsEntry<T> {
  key: string;
  data: T;
  cachedAt: string;
}

export type CmsFetchSource = 'live' | 'last_good_cache' | 'not_found' | 'unavailable';

export interface CmsFetchResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  source: CmsFetchSource;
  cachedAt?: string;
}

export interface FetchCmsJsonOptions {
  cacheKey: string;
  url: string;
  revalidateSeconds?: number;
  tags?: string[];
  timeoutMs?: number;
  treat404AsAuthoritative?: boolean;
  cacheMode?: RequestCache;
}

const MAX_MEMORY_ENTRIES = 500;
const DISK_CACHE_DIR = path.join(process.cwd(), '.next', 'cache', 'cms-fallback');

const globalCacheStore = globalThis as typeof globalThis & {
  __hrmCmsLastGoodCache?: Map<string, CachedCmsEntry<unknown>>;
  __hrmCmsDiskDirReady?: boolean;
};

function getMemoryStore(): Map<string, CachedCmsEntry<unknown>> {
  if (!globalCacheStore.__hrmCmsLastGoodCache) {
    globalCacheStore.__hrmCmsLastGoodCache = new Map();
  }
  return globalCacheStore.__hrmCmsLastGoodCache;
}

function getDiskFilePath(cacheKey: string): string {
  const hash = createHash('sha256').update(cacheKey).digest('hex').slice(0, 32);
  return path.join(DISK_CACHE_DIR, `${hash}.json`);
}

function ensureDiskDir(): boolean {
  if (globalCacheStore.__hrmCmsDiskDirReady) return true;
  try {
    fs.mkdirSync(DISK_CACHE_DIR, { recursive: true });
    globalCacheStore.__hrmCmsDiskDirReady = true;
    return true;
  } catch {
    return false;
  }
}

export function readLastGoodCmsCache<T>(cacheKey: string): CachedCmsEntry<T> | null {
  const mem = getMemoryStore();
  const inMem = mem.get(cacheKey) as CachedCmsEntry<T> | undefined;
  if (inMem) {
    return inMem;
  }

  try {
    const filePath = getDiskFilePath(cacheKey);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw) as CachedCmsEntry<T>;
    if (!parsed || typeof parsed !== 'object' || parsed.key !== cacheKey) {
      return null;
    }
    mem.set(cacheKey, parsed as CachedCmsEntry<unknown>);
    return parsed;
  } catch {
    return null;
  }
}

export function writeLastGoodCmsCache<T>(cacheKey: string, data: T): CachedCmsEntry<T> {
  const entry: CachedCmsEntry<T> = {
    key: cacheKey,
    data,
    cachedAt: new Date().toISOString(),
  };

  const mem = getMemoryStore();
  if (mem.size >= MAX_MEMORY_ENTRIES && !mem.has(cacheKey)) {
    const oldestKey = mem.keys().next().value;
    if (oldestKey) mem.delete(oldestKey);
  }
  mem.set(cacheKey, entry as CachedCmsEntry<unknown>);

  try {
    if (ensureDiskDir()) {
      fs.writeFileSync(getDiskFilePath(cacheKey), JSON.stringify(entry), 'utf8');
    }
  } catch {
    // Disk cache persistence is best-effort (never fail requests on read-only FS)
  }

  return entry;
}

export function evictCmsLastGoodCache(options?: {
  keys?: readonly string[];
  prefixes?: readonly string[];
  clearAll?: boolean;
}): number {
  const mem = getMemoryStore();
  let removed = 0;

  const deleteEntry = (key: string) => {
    if (mem.delete(key)) {
      removed++;
    }
    try {
      const filePath = getDiskFilePath(key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // ignore disk cleanup errors
    }
  };

  if (options?.clearAll) {
    const allKeys = Array.from(mem.keys());
    for (const key of allKeys) {
      deleteEntry(key);
    }
    try {
      if (fs.existsSync(DISK_CACHE_DIR)) {
        for (const file of fs.readdirSync(DISK_CACHE_DIR)) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(DISK_CACHE_DIR, file));
          }
        }
      }
    } catch {
      // ignore
    }
    return removed;
  }

  if (options?.keys) {
    for (const k of options.keys) {
      deleteEntry(k);
    }
  }

  if (options?.prefixes && options.prefixes.length > 0) {
    for (const key of Array.from(mem.keys())) {
      if (options.prefixes.some((prefix) => key.startsWith(prefix))) {
        deleteEntry(key);
      }
    }
  }

  return removed;
}

/**
 * Fetches JSON from the CMS / Public Content API using Next.js ISR/tag revalidation
 * (`stale-while-revalidate` + bounded network timeout). If the API is unreachable or
 * returns 5xx, automatically serves the last known good cached copy instead of failing.
 */
export async function fetchCmsJsonWithFallback<T>(
  options: FetchCmsJsonOptions,
): Promise<CmsFetchResult<T>> {
  const {
    cacheKey,
    url,
    revalidateSeconds = 60,
    tags,
    timeoutMs = 3500,
    treat404AsAuthoritative = true,
    cacheMode,
  } = options;

  try {
    const fetchInit: RequestInit & {
      next?: { revalidate?: number | false; tags?: string[] };
    } = {
      signal: AbortSignal.timeout(timeoutMs),
    };

    if (cacheMode === 'no-store') {
      fetchInit.cache = 'no-store';
    } else {
      fetchInit.next = {
        revalidate: revalidateSeconds,
        ...(tags && tags.length > 0 ? { tags } : {}),
      };
    }

    const res = await fetch(url, fetchInit);

    if (res.ok) {
      const json = (await res.json()) as T;
      const saved = writeLastGoodCmsCache(cacheKey, json);
      return {
        ok: true,
        status: res.status,
        data: json,
        source: 'live',
        cachedAt: saved.cachedAt,
      };
    }

    if (res.status === 404 && treat404AsAuthoritative) {
      evictCmsLastGoodCache({ keys: [cacheKey] });
      return {
        ok: false,
        status: 404,
        data: null,
        source: 'not_found',
      };
    }

    // Upstream 5xx or transient failure: fall back to last good copy
    const cached = readLastGoodCmsCache<T>(cacheKey);
    if (cached) {
      return {
        ok: true,
        status: res.status,
        data: cached.data,
        source: 'last_good_cache',
        cachedAt: cached.cachedAt,
      };
    }

    return {
      ok: false,
      status: res.status,
      data: null,
      source: 'unavailable',
    };
  } catch {
    // Network unreachable / timeout / JSON parse error: fall back to last good copy
    const cached = readLastGoodCmsCache<T>(cacheKey);
    if (cached) {
      return {
        ok: true,
        status: 200,
        data: cached.data,
        source: 'last_good_cache',
        cachedAt: cached.cachedAt,
      };
    }

    return {
      ok: false,
      status: 503,
      data: null,
      source: 'unavailable',
    };
  }
}
