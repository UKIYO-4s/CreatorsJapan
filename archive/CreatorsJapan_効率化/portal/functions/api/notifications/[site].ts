/**
 * GET /api/notifications/:site
 * 通知ログ一覧取得エンドポイント
 */

import {
  successResponse,
  errorBody,
  isValidSite,
  checkAdminAuth,
  type Env,
} from '../../../workers/api-utils';

interface NotificationLog {
  id: number;
  site: string;
  type: string;
  status: string;
  message: string | null;
  createdAt: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const site = params.site as string;

  // 管理者チェック
  const authResult = checkAdminAuth(env, request);
  if (!authResult.authorized) {
    return Response.json(authResult.error, { status: 403 });
  }

  // サイト検証
  if (!isValidSite(site)) {
    return Response.json(errorBody('INVALID_SITE', 'サイトの指定が不正です'), { status: 400 });
  }

  if (!env.DB) {
    return Response.json(errorBody('CONFIG_ERROR', 'D1が設定されていません'), { status: 500 });
  }

  try {
    const result = await env.DB.prepare(
      `SELECT id, site, type, status, message, created_at as createdAt
       FROM notification_logs
       WHERE site = ?
       ORDER BY created_at DESC
       LIMIT 50`
    ).bind(site).all<NotificationLog>();

    return Response.json(successResponse(result.results));
  } catch (error) {
    console.error('D1 error:', error);
    return Response.json(errorBody('D1_ERROR', 'データベースエラーが発生しました'), { status: 500 });
  }
};
