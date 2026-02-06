/**
 * GET /api/auth/me
 * 現在のユーザー情報を取得
 */

import { successResponse, errorBody, type Env } from '../../../workers/api-utils';
import { getSessionIdFromCookie, getSession } from '../../../workers/session';
import { getUserWithPermissions } from '../../../workers/user-repository';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  if (!env.DB) {
    return Response.json(
      errorBody('CONFIG_ERROR', 'Database not configured'),
      { status: 500 }
    );
  }

  // セッションID取得
  const sessionId = getSessionIdFromCookie(request);
  if (!sessionId) {
    return Response.json(
      errorBody('AUTH_REQUIRED', 'Not authenticated'),
      { status: 401 }
    );
  }

  // セッション検証
  const session = await getSession(env.DB, sessionId);
  if (!session) {
    return Response.json(
      errorBody('AUTH_EXPIRED', 'Session expired'),
      { status: 401 }
    );
  }

  // ユーザー情報取得
  const user = await getUserWithPermissions(env.DB, session.userId);
  if (!user) {
    return Response.json(
      errorBody('AUTH_INVALID', 'User not found'),
      { status: 401 }
    );
  }

  if (!user.isActive) {
    return Response.json(
      errorBody('AUTH_INVALID', 'Account disabled'),
      { status: 401 }
    );
  }

  return Response.json(successResponse({ user }));
};
