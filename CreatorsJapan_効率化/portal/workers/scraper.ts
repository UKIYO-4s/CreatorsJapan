/**
 * 記事取得
 * WordPress REST API を使用して記事一覧を取得
 */

export interface Article {
  url: string;
  title: string;
  publishedDate: string;
  ogImage?: string;
  excerpt?: string;
  category?: string;
  author?: string;
  wpId?: number;
}

export interface ScrapeResult {
  articles: Article[];
  hash: string;
  scrapedAt: string;
}

/**
 * サイトURLマッピング
 */
export const SITE_URLS = {
  public: 'https://creators-jp.com',
  salon: 'https://salon.creators-jp.com',
} as const;

/**
 * WordPress REST API のレスポンス型
 */
interface WPPost {
  id: number;
  date: string;
  link: string;
  title: {
    rendered: string;
  };
  excerpt?: {
    rendered: string;
  };
  _embedded?: {
    'wp:term'?: Array<Array<{ name: string }>>;
    'wp:featuredmedia'?: Array<{ source_url: string }>;
    'author'?: Array<{ name: string }>;
  };
}

/**
 * 記事一覧を取得（WordPress REST API・ページネーション対応）
 */
export async function scrapeArticles(siteUrl: string): Promise<Article[]> {
  try {
    const allArticles: Article[] = [];
    let page = 1;
    const perPage = 100; // WP REST API の最大値

    while (true) {
      const apiUrl = `${siteUrl}/wp-json/wp/v2/posts?per_page=${perPage}&page=${page}&_embed`;

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; CreatorsJapanPortal/1.0)',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        // REST API が使えない場合はHTMLスクレイピングにフォールバック
        if (response.status === 404 || response.status === 403) {
          console.log('WP REST API not available, falling back to HTML scraping');
          return await scrapeArticlesFromHtml(siteUrl);
        }
        // ページが存在しない場合は終了
        if (response.status === 400) {
          break;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const posts = await response.json() as WPPost[];
      if (posts.length === 0) {
        break;
      }

      allArticles.push(...posts.map(parseWPPost));

      // 総ページ数を確認
      const totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1', 10);
      if (page >= totalPages) {
        break;
      }

      page++;
    }

    return allArticles;
  } catch (error) {
    console.error('WP API error, trying HTML fallback:', error);
    return await scrapeArticlesFromHtml(siteUrl);
  }
}

/**
 * WordPress投稿をArticle形式に変換
 */
function parseWPPost(post: WPPost): Article {
  // タイトル
  const title = decodeHTMLEntities(post.title.rendered);

  // カテゴリ（最初のカテゴリを使用）
  const category = post._embedded?.['wp:term']?.[0]?.[0]?.name;

  // アイキャッチ画像
  const ogImage = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;

  // 抜粋
  const excerpt = post.excerpt?.rendered
    ? decodeHTMLEntities(post.excerpt.rendered).slice(0, 200)
    : undefined;

  // 執筆者
  const author = post._embedded?.['author']?.[0]?.name;

  return {
    url: post.link,
    title,
    publishedDate: post.date, // ISO 8601形式
    ogImage,
    excerpt,
    category,
    author,
    wpId: post.id,
  };
}

/**
 * HTMLスクレイピング（REST API使用不可時のフォールバック）
 */
async function scrapeArticlesFromHtml(siteUrl: string): Promise<Article[]> {
  const response = await fetch(siteUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CreatorsJapanPortal/1.0)',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  return parseSwellArticleList(html, siteUrl);
}

/**
 * SWELL テーマの記事リストをパース
 */
function parseSwellArticleList(html: string, baseUrl: string): Article[] {
  const articles: Article[] = [];
  const seenUrls = new Set<string>();

  const itemPattern = /<li[^>]*class="[^"]*p-postList__item[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;

  let itemMatch;
  while ((itemMatch = itemPattern.exec(html)) !== null) {
    const itemHtml = itemMatch[1];

    const urlMatch = itemHtml.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*p-postList__link[^"]*"/i)
      || itemHtml.match(/<a[^>]*class="[^"]*p-postList__link[^"]*"[^>]*href="([^"]+)"/i);
    if (!urlMatch) continue;

    let url = urlMatch[1];
    if (url.startsWith('/')) {
      url = `${baseUrl}${url}`;
    }

    if (seenUrls.has(url)) continue;
    if (url.includes('/category/') || url.includes('/tag/') || url.includes('/page/')) continue;
    seenUrls.add(url);

    const titleMatch = itemHtml.match(/<h2[^>]*class="[^"]*p-postList__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i);
    const title = titleMatch ? decodeHTMLEntities(titleMatch[1].trim()) : extractTitleFromUrl(url);

    const imgMatch = itemHtml.match(/<img[^>]*class="[^"]*c-postThumb__img[^"]*"[^>]*src="([^"]+)"/i)
      || itemHtml.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*c-postThumb__img/i);
    const ogImage = imgMatch ? imgMatch[1] : undefined;

    const catMatch = itemHtml.match(/<span[^>]*class="[^"]*c-postThumb__cat[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const category = catMatch ? decodeHTMLEntities(catMatch[1].trim()) : undefined;

    articles.push({
      url,
      title,
      publishedDate: new Date().toISOString(),
      ogImage,
      category,
    });
  }

  return articles;
}

/**
 * URLからタイトルを推測
 */
function extractTitleFromUrl(url: string): string {
  const slug = url.split('/').filter(Boolean).pop() || '';
  return decodeURIComponent(slug)
    .replace(/-/g, ' ')
    .replace(/^\w/, c => c.toUpperCase());
}

/**
 * HTMLエンティティをデコード
 */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * 記事リストからハッシュを計算（差分検出用）
 */
export async function calculateArticlesHash(articles: Article[]): Promise<string> {
  const content = articles
    .map(a => `${a.url}|${a.title}`)
    .sort()
    .join('\n');

  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex.slice(0, 16);
}
