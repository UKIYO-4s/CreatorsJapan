/**
 * KVキャッシュユーティリティ
 * TTL付きキャッシュの取得・保存・削除を提供
 */

export interface CacheEntry<T> {
  data: T;
  cachedAt: string;
  expiresAt: string;
}

export interface CacheOptions {
  /** TTL in seconds (default: 3600 = 1 hour) */
  ttl?: number;
}

const DEFAULT_TTL = 3600; // 1 hour

/**
 * キャッシュからデータを取得
 */
export async function getCache<T>(
  kv: KVNamespace,
  key: string
): Promise<CacheEntry<T> | null> {
  try {
    const raw = await kv.get(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;

    // 有効期限チェック
    if (new Date(entry.expiresAt) < new Date()) {
      await kv.delete(key);
      return null;
    }

    return entry;
  } catch (error) {
    console.error(`KV get error for key ${key}:`, error);
    return null;
  }
}

/**
 * キャッシュにデータを保存
 */
export async function setCache<T>(
  kv: KVNamespace,
  key: string,
  data: T,
  options: CacheOptions = {}
): Promise<void> {
  const ttl = options.ttl ?? DEFAULT_TTL;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttl * 1000);

  const entry: CacheEntry<T> = {
    data,
    cachedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  try {
    await kv.put(key, JSON.stringify(entry), {
      expirationTtl: ttl,
    });
  } catch (error) {
    console.error(`KV set error for key ${key}:`, error);
    throw error;
  }
}

/**
 * キャッシュを削除
 */
export async function deleteCache(
  kv: KVNamespace,
  key: string
): Promise<void> {
  try {
    await kv.delete(key);
  } catch (error) {
    console.error(`KV delete error for key ${key}:`, error);
  }
}

/**
 * パターンに一致するキャッシュを一括削除
 */
export async function clearCacheByPrefix(
  kv: KVNamespace,
  prefix: string
): Promise<number> {
  let deleted = 0;
  let cursor: string | undefined;

  do {
    const result = await kv.list({ prefix, cursor });

    for (const key of result.keys) {
      await kv.delete(key.name);
      deleted++;
    }

    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return deleted;
}

/**
 * キャッシュキー生成ヘルパー
 */
export const CacheKeys = {
  articles: (site: string) => `articles:${site}`,
  ga: (site: string, period: string) => `ga:${site}:${period}`,
  gsc: (site: string, period: string) => `gsc:${site}:${period}`,
  summary: (site: string, yearMonth: string) => `summary:${site}:${yearMonth}`,
};

/**
 * キャッシュTTL定数
 */
export const CacheTTL = {
  ARTICLES: 300,      // 5 minutes
  GA_REPORT: 3600,    // 1 hour
  GSC_REPORT: 3600,   // 1 hour
  SUMMARY: 86400,     // 24 hours
};
