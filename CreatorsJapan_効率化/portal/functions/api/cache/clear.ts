/**
 * POST /api/cache/clear
 * キャッシュクリアエンドポイント（管理者用）
 */

import {
  successResponse,
  errorBody,
  checkAdminAuth,
  type Env,
} from '../../../workers/api-utils';

interface ClearRequestBody {
  prefix?: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // 管理者チェック
  const authResult = checkAdminAuth(env, request);
  if (!authResult.authorized) {
    return Response.json(authResult.error, { status: 403 });
  }

  if (!env.CACHE) {
    return Response.json(errorBody('CONFIG_ERROR', 'KVが設定されていません'), { status: 500 });
  }

  let body: ClearRequestBody = {};
  try {
    body = await request.json();
  } catch {
    // ボディがない場合は空オブジェクトで続行
  }

  // 全キャッシュまたは指定プレフィックスを削除
  let deleted = 0;
  let cursor: string | undefined;

  do {
    const result = await env.CACHE.list({
      prefix: body.prefix,
      cursor,
    });

    for (const key of result.keys) {
      await env.CACHE.delete(key.name);
      deleted++;
    }

    cursor = result.list_complete ? undefined : result.cursor;
  } while (cursor);

  return Response.json(successResponse({ cleared: deleted }));
};
