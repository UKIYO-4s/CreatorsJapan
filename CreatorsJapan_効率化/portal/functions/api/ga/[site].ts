/**
 * GET /api/ga/:site
 * GA4レポート取得エンドポイント
 */

import {
  successResponse,
  errorBody,
  isValidSite,
  getSiteConfig,
  type Env,
} from '../../../workers/api-utils';
import { getCache, setCache, CacheKeys, CacheTTL } from '../../../workers/kv-cache';
import { fetchGA4Report, calculateDateRange } from '../../../workers/ga-client';

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
  const cacheKey = CacheKeys.ga(site, normalizedPeriod);

  // キャッシュチェック
  if (env.CACHE) {
    const cached = await getCache<any>(env.CACHE, cacheKey);
    if (cached) {
      return Response.json(successResponse({
        report: cached.data,
      }, true, cached.cachedAt));
    }
  }

  // GA4 API実行
  const siteConfig = getSiteConfig(site, env);

  if (!siteConfig.ga4PropertyId || !env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    // モックデータを返す（設定未完了時）
    const mockReport = {
      period: normalizedPeriod,
      summary: {
        pageViews: 45230,
        users: 12500,
        newUsers: 8200,
        sessions: 15000,
        avgSessionDuration: 180,
        bounceRate: 45.5,
      },
      dailyData: Array.from({ length: 30 }, (_, i) => ({
        date: `${normalizedPeriod}-${String(i + 1).padStart(2, '0')}`,
        pageViews: 1000 + Math.floor(Math.random() * 500),
        users: 300 + Math.floor(Math.random() * 150),
      })),
      topPages: [
        { path: '/blog/video-editing-guide', title: '動画編集入門ガイド', views: 5230 },
        { path: '/blog/premiere-pro-tips', title: 'Premiere Pro時短テクニック', views: 3820 },
        { path: '/', title: 'トップページ', views: 2910 },
      ],
    };
    return Response.json(successResponse({ report: mockReport, isMockData: true }));
  }

  try {
    const report = await fetchGA4Report(
      siteConfig.ga4PropertyId,
      env.GOOGLE_SERVICE_ACCOUNT_KEY,
      startDate,
      endDate
    );

    // キャッシュ保存
    if (env.CACHE) {
      await setCache(env.CACHE, cacheKey, report, { ttl: CacheTTL.GA_REPORT });
    }

    return Response.json(successResponse({ report }));
  } catch (error) {
    console.error('GA4 API error:', error);
    return Response.json(errorBody('GA4_API_ERROR', 'アクセスデータの取得に失敗しました'), { status: 502 });
  }
};
