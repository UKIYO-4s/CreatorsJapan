/**
 * POST /api/auth/login
 * ログイン処理
 */

import { successResponse, errorBody, type Env } from '../../../workers/api-utils';
import { verifyPassword } from '../../../workers/password';
import { createSession, setSessionCookie } from '../../../workers/session';
import { getUserByEmail, getUserWithPermissions } from '../../../workers/user-repository';

interface LoginRequest {
  email: string;
  password: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  if (!env.DB) {
    return Response.json(
      errorBody('CONFIG_ERROR', 'Database not configured'),
      { status: 500 }
    );
  }

  let body: LoginRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      errorBody('VALIDATION_ERROR', 'Invalid request body'),
      { status: 400 }
    );
  }

  const { email, password } = body;

  if (!email || !password) {
    return Response.json(
      errorBody('VALIDATION_ERROR', 'Email and password required'),
      { status: 400 }
    );
  }

  // ユーザー取得
  const user = await getUserByEmail(env.DB, email);

  if (!user) {
    return Response.json(
      errorBody('AUTH_INVALID', 'Invalid email or password'),
      { status: 401 }
    );
  }

  // パスワード検証
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return Response.json(
      errorBody('AUTH_INVALID', 'Invalid email or password'),
      { status: 401 }
    );
  }

  // セッション作成
  const sessionId = await createSession(env.DB, user.id);

  // ユーザー情報（権限付き）を取得
  const userData = await getUserWithPermissions(env.DB, user.id);

  return new Response(
    JSON.stringify(successResponse({ user: userData })),
    {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': setSessionCookie(sessionId),
      },
    }
  );
};
