/**
 * GET /api/users/:id - ユーザー詳細
 * PUT /api/users/:id - ユーザー更新
 * DELETE /api/users/:id - ユーザー削除
 */

import { successResponse, errorBody, requireAdmin, type Env } from '../../../workers/api-utils';
import {
  getUserWithPermissions,
  updateUser,
  updateUserPermissions,
  updateUserSites,
  deleteUser,
} from '../../../workers/user-repository';
import { hashPassword } from '../../../workers/password';
import { deleteUserSessions } from '../../../workers/session';
import type { Site } from '../../../src/types';

interface UpdateUserRequest {
  displayName?: string;
  password?: string;
  isAdmin?: boolean;
  isActive?: boolean;
  permissions?: {
    dashboard: boolean;
    ga4: boolean;
    gsc: boolean;
    articles: boolean;
  };
  sites?: Site[];
}

// GET /api/users/:id
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const userId = params.id as string;

  // 管理者認証チェック
  const authResult = await requireAdmin(env, request);
  if (!authResult.authorized) {
    return Response.json(authResult.error, { status: authResult.status });
  }

  const user = await getUserWithPermissions(env.DB!, userId);
  if (!user) {
    return Response.json(
      errorBody('NOT_FOUND', 'User not found'),
      { status: 404 }
    );
  }

  return Response.json(successResponse(user));
};

// PUT /api/users/:id
export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const userId = params.id as string;

  // 管理者認証チェック
  const authResult = await requireAdmin(env, request);
  if (!authResult.authorized) {
    return Response.json(authResult.error, { status: authResult.status });
  }

  // ユーザー存在確認
  const existing = await getUserWithPermissions(env.DB!, userId);
  if (!existing) {
    return Response.json(
      errorBody('NOT_FOUND', 'User not found'),
      { status: 404 }
    );
  }

  let body: UpdateUserRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      errorBody('VALIDATION_ERROR', 'Invalid request body'),
      { status: 400 }
    );
  }

  const { displayName, password, isAdmin, isActive, permissions, sites } = body;

  // パスワード変更
  if (password) {
    if (password.length < 8) {
      return Response.json(
        errorBody('VALIDATION_ERROR', 'Password must be at least 8 characters'),
        { status: 400 }
      );
    }
    const passwordHash = await hashPassword(password);
    await env.DB!.prepare(
      'UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(passwordHash, userId).run();

    // 既存セッションを削除（セキュリティ）
    await deleteUserSessions(env.DB!, userId);
  }

  // ユーザー基本情報更新
  await updateUser(env.DB!, userId, {
    displayName,
    isAdmin,
    isActive,
  });

  // 権限更新
  if (permissions) {
    await updateUserPermissions(env.DB!, userId, permissions);
  }

  // サイトアクセス更新
  if (sites !== undefined) {
    await updateUserSites(env.DB!, userId, sites);
  }

  // 更新後のユーザー情報を取得
  const updatedUser = await getUserWithPermissions(env.DB!, userId);

  return Response.json(successResponse(updatedUser));
};

// DELETE /api/users/:id
export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const userId = params.id as string;

  // 管理者認証チェック
  const authResult = await requireAdmin(env, request);
  if (!authResult.authorized) {
    return Response.json(authResult.error, { status: authResult.status });
  }

  // 自分自身は削除不可
  if (authResult.user?.id === userId) {
    return Response.json(
      errorBody('VALIDATION_ERROR', 'Cannot delete yourself'),
      { status: 400 }
    );
  }

  // ユーザー存在確認
  const existing = await getUserWithPermissions(env.DB!, userId);
  if (!existing) {
    return Response.json(
      errorBody('NOT_FOUND', 'User not found'),
      { status: 404 }
    );
  }

  // ユーザー削除（CASCADE設定で関連データも削除）
  await deleteUser(env.DB!, userId);

  return Response.json(successResponse({ deleted: true }));
};
