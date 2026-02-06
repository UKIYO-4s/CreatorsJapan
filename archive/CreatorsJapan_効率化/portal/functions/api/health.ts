/**
 * GET /api/health
 * ヘルスチェックエンドポイント
 */

import { successResponse, type Env } from '../../workers/api-utils';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  return Response.json(successResponse({
    status: 'ok',
    timestamp: new Date().toISOString(),
    bindings: {
      kv: !!env.CACHE,
      d1: !!env.DB,
    },
  }));
};
