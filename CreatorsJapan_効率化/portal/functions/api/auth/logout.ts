/**
 * POST /api/auth/logout
 * ログアウト処理
 */

import { successResponse, type Env } from '../../../workers/api-utils';
import { getSessionIdFromCookie, deleteSession, clearSessionCookie } from '../../../workers/session';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  if (!env.DB) {
    return new Response(
      JSON.stringify(successResponse({ loggedOut: true })),
      {
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': clearSessionCookie(),
        },
      }
    );
  }

  // セッションID取得
  const sessionId = getSessionIdFromCookie(request);

  if (sessionId) {
    // セッション削除
    await deleteSession(env.DB, sessionId);
  }

  return new Response(
    JSON.stringify(successResponse({ loggedOut: true })),
    {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': clearSessionCookie(),
      },
    }
  );
};
