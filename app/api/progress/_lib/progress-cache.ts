type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inflightLoads = new Map<string, Promise<unknown>>();

export function getProgressCache<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) {
    return null;
  }

  if (Date.now() >= entry.expiresAt) {
    cacheStore.delete(key);
    return null;
  }

  return entry.value as T;
}

export function setProgressCache<T>(key: string, value: T, ttlMs: number): T {
  cacheStore.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
}

export async function getOrLoadProgressCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  const cached = getProgressCache<T>(key);
  if (cached !== null) {
    return cached;
  }

  const existingLoad = inflightLoads.get(key);
  if (existingLoad) {
    return (await existingLoad) as T;
  }

  const loadPromise = loader()
    .then((value) => setProgressCache(key, value, ttlMs))
    .finally(() => {
      inflightLoads.delete(key);
    });

  inflightLoads.set(key, loadPromise);
  return (await loadPromise) as T;
}

export function invalidateProgressCacheByPrefix(prefix: string): void {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }

  for (const key of inflightLoads.keys()) {
    if (key.startsWith(prefix)) {
      inflightLoads.delete(key);
    }
  }
}

export function progressAllCacheKey(userId: string): string {
  return `progress:${userId}:all`;
}

export function progressSubjectCacheKey(userId: string, subject: string): string {
  return `progress:${userId}:subject:${subject.toLowerCase()}`;
}

export function progressUserPrefix(userId: string): string {
  return `progress:${userId}:`;
}
