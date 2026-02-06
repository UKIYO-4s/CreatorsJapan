/**
 * GET /api/summaries/:site
 * 月次サマリー一覧取得エンドポイント
 */

import {
  successResponse,
  errorBody,
  isValidSite,
  type Env,
} from '../../../workers/api-utils';

interface MonthlySummary {
  id: number;
  site: string;
  yearMonth: string;
  gaSummary: unknown | null;
  gscSummary: unknown | null;
  articleCount: number;
  discordNotifiedAt: string | null;
  createdAt: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const site = params.site as string;

  // サイト検証
  if (!isValidSite(site)) {
    return Response.json(errorBody('INVALID_SITE', 'サイトの指定が不正です'), { status: 400 });
  }

  if (!env.DB) {
    return Response.json(errorBody('CONFIG_ERROR', 'D1が設定されていません'), { status: 500 });
  }

  try {
    const result = await env.DB.prepare(
      `SELECT id, site, year_month as yearMonth, ga_summary as gaSummary,
              gsc_summary as gscSummary, article_count as articleCount,
              discord_notified_at as discordNotifiedAt, created_at as createdAt
       FROM monthly_summaries
       WHERE site = ?
       ORDER BY year_month DESC
       LIMIT 12`
    ).bind(site).all<MonthlySummary>();

    const summaries = result.results.map(row => ({
      ...row,
      gaSummary: row.gaSummary ? JSON.parse(row.gaSummary as string) : null,
      gscSummary: row.gscSummary ? JSON.parse(row.gscSummary as string) : null,
    }));

    return Response.json(successResponse(summaries));
  } catch (error) {
    console.error('D1 error:', error);
    return Response.json(errorBody('D1_ERROR', 'データベースエラーが発生しました'), { status: 500 });
  }
};
