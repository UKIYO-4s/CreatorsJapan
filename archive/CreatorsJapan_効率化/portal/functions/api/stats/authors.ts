/**
 * GET /api/stats/authors
 * 執筆者別の投稿統計
 * ?site=salon|public&months=6（過去N ヶ月、省略時は全期間）
 */

import {
  successResponse,
  errorBody,
  isValidSite,
  type Env,
} from '../../../workers/api-utils';

interface AuthorTotalRow {
  author: string;
  total: number;
}

interface AuthorMonthRow {
  author: string;
  month: string;
  count: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);

  const site = url.searchParams.get('site') || 'salon';
  const months = parseInt(url.searchParams.get('months') || '0', 10); // 0=全期間

  if (!isValidSite(site)) {
    return Response.json(errorBody('INVALID_SITE', 'サイトの指定が不正です'), { status: 400 });
  }

  if (!env.DB) {
    return Response.json(errorBody('CONFIG_ERROR', 'Database not configured'), { status: 500 });
  }

  try {
    const dateCondition = months > 0
      ? `AND published_date >= date('now', '-${months} months')`
      : '';

    // 執筆者別 合計
    const totalsResult = await env.DB.prepare(`
      SELECT author, COUNT(*) as total
      FROM articles
      WHERE site = ? AND author IS NOT NULL ${dateCondition}
      GROUP BY author
      ORDER BY total DESC
    `).bind(site).all<AuthorTotalRow>();

    // 執筆者別 月別
    const monthlyResult = await env.DB.prepare(`
      SELECT author, strftime('%Y-%m', published_date) as month, COUNT(*) as count
      FROM articles
      WHERE site = ? AND author IS NOT NULL ${dateCondition}
      GROUP BY author, month
      ORDER BY month DESC, count DESC
    `).bind(site).all<AuthorMonthRow>();

    // 月別をネスト構造に変換
    const monthlyByAuthor: Record<string, Record<string, number>> = {};
    for (const row of monthlyResult.results || []) {
      if (!monthlyByAuthor[row.author]) monthlyByAuthor[row.author] = {};
      monthlyByAuthor[row.author][row.month] = row.count;
    }

    const authors = (totalsResult.results || []).map(row => ({
      author: row.author,
      total: row.total,
      monthly: monthlyByAuthor[row.author] || {},
    }));

    return Response.json(successResponse({
      site,
      period: months > 0 ? `過去${months}ヶ月` : '全期間',
      authors,
    }));
  } catch (error) {
    console.error('Author stats error:', error);
    return Response.json(errorBody('STATS_ERROR', '統計の取得に失敗しました'), { status: 500 });
  }
};
