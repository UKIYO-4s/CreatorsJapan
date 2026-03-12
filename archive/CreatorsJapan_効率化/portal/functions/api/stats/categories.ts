/**
 * GET /api/stats/categories
 * カテゴリ別の記事数・投稿頻度
 * ?site=salon|public&months=3（過去N ヶ月の投稿数も返す）
 */

import {
  successResponse,
  errorBody,
  isValidSite,
  type Env,
} from '../../../workers/api-utils';

interface CategoryTotalRow {
  category: string;
  total: number;
}

interface CategoryRecentRow {
  category: string;
  count: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);

  const site = url.searchParams.get('site') || 'salon';
  const recentMonths = parseInt(url.searchParams.get('months') || '3', 10);

  if (!isValidSite(site)) {
    return Response.json(errorBody('INVALID_SITE', 'サイトの指定が不正です'), { status: 400 });
  }

  if (!env.DB) {
    return Response.json(errorBody('CONFIG_ERROR', 'Database not configured'), { status: 500 });
  }

  try {
    // 全期間の合計
    const totalsResult = await env.DB.prepare(`
      SELECT category, COUNT(*) as total
      FROM articles
      WHERE site = ? AND category IS NOT NULL
      GROUP BY category
      ORDER BY total DESC
    `).bind(site).all<CategoryTotalRow>();

    // 直近N ヶ月の件数
    const recentResult = await env.DB.prepare(`
      SELECT category, COUNT(*) as count
      FROM articles
      WHERE site = ?
        AND category IS NOT NULL
        AND published_date >= date('now', '-${recentMonths} months')
      GROUP BY category
      ORDER BY count DESC
    `).bind(site).all<CategoryRecentRow>();

    const recentMap: Record<string, number> = {};
    for (const row of recentResult.results || []) {
      recentMap[row.category] = row.count;
    }

    const categories = (totalsResult.results || []).map(row => ({
      category: row.category,
      total: row.total,
      [`recent${recentMonths}months`]: recentMap[row.category] || 0,
    }));

    return Response.json(successResponse({
      site,
      recentMonths,
      categories,
    }));
  } catch (error) {
    console.error('Category stats error:', error);
    return Response.json(errorBody('STATS_ERROR', '統計の取得に失敗しました'), { status: 500 });
  }
};
