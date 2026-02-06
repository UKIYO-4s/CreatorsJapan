/**
 * POST /api/articles/sync/:site
 * 記事同期エンドポイント（差分更新）
 */

import {
  successResponse,
  errorBody,
  isValidSite,
  getSiteConfig,
  requireAdmin,
  type Env,
} from '../../../../workers/api-utils';
import { scrapeArticles, type Article } from '../../../../workers/scraper';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const site = params.site as string;

  // 管理者権限チェック
  const authResult = await requireAdmin(env, request);
  if (!authResult.authorized) {
    return Response.json(authResult.error || errorBody('UNAUTHORIZED', '管理者権限が必要です'), {
      status: authResult.status || 401,
    });
  }

  // サイト検証
  if (!isValidSite(site)) {
    return Response.json(errorBody('INVALID_SITE', 'サイトの指定が不正です'), { status: 400 });
  }

  if (!env.DB) {
    return Response.json(errorBody('CONFIG_ERROR', 'Database not configured'), { status: 500 });
  }

  const url = new URL(request.url);
  const forceSync = url.searchParams.get('forceSync') === 'true';

  const siteConfig = getSiteConfig(site, env);
  const db = env.DB;

  try {
    // DB内の最新記事日時を取得
    const latestResult = await db.prepare(`
      SELECT MAX(published_date) as latest_date FROM articles WHERE site = ?
    `).bind(site).first<{ latest_date: string | null }>();

    const latestDbDate = latestResult?.latest_date || '1970-01-01T00:00:00';

    // WordPressから全記事を取得
    const wpArticles = await scrapeArticles(siteConfig.url);

    let insertedCount = 0;
    const updatedCount = 0;

    if (forceSync) {
      // 強制同期: 既存データを削除して全件挿入
      await db.prepare('DELETE FROM articles WHERE site = ?').bind(site).run();

      for (const article of wpArticles) {
        await insertArticle(db, site, article);
        insertedCount++;
      }
    } else {
      // 差分同期: 新しい記事のみ挿入
      for (const article of wpArticles) {
        if (article.publishedDate > latestDbDate) {
          await insertArticle(db, site, article);
          insertedCount++;
        }
      }

      // 既存の記事は更新しない（差分更新のみ）
    }

    // 総件数を取得
    const countResult = await db.prepare(`
      SELECT COUNT(*) as count FROM articles WHERE site = ?
    `).bind(site).first<{ count: number }>();

    const totalCount = countResult?.count || 0;

    // 同期状態を更新
    await db.prepare(`
      INSERT INTO article_sync (site, last_sync_at, total_count)
      VALUES (?, datetime('now'), ?)
      ON CONFLICT(site) DO UPDATE SET
        last_sync_at = datetime('now'),
        total_count = excluded.total_count
    `).bind(site, totalCount).run();

    return Response.json(successResponse({
      synced: true,
      insertedCount,
      updatedCount,
      totalCount,
      wpArticleCount: wpArticles.length,
      forceSync,
    }));
  } catch (error) {
    console.error('Sync error:', error);
    return Response.json(errorBody('SYNC_ERROR', '同期に失敗しました'), { status: 500 });
  }
};

/**
 * 記事をDBに挿入
 */
async function insertArticle(db: D1Database, site: string, article: Article): Promise<void> {
  await db.prepare(`
    INSERT INTO articles (site, wp_id, url, title, published_date, category, author, og_image, excerpt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(site, url) DO UPDATE SET
      title = excluded.title,
      published_date = excluded.published_date,
      category = excluded.category,
      author = excluded.author,
      og_image = excluded.og_image,
      excerpt = excluded.excerpt
  `).bind(
    site,
    article.wpId || null,
    article.url,
    article.title,
    article.publishedDate,
    article.category || null,
    article.author || null,
    article.ogImage || null,
    article.excerpt || null
  ).run();
}

/**
 * GET /api/articles/sync/:site
 * 同期状態取得
 */
export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const site = params.site as string;

  // 管理者権限チェック
  const authResult = await requireAdmin(env, request);
  if (!authResult.authorized) {
    return Response.json(authResult.error || errorBody('UNAUTHORIZED', '管理者権限が必要です'), {
      status: authResult.status || 401,
    });
  }

  if (!isValidSite(site)) {
    return Response.json(errorBody('INVALID_SITE', 'サイトの指定が不正です'), { status: 400 });
  }

  if (!env.DB) {
    return Response.json(errorBody('CONFIG_ERROR', 'Database not configured'), { status: 500 });
  }

  try {
    const syncResult = await env.DB.prepare(`
      SELECT site, last_sync_at, total_count FROM article_sync WHERE site = ?
    `).bind(site).first<{ site: string; last_sync_at: string | null; total_count: number }>();

    return Response.json(successResponse({
      site,
      lastSyncAt: syncResult?.last_sync_at || null,
      totalCount: syncResult?.total_count || 0,
    }));
  } catch (error) {
    console.error('Sync status error:', error);
    return Response.json(errorBody('FETCH_ERROR', '同期状態の取得に失敗しました'), { status: 500 });
  }
};
