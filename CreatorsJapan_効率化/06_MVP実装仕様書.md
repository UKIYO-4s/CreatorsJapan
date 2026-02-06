# MVP実装仕様書

**バージョン**: 1.0
**作成日**: 2026年1月12日
**対象**: Creators Japan 業務効率化ポータル MVP

---

## 目次

1. [MVPスコープ](#mvpスコープ)
2. [技術仕様](#技術仕様)
3. [機能別詳細仕様](#機能別詳細仕様)
4. [API仕様](#api仕様)
5. [データ構造](#データ構造)
6. [エラーハンドリング](#エラーハンドリング)
7. [セキュリティ](#セキュリティ)
8. [実装フェーズ](#実装フェーズ)

---

## MVPスコープ

### 含まれる機能

| 機能 | 管理者 | クライアント | 優先度 |
|------|--------|--------------|--------|
| Cloudflare Access認証 | ○ | ○ | P0 |
| ダッシュボード | ○ | ○ | P0 |
| 記事一覧表示（自動取得） | ○ | ○ | P0 |
| GA4レポート表示 | ○ | ○ | P0 |
| Search Consoleレポート表示 | ○ | ○ | P0 |
| Discord自動通知 | 設定 | - | P1 |
| 月次サマリー保存 | 自動 | 閲覧 | P1 |

### 含まれない機能（Phase 2以降）

- タスク管理
- ファイル共有
- 請求書管理
- カスタム通知設定
- 複数クライアント対応

---

## 技術仕様

### 環境構成

```
┌─────────────────────────────────────────────────────────────┐
│                      本番環境                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Cloudflare Pages        : フロントエンド                   │
│   Cloudflare Workers      : APIバックエンド                  │
│   Cloudflare Access       : 認証・認可                       │
│   Cloudflare KV           : キャッシュストレージ              │
│   Cloudflare D1           : 永続データストレージ              │
│                                                             │
│   外部サービス:                                              │
│   - Google Analytics 4 Data API                             │
│   - Google Search Console API                               │
│   - Discord Webhook API                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 技術スタック詳細

| カテゴリ | 技術 | バージョン | 用途 |
|----------|------|------------|------|
| フロントエンド | React | 18.x | UIフレームワーク |
| ビルドツール | Vite | 5.x | 高速ビルド |
| スタイリング | Tailwind CSS | 3.x | ユーティリティCSS |
| 状態管理 | TanStack Query | 5.x | サーバー状態管理 |
| ルーティング | React Router | 6.x | クライアントルーティング |
| 型システム | TypeScript | 5.x | 型安全性 |
| API通信 | Hono | 4.x | Workers用軽量フレームワーク |
| バリデーション | Zod | 3.x | スキーマバリデーション |

### Cloudflare リソース

```toml
# wrangler.toml

name = "creators-japan-portal"
compatibility_date = "2024-01-01"

# KV Namespace
[[kv_namespaces]]
binding = "CACHE"
id = "xxx"

# D1 Database
[[d1_databases]]
binding = "DB"
database_name = "portal-db"
database_id = "xxx"

# 環境変数（Secrets）
[vars]
GA4_PROPERTY_ID_PUBLIC = "xxx"
GA4_PROPERTY_ID_SALON = "xxx"
GSC_SITE_URL_PUBLIC = "https://creators-jp.com"
GSC_SITE_URL_SALON = "https://salon.creators-jp.com"

# Secrets (wrangler secret put で設定)
# - GOOGLE_SERVICE_ACCOUNT_KEY
# - DISCORD_WEBHOOK_URL_PUBLIC
# - DISCORD_WEBHOOK_URL_SALON
```

---

## 機能別詳細仕様

### 1. 認証システム

#### Cloudflare Access 設定

```yaml
# アプリケーション設定
Application:
  name: "Creators Japan Portal"
  domain: "portal.creators-jp.com"
  session_duration: "24h"

# アクセスポリシー
Policies:
  - name: "Admin Access"
    decision: "allow"
    include:
      - email: ["admin@example.com"]  # 管理者メール

  - name: "Client Access"
    decision: "allow"
    include:
      - email_domain: ["creators-jp.com"]
```

#### JWTペイロード構造

```typescript
interface CloudflareAccessJWT {
  aud: string[];           // Application AUD
  email: string;           // ユーザーメール
  exp: number;             // 有効期限
  iat: number;             // 発行日時
  iss: string;             // 発行者URL
  sub: string;             // ユーザーID
  identity_nonce: string;
  custom: {
    role: 'admin' | 'client';
  };
}
```

#### ロール判定ロジック

```typescript
function determineRole(email: string): 'admin' | 'client' {
  const adminEmails = ['admin@example.com'];  // 設定から読み込み
  return adminEmails.includes(email) ? 'admin' : 'client';
}
```

### 2. 記事一覧機能

#### 取得フロー

```
┌─────────────────────────────────────────────────────────────┐
│                   記事一覧取得フロー                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   1. GET /api/articles/:site                                │
│         │                                                   │
│         ▼                                                   │
│   2. KVから前回データ取得                                    │
│      key: `articles:${site}`                                │
│         │                                                   │
│         ├─── KVにデータなし ───▶ 3a. サイトをスクレイピング   │
│         │                            ↓                      │
│         │                       KVに保存                    │
│         │                            ↓                      │
│         │                       データ返却                   │
│         │                                                   │
│         └─── KVにデータあり ───▶ 3b. ハッシュ比較            │
│                                      │                      │
│                    ┌─────────────────┴─────────────────┐   │
│                    │                                   │   │
│               差分なし                             差分あり  │
│                    │                                   │   │
│                    ▼                                   ▼   │
│              KVデータ返却                       新規取得     │
│              (fromCache: true)                 KV更新      │
│                                               データ返却    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### スクレイピング仕様

**対象URL:**
- 公式サイト: `https://creators-jp.com/blog`
- サロン: `https://salon.creators-jp.com/blog`

**取得データ:**

```typescript
interface Article {
  url: string;           // 記事URL
  title: string;         // 記事タイトル（OGP or <h1>）
  publishedDate: string; // 公開日（ISO 8601）
  ogImage?: string;      // OGP画像URL
  excerpt?: string;      // 抜粋（meta description）
}
```

**スクレイピングセレクタ（要調整）:**

```typescript
const SELECTORS = {
  articleList: 'article, .post, .blog-entry',
  title: 'h1, h2, .entry-title',
  date: 'time, .date, .published',
  link: 'a[href*="/blog/"]',
};
```

#### ハッシュ計算

```typescript
import { createHash } from 'crypto';

function calculateArticlesHash(articles: Article[]): string {
  const content = articles
    .map(a => `${a.url}|${a.title}|${a.publishedDate}`)
    .sort()
    .join('\n');

  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}
```

### 3. GA4レポート機能

#### Google Analytics Data API 仕様

**認証方式:** サービスアカウント（JWT）

**取得メトリクス:**

```typescript
const GA4_METRICS = [
  'screenPageViews',      // ページビュー
  'activeUsers',          // アクティブユーザー
  'newUsers',             // 新規ユーザー
  'sessions',             // セッション数
  'averageSessionDuration', // 平均セッション時間
  'bounceRate',           // 直帰率
];

const GA4_DIMENSIONS = [
  'date',                 // 日付
  'pagePath',             // ページパス
  'pageTitle',            // ページタイトル
];
```

**APIリクエスト例:**

```typescript
// 月次サマリー取得
const request = {
  property: `properties/${propertyId}`,
  dateRanges: [{
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  }],
  metrics: GA4_METRICS.map(name => ({ name })),
  dimensions: [{ name: 'date' }],
};

// 人気ページ取得
const topPagesRequest = {
  property: `properties/${propertyId}`,
  dateRanges: [{
    startDate: '2026-01-01',
    endDate: '2026-01-31',
  }],
  metrics: [{ name: 'screenPageViews' }],
  dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
  orderBys: [{
    metric: { metricName: 'screenPageViews' },
    desc: true,
  }],
  limit: 10,
};
```

**レスポンス構造:**

```typescript
interface GA4Report {
  period: string;              // '2026-01'
  summary: {
    pageViews: number;
    users: number;
    newUsers: number;
    sessions: number;
    avgSessionDuration: number;
    bounceRate: number;
  };
  dailyData: {
    date: string;
    pageViews: number;
    users: number;
  }[];
  topPages: {
    path: string;
    title: string;
    views: number;
  }[];
  comparison?: {
    pageViewsChange: number;   // 前月比 %
    usersChange: number;
  };
}
```

### 4. Search Console レポート機能

#### Search Console API 仕様

**認証方式:** サービスアカウント（OAuth 2.0）

**取得データ:**

```typescript
// 検索クエリレポート
const queryRequest = {
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  dimensions: ['query'],
  rowLimit: 50,
};

// ページ別レポート
const pageRequest = {
  startDate: '2026-01-01',
  endDate: '2026-01-31',
  dimensions: ['page'],
  rowLimit: 50,
};
```

**レスポンス構造:**

```typescript
interface GSCReport {
  period: string;
  summary: {
    clicks: number;
    impressions: number;
    ctr: number;           // Click-Through Rate
    position: number;      // 平均掲載順位
  };
  topQueries: {
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
  topPages: {
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }[];
}
```

### 5. Discord通知機能

#### Webhook仕様

**トリガー:**
- 毎月1日 09:00 JST（Cron Trigger）
- 管理者による手動トリガー

**メッセージフォーマット:**

```typescript
interface DiscordEmbed {
  title: string;
  description: string;
  color: number;           // 0x3498db (青)
  fields: {
    name: string;
    value: string;
    inline: boolean;
  }[];
  footer: {
    text: string;
  };
  timestamp: string;       // ISO 8601
}

// 月次レポート例
const monthlyReport: DiscordEmbed = {
  title: '📊 2026年1月 月次レポート',
  description: 'CREATORS JAPAN公式サイトのアクセス状況',
  color: 0x3498db,
  fields: [
    { name: '📈 ページビュー', value: '45,230 (+12.5%)', inline: true },
    { name: '👥 ユーザー数', value: '12,500 (+8.3%)', inline: true },
    { name: '🔍 検索クリック', value: '3,755', inline: true },
    { name: '📝 公開記事数', value: '5件', inline: true },
  ],
  footer: { text: 'Creators Japan Portal' },
  timestamp: new Date().toISOString(),
};
```

---

## API仕様

### エンドポイント一覧

| メソッド | パス | 説明 | 認証 |
|----------|------|------|------|
| GET | `/api/articles/:site` | 記事一覧取得 | 必須 |
| GET | `/api/ga/:site` | GA4データ取得 | 必須 |
| GET | `/api/gsc/:site` | GSCデータ取得 | 必須 |
| GET | `/api/summaries/:site` | 月次サマリー履歴 | 必須 |
| POST | `/api/discord/notify` | Discord通知送信 | admin |
| POST | `/api/cache/clear` | キャッシュクリア | admin |
| GET | `/api/health` | ヘルスチェック | なし |

### 共通レスポンス形式

```typescript
// 成功時
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    fromCache: boolean;
    cachedAt?: string;      // ISO 8601
    requestId: string;
  };
}

// エラー時
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // 'VALIDATION_ERROR', 'API_ERROR', etc.
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
  };
}
```

### 個別API仕様

#### GET /api/articles/:site

**パラメータ:**
- `site`: `'public'` | `'salon'`

**クエリ:**
- `forceRefresh`: `boolean` - キャッシュを無視して再取得

**レスポンス:**

```typescript
interface ArticlesResponse {
  articles: Article[];
  lastUpdated: string;     // ISO 8601
  hash: string;            // 差分検出用
  fromCache: boolean;
}
```

#### GET /api/ga/:site

**パラメータ:**
- `site`: `'public'` | `'salon'`

**クエリ:**
- `period`: `string` - 対象期間 (YYYY-MM)、デフォルト: 当月

**レスポンス:**

```typescript
interface GAResponse {
  report: GA4Report;
  fromCache: boolean;
  cachedAt?: string;
}
```

#### GET /api/gsc/:site

**パラメータ:**
- `site`: `'public'` | `'salon'`

**クエリ:**
- `period`: `string` - 対象期間 (YYYY-MM)

**レスポンス:**

```typescript
interface GSCResponse {
  report: GSCReport;
  fromCache: boolean;
  cachedAt?: string;
}
```

#### POST /api/discord/notify

**リクエストボディ:**

```typescript
interface NotifyRequest {
  site: 'public' | 'salon';
  type: 'monthly' | 'article';
  message?: string;        // カスタムメッセージ（オプション）
}
```

**レスポンス:**

```typescript
interface NotifyResponse {
  sent: boolean;
  messageId?: string;
}
```

---

## データ構造

### KV データ構造

```typescript
// 記事キャッシュ
// Key: articles:public, articles:salon
interface ArticleCache {
  articles: Article[];
  hash: string;
  fetchedAt: string;       // ISO 8601
  source: string;          // スクレイピング元URL
}

// GA4キャッシュ
// Key: ga:public:2026-01, ga:salon:2026-01
interface GACache {
  report: GA4Report;
  fetchedAt: string;
  expiresAt: string;       // TTL参考値
}

// GSCキャッシュ
// Key: gsc:public:2026-01, gsc:salon:2026-01
interface GSCCache {
  report: GSCReport;
  fetchedAt: string;
  expiresAt: string;
}
```

### D1 スキーマ

```sql
-- 設定テーブル
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,                    -- JSON文字列
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 初期設定
INSERT INTO settings (key, value) VALUES
  ('admin_emails', '["admin@example.com"]'),
  ('ga4_property_public', '"xxx"'),
  ('ga4_property_salon', '"xxx"'),
  ('gsc_site_public', '"https://creators-jp.com"'),
  ('gsc_site_salon', '"https://salon.creators-jp.com"'),
  ('discord_webhook_public', '"xxx"'),
  ('discord_webhook_salon', '"xxx"');

-- 月次サマリーテーブル
CREATE TABLE monthly_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,
  year_month TEXT NOT NULL,
  ga_summary TEXT,                        -- JSON
  gsc_summary TEXT,                       -- JSON
  article_count INTEGER DEFAULT 0,
  discord_notified_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(site, year_month)
);

-- 通知ログ
CREATE TABLE notification_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site TEXT NOT NULL,
  type TEXT NOT NULL,                     -- 'monthly', 'article'
  status TEXT NOT NULL,                   -- 'success', 'failed'
  message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- インデックス
CREATE INDEX idx_summaries_site_month ON monthly_summaries(site, year_month);
CREATE INDEX idx_notifications_created ON notification_logs(created_at);
```

---

## エラーハンドリング

### エラーコード体系

```typescript
enum ErrorCode {
  // 認証エラー (401)
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_EXPIRED = 'AUTH_EXPIRED',

  // 認可エラー (403)
  FORBIDDEN = 'FORBIDDEN',
  ADMIN_REQUIRED = 'ADMIN_REQUIRED',

  // バリデーションエラー (400)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_SITE = 'INVALID_SITE',
  INVALID_PERIOD = 'INVALID_PERIOD',

  // 外部APIエラー (502)
  GA4_API_ERROR = 'GA4_API_ERROR',
  GSC_API_ERROR = 'GSC_API_ERROR',
  SCRAPE_ERROR = 'SCRAPE_ERROR',
  DISCORD_ERROR = 'DISCORD_ERROR',

  // 内部エラー (500)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  KV_ERROR = 'KV_ERROR',
  D1_ERROR = 'D1_ERROR',
}
```

### フォールバック戦略

```typescript
async function fetchWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T | null>,
  options: { maxRetries: number; retryDelay: number }
): Promise<{ data: T | null; fromFallback: boolean; error?: Error }> {

  for (let i = 0; i < options.maxRetries; i++) {
    try {
      const data = await primary();
      return { data, fromFallback: false };
    } catch (error) {
      if (i < options.maxRetries - 1) {
        await sleep(options.retryDelay * Math.pow(2, i));
      }
    }
  }

  // フォールバック
  try {
    const data = await fallback();
    return { data, fromFallback: true };
  } catch (error) {
    return { data: null, fromFallback: true, error };
  }
}
```

### ユーザー向けエラーメッセージ

```typescript
const USER_MESSAGES: Record<ErrorCode, string> = {
  AUTH_REQUIRED: 'ログインが必要です',
  AUTH_INVALID: '認証情報が無効です。再ログインしてください',
  AUTH_EXPIRED: 'セッションが期限切れです。再ログインしてください',
  FORBIDDEN: 'この操作を行う権限がありません',
  ADMIN_REQUIRED: '管理者権限が必要です',
  VALIDATION_ERROR: '入力内容に誤りがあります',
  INVALID_SITE: 'サイトの指定が不正です',
  INVALID_PERIOD: '期間の指定が不正です',
  GA4_API_ERROR: 'アクセスデータの取得に失敗しました。キャッシュデータを表示しています',
  GSC_API_ERROR: '検索データの取得に失敗しました。キャッシュデータを表示しています',
  SCRAPE_ERROR: '記事データの取得に失敗しました',
  DISCORD_ERROR: 'Discord通知の送信に失敗しました',
  INTERNAL_ERROR: 'システムエラーが発生しました',
  KV_ERROR: 'キャッシュの読み込みに失敗しました',
  D1_ERROR: 'データベースエラーが発生しました',
};
```

---

## セキュリティ

### 認証フロー

```
┌─────────────────────────────────────────────────────────────┐
│                     認証フロー                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   1. ユーザーがポータルにアクセス                             │
│         │                                                   │
│         ▼                                                   │
│   2. Cloudflare Access が認証チェック                        │
│         │                                                   │
│         ├─── 未認証 ───▶ ログインページへリダイレクト         │
│         │                                                   │
│         └─── 認証済み ───▶ CF-Access-JWT-Assertion ヘッダー付与│
│                                │                            │
│                                ▼                            │
│   3. Workers が JWT を検証                                   │
│         │                                                   │
│         ├─── 無効 ───▶ 401 エラー                           │
│         │                                                   │
│         └─── 有効 ───▶ ロール判定 → リクエスト処理            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### セキュリティ対策

| 脅威 | 対策 |
|------|------|
| CSRF | Cloudflare Accessによるトークン検証 |
| XSS | React のエスケープ + CSP ヘッダー |
| 認証バイパス | Workers で JWT 再検証 |
| 情報漏洩 | ロールベースアクセス制御 |
| API乱用 | Rate Limiting (Cloudflare) |

### Secrets管理

```bash
# Cloudflare Workers Secrets
wrangler secret put GOOGLE_SERVICE_ACCOUNT_KEY
wrangler secret put DISCORD_WEBHOOK_URL_PUBLIC
wrangler secret put DISCORD_WEBHOOK_URL_SALON

# 環境変数（非機密）は wrangler.toml で管理
```

---

## 実装フェーズ

### Phase 1: 基盤構築（3日）

```
Day 1: プロジェクトセットアップ
├── [ ] Vite + React + TypeScript 初期化
├── [ ] Tailwind CSS 設定
├── [ ] Cloudflare Pages デプロイ設定
├── [ ] wrangler.toml 作成
├── [ ] D1 データベース作成・スキーマ適用
└── [ ] KV Namespace 作成

Day 2: 認証実装
├── [ ] Cloudflare Access アプリケーション作成
├── [ ] Access ポリシー設定
├── [ ] Workers での JWT 検証
├── [ ] ロール判定ロジック
└── [ ] 認証ミドルウェア

Day 3: API基盤
├── [ ] Hono セットアップ
├── [ ] 共通エラーハンドリング
├── [ ] KVキャッシュユーティリティ
├── [ ] D1クエリユーティリティ
└── [ ] ヘルスチェックAPI
```

### Phase 2: データ取得機能（4日）

```
Day 4-5: 記事スクレイピング
├── [ ] HTMLパーサー実装
├── [ ] OGP取得ロジック
├── [ ] 差分検出（ハッシュ比較）
├── [ ] KVキャッシュ連携
└── [ ] /api/articles/:site エンドポイント

Day 6: GA4連携
├── [ ] サービスアカウント認証
├── [ ] GA4 Data API クライアント
├── [ ] レポートデータ整形
├── [ ] KVキャッシュ連携
└── [ ] /api/ga/:site エンドポイント

Day 7: GSC連携
├── [ ] Search Console API クライアント
├── [ ] クエリ・ページデータ取得
├── [ ] レポートデータ整形
├── [ ] KVキャッシュ連携
└── [ ] /api/gsc/:site エンドポイント
```

### Phase 3: フロントエンド（4日）

```
Day 8-9: 共通コンポーネント
├── [ ] レイアウト（サイドバー、ヘッダー）
├── [ ] カードコンポーネント
├── [ ] テーブルコンポーネント
├── [ ] グラフコンポーネント（Chart.js）
├── [ ] ローディング・エラー状態
└── [ ] TanStack Query セットアップ

Day 10: 管理者ダッシュボード
├── [ ] サマリーカード
├── [ ] 記事一覧表示
├── [ ] GA4レポート表示
├── [ ] GSCレポート表示
└── [ ] Discord通知ボタン

Day 11: クライアントダッシュボード
├── [ ] サマリーカード
├── [ ] 記事一覧表示（読み取り専用）
├── [ ] GA4レポート表示
├── [ ] GSCレポート表示
└── [ ] レスポンシブ対応
```

### Phase 4: 自動化・仕上げ（3日）

```
Day 12: Discord通知
├── [ ] Webhook クライアント
├── [ ] メッセージフォーマット
├── [ ] 手動送信API
├── [ ] Cron Trigger 設定
└── [ ] 通知ログ保存

Day 13: 月次サマリー
├── [ ] サマリー自動保存
├── [ ] 履歴表示機能
├── [ ] 前月比較計算
└── [ ] エクスポート機能（CSV）

Day 14: テスト・デプロイ
├── [ ] 統合テスト
├── [ ] エラーケーステスト
├── [ ] 本番環境設定
├── [ ] ドメイン設定
└── [ ] 動作確認
```

---

## 成果物チェックリスト

### 必須成果物

- [ ] 動作するポータルサイト
- [ ] 管理者ダッシュボード
- [ ] クライアントダッシュボード
- [ ] 記事一覧機能
- [ ] GA4レポート機能
- [ ] GSCレポート機能
- [ ] Discord自動通知
- [ ] 簡易マニュアル

### 技術成果物

- [ ] GitHub リポジトリ
- [ ] wrangler.toml（設定テンプレート）
- [ ] D1 スキーマファイル
- [ ] 環境変数ドキュメント
- [ ] API仕様書

---

## 改訂履歴

| 日付 | 内容 |
|------|------|
| 2026/01/12 | 初版作成 |
