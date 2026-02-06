/**
 * Discord Webhook クライアント
 * 月次レポート・記事通知の送信
 */

import type { GA4Report } from './ga-client';
import type { GSCReport } from './gsc-client';

export interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields: {
    name: string;
    value: string;
    inline?: boolean;
  }[];
  footer?: {
    text: string;
  };
  timestamp?: string;
}

export interface DiscordMessage {
  content?: string;
  embeds?: DiscordEmbed[];
}

/**
 * Discord色定数
 */
const COLORS = {
  PRIMARY: 0x3498db,   // 青
  SUCCESS: 0x2ecc71,   // 緑
  WARNING: 0xf39c12,   // オレンジ
  ERROR: 0xe74c3c,     // 赤
};

/**
 * Webhookにメッセージを送信
 */
export async function sendDiscordMessage(
  webhookUrl: string,
  message: DiscordMessage
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error };
    }

    // Discord は 204 No Content を返すことがある
    if (response.status === 204) {
      return { success: true };
    }

    const data = await response.json() as { id?: string };
    return { success: true, messageId: data.id };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 月次レポートを送信
 */
export async function sendMonthlyReport(
  webhookUrl: string,
  siteName: string,
  ga: GA4Report,
  gsc: GSCReport
): Promise<{ success: boolean; error?: string }> {
  const monthLabel = formatMonth(ga.period);

  // 変化率の矢印
  const getChangeIndicator = (change?: number): string => {
    if (change === undefined) return '';
    if (change > 0) return ` (+${change.toFixed(1)}%)`;
    if (change < 0) return ` (${change.toFixed(1)}%)`;
    return ' (±0%)';
  };

  const pvChange = ga.comparison?.pageViewsChange;
  const usersChange = ga.comparison?.usersChange;

  const embed: DiscordEmbed = {
    title: `📊 ${monthLabel} 月次レポート`,
    description: siteName,
    color: COLORS.PRIMARY,
    fields: [
      {
        name: '📈 ページビュー',
        value: `${ga.summary.pageViews.toLocaleString()}${getChangeIndicator(pvChange)}`,
        inline: true,
      },
      {
        name: '👥 ユーザー数',
        value: `${ga.summary.users.toLocaleString()}${getChangeIndicator(usersChange)}`,
        inline: true,
      },
      {
        name: '🆕 新規ユーザー',
        value: ga.summary.newUsers.toLocaleString(),
        inline: true,
      },
      {
        name: '🔍 検索クリック',
        value: gsc.summary.clicks.toLocaleString(),
        inline: true,
      },
      {
        name: '👁️ 検索表示回数',
        value: gsc.summary.impressions.toLocaleString(),
        inline: true,
      },
      {
        name: '📍 平均掲載順位',
        value: gsc.summary.position.toFixed(1),
        inline: true,
      },
    ],
    footer: {
      text: 'Creators Japan Portal',
    },
    timestamp: new Date().toISOString(),
  };

  // 人気ページTop3を追加
  if (ga.topPages.length > 0) {
    const topPagesText = ga.topPages
      .slice(0, 3)
      .map((p, i) => `${i + 1}. ${p.title || p.path} (${p.views.toLocaleString()} PV)`)
      .join('\n');

    embed.fields.push({
      name: '🏆 人気ページ Top 3',
      value: topPagesText,
      inline: false,
    });
  }

  // 人気キーワードTop3を追加
  if (gsc.topQueries.length > 0) {
    const topQueriesText = gsc.topQueries
      .slice(0, 3)
      .map((q, i) => `${i + 1}. "${q.query}" (${q.clicks} clicks)`)
      .join('\n');

    embed.fields.push({
      name: '🔎 人気検索キーワード Top 3',
      value: topQueriesText,
      inline: false,
    });
  }

  return sendDiscordMessage(webhookUrl, { embeds: [embed] });
}

/**
 * 新規記事通知を送信
 */
export async function sendArticleNotification(
  webhookUrl: string,
  siteName: string,
  article: {
    title: string;
    url: string;
    ogImage?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const embed: DiscordEmbed = {
    title: '📝 新規記事が公開されました',
    description: `**${article.title}**\n\n${article.url}`,
    color: COLORS.SUCCESS,
    fields: [
      {
        name: 'サイト',
        value: siteName,
        inline: true,
      },
    ],
    footer: {
      text: 'Creators Japan Portal',
    },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordMessage(webhookUrl, { embeds: [embed] });
}

/**
 * エラー通知を送信
 */
export async function sendErrorNotification(
  webhookUrl: string,
  errorType: string,
  errorMessage: string
): Promise<{ success: boolean; error?: string }> {
  const embed: DiscordEmbed = {
    title: '⚠️ システムエラー',
    description: errorMessage,
    color: COLORS.ERROR,
    fields: [
      {
        name: 'エラータイプ',
        value: errorType,
        inline: true,
      },
      {
        name: '発生時刻',
        value: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }),
        inline: true,
      },
    ],
    footer: {
      text: 'Creators Japan Portal',
    },
    timestamp: new Date().toISOString(),
  };

  return sendDiscordMessage(webhookUrl, { embeds: [embed] });
}

/**
 * 月のフォーマット（YYYY-MM → YYYY年M月）
 */
function formatMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  return `${year}年${month}月`;
}
