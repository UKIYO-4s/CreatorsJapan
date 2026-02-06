/**
 * API共通ユーティリティ
 * レスポンス生成、バリデーション、設定取得
 */

// ========================================
// 型定義
// ========================================

export type Site = 'public' | 'salon';
export type StatusCode = 400 | 401 | 403 | 404 | 500 | 502;

export interface Env {
  CACHE?: KVNamespace;
  DB?: D1Database;
  GOOGLE_SERVICE_ACCOUNT_KEY?: string;
  DISCORD_WEBHOOK_URL_PUBLIC?: string;
  DISCORD_WEBHOOK_URL_SALON?: string;
  GA4_PROPERTY_ID_PUBLIC?: string;
  GA4_PROPERTY_ID_SALON?: string;
  ADMIN_EMAILS?: string;
  SITE_URL_PUBLIC?: string;
  SITE_URL_SALON?: string;
}

export interface SiteConfig {
  url: string;
  ga4PropertyId?: string;
  discordWebhookUrl?: string;
  name: string;
}

// ========================================
// レスポンス生成
// ========================================

export function successResponse<T>(data: T, fromCache = false, cachedAt?: string) {
  return {
    success: true as const,
    data,
    meta: {
      fromCache,
      cachedAt,
      requestId: crypto.randomUUID(),
    },
  };
}

export function errorBody(code: string, message: string) {
  return {
    success: false as const,
    error: { code, message },
    meta: { requestId: crypto.randomUUID() },
  };
}

// ========================================
// バリデーション
// ========================================

export function isValidSite(site: string): site is Site {
  return site === 'public' || site === 'salon';
}

// ========================================
// 設定取得
// ========================================

export function getSiteConfig(site: Site, env: Env): SiteConfig {
  if (site === 'public') {
    return {
      url: env.SITE_URL_PUBLIC || 'https://creators-jp.com',
      ga4PropertyId: env.GA4_PROPERTY_ID_PUBLIC,
      discordWebhookUrl: env.DISCORD_WEBHOOK_URL_PUBLIC,
      name: 'CREATORS JAPAN 公式サイト',
    };
  } else {
    return {
      url: env.SITE_URL_SALON || 'https://salon.creators-jp.com',
      ga4PropertyId: env.GA4_PROPERTY_ID_SALON,
      discordWebhookUrl: env.DISCORD_WEBHOOK_URL_SALON,
      name: 'CREATORS JAPAN サロン',
    };
  }
}

// ========================================
// 認証ヘルパー
// ========================================

export function parseAdminEmails(adminEmailsJson: string | undefined): string[] {
  if (!adminEmailsJson) return [];
  try {
    const parsed = JSON.parse(adminEmailsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function isAdmin(env: Env, request: Request): boolean {
  // 開発モード
  if (request.headers.get('X-Dev-Mode') === 'true') {
    return true;
  }

  const userEmail = request.headers.get('CF-Access-Authenticated-User-Email');
  if (!userEmail) return false;

  const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);
  return adminEmails.includes(userEmail);
}

export function checkAdminAuth(env: Env, request: Request): { authorized: boolean; error?: ReturnType<typeof errorBody> } {
  if (isAdmin(env, request)) {
    return { authorized: true };
  }
  return {
    authorized: false,
    error: errorBody('ADMIN_REQUIRED', '管理者権限が必要です'),
  };
}

// ========================================
// セッションベース認証ヘルパー
// ========================================

import { getSessionIdFromCookie, getSession } from './session';
import { getUserWithPermissions, type UserWithPermissions } from './user-repository';

export interface AuthResult {
  authorized: boolean;
  user?: UserWithPermissions;
  error?: ReturnType<typeof errorBody>;
  status?: number;
}

/**
 * セッション認証チェック
 */
export async function requireAuth(env: Env, request: Request): Promise<AuthResult> {
  if (!env.DB) {
    return {
      authorized: false,
      error: errorBody('CONFIG_ERROR', 'Database not configured'),
      status: 500,
    };
  }

  const sessionId = getSessionIdFromCookie(request);
  if (!sessionId) {
    return {
      authorized: false,
      error: errorBody('AUTH_REQUIRED', 'Authentication required'),
      status: 401,
    };
  }

  const session = await getSession(env.DB, sessionId);
  if (!session) {
    return {
      authorized: false,
      error: errorBody('AUTH_EXPIRED', 'Session expired'),
      status: 401,
    };
  }

  const user = await getUserWithPermissions(env.DB, session.userId);
  if (!user || !user.isActive) {
    return {
      authorized: false,
      error: errorBody('AUTH_INVALID', 'User not found or disabled'),
      status: 401,
    };
  }

  return { authorized: true, user };
}

/**
 * 管理者認証チェック（セッションベース）
 */
export async function requireAdmin(env: Env, request: Request): Promise<AuthResult> {
  const authResult = await requireAuth(env, request);
  if (!authResult.authorized) {
    return authResult;
  }

  if (!authResult.user?.isAdmin) {
    return {
      authorized: false,
      error: errorBody('ADMIN_REQUIRED', 'Administrator access required'),
      status: 403,
    };
  }

  return authResult;
}
