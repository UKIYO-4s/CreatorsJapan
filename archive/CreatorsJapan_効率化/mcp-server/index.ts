/**
 * Creators Japan Portal MCP Server
 *
 * ツール一覧:
 * - get_monthly_article_count : CREATORS JAPANの月別記事数取得
 * - get_salon_article_titles  : Salonの記事タイトル一覧取得
 * - search_articles           : タイトルキーワード検索
 * - get_author_stats          : 執筆者別投稿統計
 * - get_category_stats        : カテゴリ別記事数・投稿頻度
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = 'https://creators-japan-portal.pages.dev/api';

// ─── 型 ─────────────────────────────────────────────────────────────────────

interface Article {
  id?: number;
  url: string;
  title: string;
  publishedDate: string;
  category?: string;
  author?: string;
}

interface ArticlesResponse {
  articles: Article[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: { categories: string[]; authors: string[]; months: string[] };
  lastSyncAt: string | null;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

// ─── API ヘルパー ─────────────────────────────────────────────────────────────

async function fetchArticles(
  site: 'public' | 'salon',
  params: { page?: number; limit?: number; month?: string; category?: string; author?: string }
): Promise<ArticlesResponse> {
  const qs = new URLSearchParams();
  if (params.page)     qs.set('page',     String(params.page));
  if (params.limit)    qs.set('limit',    String(params.limit));
  if (params.month)    qs.set('month',    params.month);
  if (params.category) qs.set('category', params.category);
  if (params.author)   qs.set('author',   params.author);

  const url = `${BASE_URL}/articles/${site}${qs.toString() ? '?' + qs : ''}`;
  const res = await fetch(url);
  const json = (await res.json()) as ApiResponse<ArticlesResponse>;

  if (!json.success || !json.data) {
    throw new Error(json.error?.message ?? 'API error');
  }
  return json.data;
}

// ─── MCP サーバー ─────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'creators-japan',
  version: '1.0.0',
});

// ツール1: CREATORS JAPAN の月別記事数
server.tool(
  'get_monthly_article_count',
  'CREATORS JAPANの公開サイトにおける月別の記事投稿数を取得する。月を指定しない場合は今月の件数を返す。',
  {
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .describe('対象月（YYYY-MM形式）。省略時は今月'),
  },
  async ({ month }) => {
    const targetMonth =
      month ?? new Date().toISOString().slice(0, 7);

    const data = await fetchArticles('public', { month: targetMonth, limit: 1 });
    const count = data.pagination.total;

    return {
      content: [
        {
          type: 'text',
          text: `CREATORS JAPAN（公開サイト）\n月: ${targetMonth}\n記事数: ${count}件`,
        },
      ],
    };
  }
);

// ツール2: Salon の記事タイトル一覧
server.tool(
  'get_salon_article_titles',
  'Salonの過去記事タイトル一覧を取得する。月・カテゴリ・執筆者で絞り込み可能。全件取得も可能。',
  {
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .describe('絞り込む月（YYYY-MM形式）。省略時は全期間'),
    category: z
      .string()
      .optional()
      .describe('カテゴリ名で絞り込み（例: 動画編集、ライフハック）'),
    author: z
      .string()
      .optional()
      .describe('執筆者名で絞り込み（例: Shoei、辻もっち）'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(500)
      .optional()
      .default(100)
      .describe('取得件数の上限（デフォルト100、最大500）'),
  },
  async ({ month, category, author, limit = 100 }) => {
    // 最大500件まで複数ページをまとめて取得
    const perPage = Math.min(limit, 100);
    const allArticles: Article[] = [];
    let page = 1;

    while (allArticles.length < limit) {
      const data = await fetchArticles('salon', {
        page,
        limit: perPage,
        month,
        category,
        author,
      });

      allArticles.push(...data.articles);

      if (page >= data.pagination.totalPages) break;
      if (allArticles.length >= limit) break;
      page++;
    }

    const articles = allArticles.slice(0, limit);
    const lines = articles.map(
      (a, i) =>
        `${i + 1}. ${a.title}（${a.publishedDate.slice(0, 10)}）${a.category ? ` [${a.category}]` : ''}${a.author ? ` / ${a.author}` : ''}`
    );

    const header = [
      `Salon 記事タイトル一覧`,
      month    ? `月: ${month}`          : '期間: 全期間',
      category ? `カテゴリ: ${category}` : '',
      author   ? `執筆者: ${author}`     : '',
      `取得件数: ${articles.length}件`,
      '─'.repeat(40),
    ]
      .filter(Boolean)
      .join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `${header}\n${lines.join('\n')}`,
        },
      ],
    };
  }
);

// ツール3: キーワードで記事検索
server.tool(
  'search_articles',
  'タイトルにキーワードを含む記事を検索する。ネタ被りチェックや過去記事の参照に使う。',
  {
    query: z.string().min(1).describe('検索キーワード（例: 副業、Premiere Pro）'),
    site: z
      .enum(['salon', 'public'])
      .optional()
      .default('salon')
      .describe('対象サイト（デフォルト: salon）'),
    limit: z
      .number().int().min(1).max(200)
      .optional().default(50)
      .describe('取得件数の上限（デフォルト50）'),
  },
  async ({ query, site = 'salon', limit = 50 }) => {
    const qs = new URLSearchParams({ q: query, site, limit: String(limit) });
    const res = await fetch(`${BASE_URL}/articles/search?${qs}`);
    const json = (await res.json()) as { success: boolean; data?: { query: string; count: number; articles: Article[] }; error?: { message: string } };

    if (!json.success || !json.data) throw new Error(json.error?.message ?? 'API error');

    const { count, articles } = json.data;
    if (count === 0) {
      return { content: [{ type: 'text', text: `「${query}」を含む記事は見つかりませんでした。` }] };
    }

    const lines = articles.map(
      (a, i) =>
        `${i + 1}. ${a.title}（${a.publishedDate.slice(0, 10)}）${a.category ? ` [${a.category}]` : ''}${a.author ? ` / ${a.author}` : ''}`
    );

    return {
      content: [{
        type: 'text',
        text: `「${query}」の検索結果: ${count}件\n${'─'.repeat(40)}\n${lines.join('\n')}`,
      }],
    };
  }
);

// ツール4: 執筆者別の投稿統計
server.tool(
  'get_author_stats',
  '執筆者ごとの記事投稿数を取得する。全期間または直近N ヶ月で絞れる。',
  {
    site: z.enum(['salon', 'public']).optional().default('salon').describe('対象サイト'),
    months: z
      .number().int().min(0).max(60)
      .optional().default(0)
      .describe('過去N ヶ月に絞る（0=全期間、例: 3=直近3ヶ月）'),
  },
  async ({ site = 'salon', months = 0 }) => {
    const qs = new URLSearchParams({ site, months: String(months) });
    const res = await fetch(`${BASE_URL}/stats/authors?${qs}`);
    const json = (await res.json()) as { success: boolean; data?: { site: string; period: string; authors: { author: string; total: number; monthly: Record<string, number> }[] }; error?: { message: string } };

    if (!json.success || !json.data) throw new Error(json.error?.message ?? 'API error');

    const { period, authors } = json.data;
    const lines = authors.map(a => {
      const recentMonths = Object.entries(a.monthly)
        .sort(([a], [b]) => b.localeCompare(a))
        .slice(0, 3)
        .map(([m, c]) => `${m}:${c}件`)
        .join(' ')
      return `  ${a.author}: 合計${a.total}件  直近→ ${recentMonths || 'なし'}`
    });

    return {
      content: [{
        type: 'text',
        text: `執筆者別統計（${period}）\n${'─'.repeat(40)}\n${lines.join('\n')}`,
      }],
    };
  }
);

// ツール5: カテゴリ別の記事数・投稿頻度
server.tool(
  'get_category_stats',
  'カテゴリごとの記事数と直近の投稿頻度を取得する。手薄なジャンルの発見に使う。',
  {
    site: z.enum(['salon', 'public']).optional().default('salon').describe('対象サイト'),
    months: z
      .number().int().min(1).max(24)
      .optional().default(3)
      .describe('直近N ヶ月の件数も表示（デフォルト3）'),
  },
  async ({ site = 'salon', months = 3 }) => {
    const qs = new URLSearchParams({ site, months: String(months) });
    const res = await fetch(`${BASE_URL}/stats/categories?${qs}`);
    const json = (await res.json()) as { success: boolean; data?: { site: string; recentMonths: number; categories: Record<string, number | string>[] }; error?: { message: string } };

    if (!json.success || !json.data) throw new Error(json.error?.message ?? 'API error');

    const { recentMonths, categories } = json.data;
    const lines = categories.map(c => {
      const recent = c[`recent${recentMonths}months`] as number;
      const bar = recent === 0 ? '⚠️ 最近なし' : `直近${recentMonths}ヶ月: ${recent}件`;
      return `  ${c['category']}: 合計${c['total']}件  ${bar}`
    });

    return {
      content: [{
        type: 'text',
        text: `カテゴリ別統計\n${'─'.repeat(40)}\n${lines.join('\n')}`,
      }],
    };
  }
);

// ─── 起動 ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
