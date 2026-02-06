/**
 * GET /api/users - ユーザー一覧
 * POST /api/users - ユーザー作成
 */

import { successResponse, errorBody, requireAdmin, type Env } from '../../../workers/api-utils';
import { getAllUsers, createUser, updateUserPermissions, updateUserSites } from '../../../workers/user-repository';
import { hashPassword } from '../../../workers/password';
import type { Site } from '../../../src/types';

interface CreateUserRequest {
  email: string;
  password: string;
  displayName?: string;
  isAdmin?: boolean;
  permissions?: {
    dashboard: boolean;
    ga4: boolean;
    gsc: boolean;
    articles: boolean;
  };
  sites?: Site[];
}

// GET /api/users
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // 管理者認証チェック
  const authResult = await requireAdmin(env, request);
  if (!authResult.authorized) {
    return Response.json(authResult.error, { status: authResult.status });
  }

  const users = await getAllUsers(env.DB!);
  return Response.json(successResponse(users));
};

// POST /api/users
export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // 管理者認証チェック
  const authResult = await requireAdmin(env, request);
  if (!authResult.authorized) {
    return Response.json(authResult.error, { status: authResult.status });
  }

  let body: CreateUserRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      errorBody('VALIDATION_ERROR', 'Invalid request body'),
      { status: 400 }
    );
  }

  const { email, password, displayName, isAdmin, permissions, sites } = body;

  // バリデーション
  if (!email || !password) {
    return Response.json(
      errorBody('VALIDATION_ERROR', 'Email and password required'),
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return Response.json(
      errorBody('VALIDATION_ERROR', 'Password must be at least 8 characters'),
      { status: 400 }
    );
  }

  // メールアドレスの重複チェック
  const existing = await env.DB!.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email.toLowerCase()).first();

  if (existing) {
    return Response.json(
      errorBody('VALIDATION_ERROR', 'Email already exists'),
      { status: 400 }
    );
  }

  // パスワードハッシュ化
  const passwordHash = await hashPassword(password);

  // ユーザー作成
  const userId = await createUser(env.DB!, {
    email,
    passwordHash,
    displayName,
    isAdmin,
  });

  // 権限設定
  if (permissions) {
    await updateUserPermissions(env.DB!, userId, permissions);
  }

  // サイトアクセス設定
  if (sites && sites.length > 0) {
    await updateUserSites(env.DB!, userId, sites);
  }

  return Response.json(successResponse({ id: userId, created: true }));
};
