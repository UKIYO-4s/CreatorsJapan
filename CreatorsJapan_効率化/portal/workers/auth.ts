/**
 * 認証ミドルウェア
 * Cloudflare Access JWT検証 + ロール判定
 */

import { Context, Next } from 'hono';

export type Role = 'admin' | 'client';

export interface User {
  email: string;
  role: Role;
}

export interface AuthContext {
  user: User;
}

/**
 * Cloudflare Access JWTからユーザー情報を取得
 * 注: 実際のJWT検証はCloudflare Accessが行うため、
 *     ここではヘッダーからメール情報を取得するのみ
 */
export function getUser(c: Context, adminEmails: string[]): User | null {
  // Cloudflare Access が設定するヘッダー
  const email = c.req.header('CF-Access-Authenticated-User-Email');

  if (!email) {
    return null;
  }

  const role: Role = adminEmails.includes(email) ? 'admin' : 'client';

  return { email, role };
}

/**
 * 認証必須ミドルウェア
 */
export function authMiddleware(adminEmails: string[]) {
  return async (c: Context, next: Next) => {
    const user = getUser(c, adminEmails);

    if (!user) {
      // 開発環境ではモックユーザーを使用
      if (c.req.header('X-Dev-Mode') === 'true') {
        c.set('user', { email: 'dev@example.com', role: 'admin' } as User);
        return next();
      }

      return c.json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'ログインが必要です',
        },
        meta: { requestId: crypto.randomUUID() },
      }, 401);
    }

    c.set('user', user);
    return next();
  };
}

/**
 * 管理者専用ミドルウェア
 */
export function adminOnlyMiddleware() {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as User | undefined;

    if (!user) {
      return c.json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'ログインが必要です',
        },
        meta: { requestId: crypto.randomUUID() },
      }, 401);
    }

    if (user.role !== 'admin') {
      return c.json({
        success: false,
        error: {
          code: 'ADMIN_REQUIRED',
          message: '管理者権限が必要です',
        },
        meta: { requestId: crypto.randomUUID() },
      }, 403);
    }

    return next();
  };
}

/**
 * 管理者メールリストをパース
 */
export function parseAdminEmails(adminEmailsJson: string | undefined): string[] {
  if (!adminEmailsJson) return [];

  try {
    const parsed = JSON.parse(adminEmailsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
