/**
 * Creators Japan Portal MCP Server
 *
 * ツール一覧:
 * - get_monthly_article_count : CREATORS JAPANの月別記事数取得
 * - get_salon_article_titles  : Salonの記事タイトル一覧取得
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

// ─── 起動 ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
