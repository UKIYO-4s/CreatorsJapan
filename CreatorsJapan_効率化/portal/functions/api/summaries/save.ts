/**
 * POST /api/summaries/save
 * 月次サマリー保存エンドポイント（管理者用）
 */

import {
  successResponse,
  errorBody,
  isValidSite,
  checkAdminAuth,
  type Env,
  type Site,
} from '../../../workers/api-utils';

interface SaveSummaryRequest {
  site: Site;
  yearMonth: string;
  gaSummary?: unknown;
  gscSummary?: unknown;
  articleCount?: number;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // 管理者チェック
  const authResult = checkAdminAuth(env, request);
  if (!authResult.authorized) {
    return Response.json(authResult.error, { status: 403 });
  }

  if (!env.DB) {
    return Response.json(errorBody('CONFIG_ERROR', 'D1が設定されていません'), { status: 500 });
  }

  let body: SaveSummaryRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json(errorBody('INVALID_BODY', 'リクエストボディが不正です'), { status: 400 });
  }

  if (!isValidSite(body.site)) {
    return Response.json(errorBody('INVALID_SITE', 'サイトの指定が不正です'), { status: 400 });
  }

  if (!body.yearMonth || !/^\d{4}-\d{2}$/.test(body.yearMonth)) {
    return Response.json(errorBody('INVALID_PERIOD', '期間の形式が不正です（YYYY-MM）'), { status: 400 });
  }

  try {
    await env.DB.prepare(
      `INSERT INTO monthly_summaries (site, year_month, ga_summary, gsc_summary, article_count)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(site, year_month) DO UPDATE SET
         ga_summary = excluded.ga_summary,
         gsc_summary = excluded.gsc_summary,
         article_count = excluded.article_count`
    ).bind(
      body.site,
      body.yearMonth,
      body.gaSummary ? JSON.stringify(body.gaSummary) : null,
      body.gscSummary ? JSON.stringify(body.gscSummary) : null,
      body.articleCount || 0
    ).run();

    return Response.json(successResponse({ saved: true }));
  } catch (error) {
    console.error('D1 error:', error);
    return Response.json(errorBody('D1_ERROR', 'データベースエラーが発生しました'), { status: 500 });
  }
};
