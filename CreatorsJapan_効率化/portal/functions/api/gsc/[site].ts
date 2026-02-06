/**
 * GET /api/gsc/:site
 * GSCレポート取得エンドポイント
 */

import {
  successResponse,
  errorBody,
  isValidSite,
  getSiteConfig,
  type Env,
} from '../../../workers/api-utils';
import { getCache, setCache, CacheKeys, CacheTTL } from '../../../workers/kv-cache';
import { fetchGSCReport, calculateDateRange } from '../../../workers/gsc-client';

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const site = params.site as string;

  // サイト検証
  if (!isValidSite(site)) {
    return Response.json(errorBody('INVALID_SITE', 'サイトの指定が不正です'), { status: 400 });
  }

  const url = new URL(request.url);
  const period = url.searchParams.get('period') || undefined;
  const { startDate, endDate, period: normalizedPeriod } = calculateDateRange(period);
  const cacheKey = CacheKeys.gsc(site, normalizedPeriod);

  // キャッシュチェック
  if (env.CACHE) {
    const cached = await getCache<any>(env.CACHE, cacheKey);
    if (cached) {
      return Response.json(successResponse({
        report: cached.data,
      }, true, cached.cachedAt));
    }
  }

  // GSC API実行
  const siteConfig = getSiteConfig(site, env);

  if (!siteConfig.url || !env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    // モックデータを返す（設定未完了時）
    const mockReport = {
      period: normalizedPeriod,
      summary: {
        clicks: 3755,
        impressions: 125000,
        ctr: 3.0,
        position: 15.2,
      },
      topQueries: [
        { query: '動画編集 始め方', clicks: 520, impressions: 8500, ctr: 6.1, position: 5.2 },
        { query: 'premiere pro 使い方', clicks: 380, impressions: 6200, ctr: 6.1, position: 8.1 },
        { query: 'YouTube 編集 コツ', clicks: 290, impressions: 5100, ctr: 5.7, position: 12.3 },
      ],
      topPages: [
        { page: '/blog/video-editing-guide', clicks: 850, impressions: 15000, ctr: 5.7, position: 8.5 },
        { page: '/blog/premiere-pro-tips', clicks: 620, impressions: 12000, ctr: 5.2, position: 10.2 },
        { page: '/', clicks: 410, impressions: 8500, ctr: 4.8, position: 15.1 },
      ],
    };
    return Response.json(successResponse({ report: mockReport, isMockData: true }));
  }

  try {
    const report = await fetchGSCReport(
      siteConfig.url,
      env.GOOGLE_SERVICE_ACCOUNT_KEY,
      startDate,
      endDate
    );

    // キャッシュ保存
    if (env.CACHE) {
      await setCache(env.CACHE, cacheKey, report, { ttl: CacheTTL.GSC_REPORT });
    }

    return Response.json(successResponse({ report }));
  } catch (error) {
    console.error('GSC API error:', error);
    return Response.json(errorBody('GSC_API_ERROR', '検索データの取得に失敗しました'), { status: 502 });
  }
};
