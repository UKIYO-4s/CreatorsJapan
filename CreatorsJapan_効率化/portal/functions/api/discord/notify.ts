/**
 * POST /api/discord/notify
 * Discord通知エンドポイント
 */

import {
  successResponse,
  errorBody,
  isValidSite,
  getSiteConfig,
  checkAdminAuth,
  type Env,
  type Site,
} from '../../../workers/api-utils';
import { fetchGA4Report, calculateDateRange as calculateGA4DateRange } from '../../../workers/ga-client';
import { fetchGSCReport } from '../../../workers/gsc-client';
import { sendMonthlyReport, sendArticleNotification } from '../../../workers/discord';

interface NotifyRequestBody {
  site: Site;
  type: 'monthly' | 'article';
  articleUrl?: string;
  articleTitle?: string;
}

async function saveNotificationLog(
  db: D1Database,
  site: string,
  type: string,
  status: 'success' | 'error',
  message?: string
) {
  try {
    await db.prepare(
      `INSERT INTO notification_logs (site, type, status, message)
       VALUES (?, ?, ?, ?)`
    ).bind(site, type, status, message || null).run();
  } catch (e) {
    console.error('Failed to save notification log:', e);
  }
}

async function updateMonthlySummaryNotified(
  db: D1Database,
  site: string,
  yearMonth: string
) {
  try {
    await db.prepare(
      `UPDATE monthly_summaries
       SET discord_notified_at = datetime('now')
       WHERE site = ? AND year_month = ?`
    ).bind(site, yearMonth).run();
  } catch (e) {
    console.error('Failed to update monthly summary:', e);
  }
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  // 管理者チェック
  const authResult = checkAdminAuth(env, request);
  if (!authResult.authorized) {
    return Response.json(authResult.error, { status: 403 });
  }

  let body: NotifyRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json(errorBody('INVALID_BODY', 'リクエストボディが不正です'), { status: 400 });
  }

  if (!isValidSite(body.site)) {
    return Response.json(errorBody('INVALID_SITE', 'サイトの指定が不正です'), { status: 400 });
  }

  const siteConfig = getSiteConfig(body.site, env);

  if (!siteConfig.discordWebhookUrl) {
    if (env.DB) {
      await saveNotificationLog(env.DB, body.site, body.type, 'error', 'Webhook URL not configured');
    }
    return Response.json(errorBody('CONFIG_ERROR', 'Discord Webhook URLが設定されていません'), { status: 500 });
  }

  try {
    if (body.type === 'article' && body.articleUrl && body.articleTitle) {
      // 記事通知
      const result = await sendArticleNotification(siteConfig.discordWebhookUrl, siteConfig.name, {
        title: body.articleTitle,
        url: body.articleUrl,
      });

      if (env.DB) {
        await saveNotificationLog(
          env.DB,
          body.site,
          'article',
          result.success ? 'success' : 'error',
          result.success ? body.articleTitle : result.error
        );
      }

      return Response.json(successResponse({ sent: result.success, error: result.error }));
    } else {
      // 月次レポート（GA/GSCデータを取得して送信）
      const { startDate, endDate, period } = calculateGA4DateRange();

      if (!siteConfig.ga4PropertyId || !siteConfig.url || !env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        if (env.DB) {
          await saveNotificationLog(env.DB, body.site, 'monthly', 'error', 'API credentials not configured');
        }
        return Response.json(errorBody('CONFIG_ERROR', '設定が不完全です'), { status: 500 });
      }

      const [gaReport, gscReport] = await Promise.all([
        fetchGA4Report(siteConfig.ga4PropertyId, env.GOOGLE_SERVICE_ACCOUNT_KEY, startDate, endDate),
        fetchGSCReport(siteConfig.url, env.GOOGLE_SERVICE_ACCOUNT_KEY, startDate, endDate),
      ]);

      const result = await sendMonthlyReport(siteConfig.discordWebhookUrl, siteConfig.name, gaReport, gscReport);

      if (env.DB) {
        await saveNotificationLog(
          env.DB,
          body.site,
          'monthly',
          result.success ? 'success' : 'error',
          result.success ? `Monthly report for ${period}` : result.error
        );

        if (result.success) {
          await updateMonthlySummaryNotified(env.DB, body.site, period);
        }
      }

      return Response.json(successResponse({ sent: result.success, error: result.error }));
    }
  } catch (error) {
    console.error('Discord notify error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (env.DB) {
      await saveNotificationLog(env.DB, body.site, body.type, 'error', errorMessage);
    }

    return Response.json(errorBody('DISCORD_ERROR', 'Discord通知の送信に失敗しました'), { status: 502 });
  }
};
