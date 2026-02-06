/**
 * セッション管理
 * D1データベース + HTTPOnly Cookie
 */

const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 7日間
const SESSION_COOKIE_NAME = 'cj_session';

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

/**
 * セッション作成
 */
export async function createSession(db: D1Database, userId: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL);

  await db.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(sessionId, userId, expiresAt.toISOString()).run();

  return sessionId;
}

/**
 * セッション取得
 */
export async function getSession(db: D1Database, sessionId: string): Promise<Session | null> {
  const result = await db.prepare(`
    SELECT id, user_id, expires_at FROM sessions
    WHERE id = ? AND expires_at > datetime('now')
  `).bind(sessionId).first<{ id: string; user_id: string; expires_at: string }>();

  if (!result) return null;

  return {
    id: result.id,
    userId: result.user_id,
    expiresAt: new Date(result.expires_at),
  };
}

/**
 * セッション削除
 */
export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

/**
 * ユーザーの全セッション削除
 */
export async function deleteUserSessions(db: D1Database, userId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
}

/**
 * 期限切れセッションのクリーンアップ
 */
export async function cleanupExpiredSessions(db: D1Database): Promise<number> {
  const result = await db.prepare(`
    DELETE FROM sessions WHERE expires_at <= datetime('now')
  `).run();

  return result.meta.changes || 0;
}

/**
 * セッションCookieを設定
 */
export function setSessionCookie(sessionId: string): string {
  const expires = new Date(Date.now() + SESSION_TTL);
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expires.toUTCString()}`;
}

/**
 * セッションCookieをクリア
 */
export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

/**
 * CookieからセッションIDを取得
 */
export function getSessionIdFromCookie(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...val] = c.trim().split('=');
      return [key, val.join('=')];
    })
  );

  return cookies[SESSION_COOKIE_NAME] || null;
}
