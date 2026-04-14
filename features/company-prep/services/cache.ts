type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();

export function getCachedValue<T>(key: string): T | null {
  const entry = cacheStore.get(key);

  if (!entry) {
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number): T {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
}

export async function getOrSetCachedValue<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const cached = getCachedValue<T>(key);
  if (cached !== null) {
    return cached;
  }

  const loaded = await loader();
  return setCachedValue(key, loaded, ttlMs);
}

export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }
}
