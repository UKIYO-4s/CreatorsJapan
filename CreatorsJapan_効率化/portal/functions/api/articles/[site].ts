/**
 * GET /api/articles/:site
 * 記事一覧取得エンドポイント（D1 + フィルター + ページネーション対応）
 */

import {
  successResponse,
  errorBody,
  isValidSite,
  type Env,
} from '../../../workers/api-utils';

interface ArticleRow {
  id: number;
  site: string;
  wp_id: number | null;
  url: string;
  title: string;
  published_date: string;
  category: string | null;
  author: string | null;
  og_image: string | null;
  excerpt: string | null;
}

interface ArticleSyncRow {
  site: string;
  last_sync_at: string | null;
  total_count: number;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const site = params.site as string;

  // サイト検証
  if (!isValidSite(site)) {
    return Response.json(errorBody('INVALID_SITE', 'サイトの指定が不正です'), { status: 400 });
  }

  const url = new URL(request.url);

  // クエリパラメータ
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const category = url.searchParams.get('category') || undefined;
  const author = url.searchParams.get('author') || undefined;
  const month = url.searchParams.get('month') || undefined; // YYYY-MM format

  const offset = (page - 1) * limit;

  if (!env.DB) {
    return Response.json(errorBody('CONFIG_ERROR', 'Database not configured'), { status: 500 });
  }

  try {
    // WHERE句の構築
    const conditions: string[] = ['site = ?'];
    const params_list: (string | number)[] = [site];

    if (category) {
      conditions.push('category = ?');
      params_list.push(category);
    }

    if (author && site === 'salon') {
      conditions.push('author = ?');
      params_list.push(author);
    }

    if (month) {
      // YYYY-MM形式で月フィルター
      conditions.push("strftime('%Y-%m', published_date) = ?");
      params_list.push(month);
    }

    const whereClause = conditions.join(' AND ');

    // 記事取得
    const articlesQuery = `
      SELECT id, site, wp_id, url, title, published_date, category, author, og_image, excerpt
      FROM articles
      WHERE ${whereClause}
      ORDER BY published_date DESC
      LIMIT ? OFFSET ?
    `;
    const articlesResult = await env.DB.prepare(articlesQuery)
      .bind(...params_list, limit, offset)
      .all<ArticleRow>();

    // 総件数取得
    const countQuery = `SELECT COUNT(*) as count FROM articles WHERE ${whereClause}`;
    const countResult = await env.DB.prepare(countQuery)
      .bind(...params_list)
      .first<{ count: number }>();

    const total = countResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // フィルターオプション取得（カテゴリ一覧）
    const categoriesResult = await env.DB.prepare(`
      SELECT DISTINCT category FROM articles WHERE site = ? AND category IS NOT NULL ORDER BY category
    `).bind(site).all<{ category: string }>();

    // 月一覧取得
    const monthsResult = await env.DB.prepare(`
      SELECT DISTINCT strftime('%Y-%m', published_date) as month
      FROM articles WHERE site = ?
      ORDER BY month DESC
    `).bind(site).all<{ month: string }>();

    // 執筆者一覧取得（Salonのみ）
    let authors: string[] = [];
    if (site === 'salon') {
      const authorsResult = await env.DB.prepare(`
        SELECT DISTINCT author FROM articles WHERE site = ? AND author IS NOT NULL ORDER BY author
      `).bind(site).all<{ author: string }>();
      authors = authorsResult.results?.map(r => r.author) || [];
    }

    // 同期状態取得
    const syncResult = await env.DB.prepare(`
      SELECT site, last_sync_at, total_count FROM article_sync WHERE site = ?
    `).bind(site).first<ArticleSyncRow>();

    // レスポンス形式に変換
    const articles = (articlesResult.results || []).map(row => ({
      id: row.id,
      url: row.url,
      title: row.title,
      publishedDate: row.published_date,
      category: row.category || undefined,
      author: site === 'salon' ? (row.author || undefined) : undefined, // Publicには執筆者を含めない
      ogImage: row.og_image || undefined,
      excerpt: row.excerpt || undefined,
    }));

    return Response.json(successResponse({
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      filters: {
        categories: categoriesResult.results?.map(r => r.category) || [],
        authors, // Salonのみ
        months: monthsResult.results?.map(r => r.month) || [],
      },
      lastSyncAt: syncResult?.last_sync_at || null,
    }));
  } catch (error) {
    console.error('Articles fetch error:', error);
    return Response.json(errorBody('FETCH_ERROR', '記事の取得に失敗しました'), { status: 500 });
  }
};
