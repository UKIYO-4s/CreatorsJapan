/**
 * GET /api/articles/search
 * タイトルキーワード検索（LIKE検索）
 * ?q=キーワード&site=salon|public&limit=50
 */

import {
  successResponse,
  errorBody,
  type Env,
} from '../../../workers/api-utils';

interface ArticleRow {
  id: number;
  site: string;
  url: string;
  title: string;
  published_date: string;
  category: string | null;
  author: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const url = new URL(request.url);

  const q = url.searchParams.get('q')?.trim();
  const site = url.searchParams.get('site') || undefined;
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));

  if (!q || q.length < 1) {
    return Response.json(errorBody('MISSING_QUERY', '検索キーワードを指定してください'), { status: 400 });
  }

  if (!env.DB) {
    return Response.json(errorBody('CONFIG_ERROR', 'Database not configured'), { status: 500 });
  }

  try {
    const conditions: string[] = ['title LIKE ?'];
    const params: (string | number)[] = [`%${q}%`];

    if (site === 'salon' || site === 'public') {
      conditions.push('site = ?');
      params.push(site);
    }

    const whereClause = conditions.join(' AND ');

    const result = await env.DB.prepare(`
      SELECT id, site, url, title, published_date, category, author
      FROM articles
      WHERE ${whereClause}
      ORDER BY published_date DESC
      LIMIT ?
    `).bind(...params, limit).all<ArticleRow>();

    const articles = (result.results || []).map(row => ({
      id: row.id,
      site: row.site,
      url: row.url,
      title: row.title,
      publishedDate: row.published_date,
      category: row.category || undefined,
      author: row.author || undefined,
    }));

    return Response.json(successResponse({ query: q, count: articles.length, articles }));
  } catch (error) {
    console.error('Search error:', error);
    return Response.json(errorBody('SEARCH_ERROR', '検索に失敗しました'), { status: 500 });
  }
};
