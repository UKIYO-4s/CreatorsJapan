/**
 * ユーザーリポジトリ
 * D1データベースからのユーザーデータ取得
 */

import type { Site } from '../src/types';

export interface UserPermissions {
  dashboard: boolean;
  ga4: boolean;
  gsc: boolean;
  articles: boolean;
}

export interface UserWithPermissions {
  id: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  isActive: boolean;
  permissions: UserPermissions;
  sites: Site[];
  createdAt: string;
}

interface DBUser {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  is_admin: number;
  is_active: number;
  created_at: string;
}

interface DBPermissions {
  can_dashboard: number;
  can_ga4: number;
  can_gsc: number;
  can_articles: number;
}

/**
 * メールアドレスでユーザー取得（認証用）
 */
export async function getUserByEmail(db: D1Database, email: string): Promise<DBUser | null> {
  return db.prepare(`
    SELECT id, email, password_hash, display_name, is_admin, is_active, created_at
    FROM users WHERE email = ? AND is_active = 1
  `).bind(email.toLowerCase()).first<DBUser>();
}

/**
 * IDでユーザー取得（権限情報付き）
 */
export async function getUserWithPermissions(
  db: D1Database,
  userId: string
): Promise<UserWithPermissions | null> {
  // ユーザー取得
  const user = await db.prepare(`
    SELECT id, email, display_name, is_admin, is_active, created_at
    FROM users WHERE id = ?
  `).bind(userId).first<Omit<DBUser, 'password_hash'>>();

  if (!user) return null;

  // 権限取得
  const permissions = await db.prepare(`
    SELECT can_dashboard, can_ga4, can_gsc, can_articles
    FROM user_permissions WHERE user_id = ?
  `).bind(userId).first<DBPermissions>();

  // サイトアクセス取得
  const siteResults = await db.prepare(`
    SELECT site FROM user_site_access WHERE user_id = ?
  `).bind(userId).all<{ site: Site }>();

  const sites = siteResults.results?.map(r => r.site) || [];
  const isAdmin = user.is_admin === 1;

  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    isAdmin,
    isActive: user.is_active === 1,
    permissions: {
      dashboard: isAdmin || (permissions?.can_dashboard === 1),
      ga4: isAdmin || (permissions?.can_ga4 === 1),
      gsc: isAdmin || (permissions?.can_gsc === 1),
      articles: isAdmin || (permissions?.can_articles === 1),
    },
    sites: isAdmin ? ['public', 'salon'] : sites,
    createdAt: user.created_at,
  };
}

/**
 * 全ユーザー取得
 */
export async function getAllUsers(db: D1Database): Promise<UserWithPermissions[]> {
  const users = await db.prepare(`
    SELECT id FROM users ORDER BY created_at DESC
  `).all<{ id: string }>();

  const results: UserWithPermissions[] = [];
  for (const user of users.results || []) {
    const fullUser = await getUserWithPermissions(db, user.id);
    if (fullUser) results.push(fullUser);
  }

  return results;
}

/**
 * ユーザー作成
 */
export async function createUser(
  db: D1Database,
  data: {
    email: string;
    passwordHash: string;
    displayName?: string;
    isAdmin?: boolean;
  }
): Promise<string> {
  const userId = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, is_admin)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
    userId,
    data.email.toLowerCase(),
    data.passwordHash,
    data.displayName || null,
    data.isAdmin ? 1 : 0
  ).run();

  // デフォルト権限を作成
  await db.prepare(`
    INSERT INTO user_permissions (user_id, can_dashboard, can_ga4, can_gsc, can_articles)
    VALUES (?, 1, 0, 0, 0)
  `).bind(userId).run();

  return userId;
}

/**
 * ユーザー権限更新
 */
export async function updateUserPermissions(
  db: D1Database,
  userId: string,
  permissions: UserPermissions
): Promise<void> {
  await db.prepare(`
    INSERT OR REPLACE INTO user_permissions
    (user_id, can_dashboard, can_ga4, can_gsc, can_articles, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    userId,
    permissions.dashboard ? 1 : 0,
    permissions.ga4 ? 1 : 0,
    permissions.gsc ? 1 : 0,
    permissions.articles ? 1 : 0
  ).run();
}

/**
 * サイトアクセス更新
 */
export async function updateUserSites(
  db: D1Database,
  userId: string,
  sites: Site[]
): Promise<void> {
  // 既存を削除
  await db.prepare('DELETE FROM user_site_access WHERE user_id = ?').bind(userId).run();

  // 新規追加
  for (const site of sites) {
    await db.prepare(`
      INSERT INTO user_site_access (user_id, site) VALUES (?, ?)
    `).bind(userId, site).run();
  }
}

/**
 * ユーザー更新
 */
export async function updateUser(
  db: D1Database,
  userId: string,
  data: {
    displayName?: string;
    isAdmin?: boolean;
    isActive?: boolean;
  }
): Promise<void> {
  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (data.displayName !== undefined) {
    updates.push('display_name = ?');
    values.push(data.displayName);
  }
  if (data.isAdmin !== undefined) {
    updates.push('is_admin = ?');
    values.push(data.isAdmin ? 1 : 0);
  }
  if (data.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(data.isActive ? 1 : 0);
  }

  if (updates.length === 0) return;

  updates.push('updated_at = datetime(\'now\')');
  values.push(userId);

  await db.prepare(`
    UPDATE users SET ${updates.join(', ')} WHERE id = ?
  `).bind(...values).run();
}

/**
 * ユーザー削除
 */
export async function deleteUser(db: D1Database, userId: string): Promise<void> {
  // CASCADE設定でrelatedテーブルも削除される
  await db.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
}
