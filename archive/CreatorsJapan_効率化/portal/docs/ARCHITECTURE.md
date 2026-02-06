# アーキテクチャ設計と拡張性

**作成日**: 2026年1月12日
**対象**: Creators Japan Portal

---

## 目次

1. [現在のアーキテクチャ](#現在のアーキテクチャ)
2. [拡張性の評価](#拡張性の評価)
3. [拡張シナリオと対応方針](#拡張シナリオと対応方針)
4. [注意点と改善推奨](#注意点と改善推奨)

---

## 現在のアーキテクチャ

### ディレクトリ構成

```
portal/
├── functions/
│   └── api/
│       └── [[path]].ts      # 全APIエンドポイント（Hono）
├── workers/
│   ├── auth.ts              # 認証ユーティリティ
│   ├── kv-cache.ts          # KVキャッシュユーティリティ
│   ├── scraper.ts           # 記事スクレイピング
│   ├── ga-client.ts         # GA4 APIクライアント
│   ├── gsc-client.ts        # GSC APIクライアント
│   └── discord.ts           # Discord Webhook
├── src/
│   ├── components/          # Reactコンポーネント
│   ├── lib/
│   │   └── api.ts           # フロントエンドAPIクライアント
│   └── types/
│       └── index.ts         # 共通型定義
├── schema.sql               # D1スキーマ
└── wrangler.toml            # Cloudflare設定
```

### データフロー

```
┌─────────────────────────────────────────────────────────────┐
│                      クライアント                            │
│                   (React SPA)                               │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP/HTTPS
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Cloudflare Access                          │
│               (認証・認可ゲートウェイ)                        │
└─────────────────────┬───────────────────────────────────────┘
                      │ CF-Access-JWT-Assertion
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              Pages Functions (Hono)                         │
│                   /api/*                                    │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ articles │  │    ga    │  │   gsc    │  │ discord  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
   ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
   │ Scraper │  │ GA4 API  │  │ GSC API  │  │ Webhook  │
   └────┬────┘  └────┬─────┘  └────┬─────┘  └──────────┘
        │             │             │
        └─────────────┴─────────────┘
                      │
                      ▼
              ┌──────────────┐
              │   KV Cache   │
              └──────────────┘
```

---

## 拡張性の評価

### 良い点（拡張しやすい）

| 項目 | 評価 | 理由 |
|------|------|------|
| **モジュール分離** | ◎ | workers/配下に機能別に分離済み |
| **キャッシュ抽象化** | ◎ | kv-cache.tsで統一的なインターフェース |
| **型定義** | ○ | 主要な型は定義済み、拡張可能 |
| **エラーハンドリング** | ○ | 共通のレスポンス形式 |
| **サイト切替** | ◎ | public/salonの2サイト対応済み |

### 改善が必要な点

| 項目 | 評価 | 課題 |
|------|------|------|
| **単一ファイルAPI** | △ | [[path]].tsに全エンドポイント集約 |
| **ミドルウェア未適用** | △ | 認証チェックが各エンドポイントで重複 |
| **設定ハードコード** | △ | 一部の設定がコード内に埋め込み |
| **テストなし** | × | ユニットテスト・E2Eテスト未整備 |

---

## 拡張シナリオと対応方針

### シナリオ1: 複数クライアント対応

**要件**: 異なるクライアント（企業）ごとにダッシュボードを提供

**現在の制約**:
- `public` / `salon` の2サイト固定
- 環境変数でGA4/GSC IDを管理

**拡張方針**:
```typescript
// 現在: サイトは固定値
type Site = 'public' | 'salon';

// 拡張: D1でクライアント管理
interface Client {
  id: string;
  name: string;
  sites: {
    id: string;
    name: string;
    url: string;
    ga4PropertyId: string;
    gscSiteUrl: string;
  }[];
}

// API変更
GET /api/clients/:clientId/sites/:siteId/ga
GET /api/clients/:clientId/sites/:siteId/gsc
```

**必要な変更**:
1. D1にclientsテーブル追加
2. APIパスの階層化
3. 環境変数からD1設定への移行
4. マルチテナント認証

**影響範囲**: 大（API設計の変更）

---

### シナリオ2: 新しいデータソース追加

**要件**: YouTube Analytics、Twitter Analytics等の追加

**現在の設計**:
- ga-client.ts, gsc-client.ts が独立
- 同じパターンで追加可能

**拡張方針**:
```
workers/
├── ga-client.ts
├── gsc-client.ts
├── youtube-client.ts    # 新規追加
└── twitter-client.ts    # 新規追加
```

**必要な変更**:
1. 新クライアントファイル作成
2. APIエンドポイント追加
3. 型定義追加
4. フロントエンドコンポーネント追加

**影響範囲**: 小〜中（既存コードへの影響なし）

---

### シナリオ3: タスク管理機能追加

**要件**: クライアントとのタスク共有機能

**現在の設計**:
- D1にsettings, monthly_summaries, notification_logsのみ

**拡張方針**:
```sql
-- 新規テーブル
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  client_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  due_date TEXT,
  assigned_to TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE task_comments (
  id INTEGER PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id),
  author TEXT,
  content TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**必要な変更**:
1. D1スキーマ追加
2. tasks API追加
3. フロントエンドコンポーネント追加

**影響範囲**: 小（既存機能に影響なし）

---

### シナリオ4: 通知チャネル追加

**要件**: Slack、LINE、メール通知

**現在の設計**:
- discord.ts に通知ロジック集約

**拡張方針**:
```typescript
// 通知インターフェースの抽象化
interface NotificationChannel {
  send(message: NotificationMessage): Promise<NotificationResult>;
}

// 各チャネル実装
class DiscordChannel implements NotificationChannel { ... }
class SlackChannel implements NotificationChannel { ... }
class LineChannel implements NotificationChannel { ... }
class EmailChannel implements NotificationChannel { ... }

// ファクトリーパターン
function getNotificationChannel(type: string): NotificationChannel {
  switch (type) {
    case 'discord': return new DiscordChannel();
    case 'slack': return new SlackChannel();
    // ...
  }
}
```

**必要な変更**:
1. 通知インターフェース定義
2. 各チャネル実装
3. 設定テーブル拡張
4. フロントエンド設定画面

**影響範囲**: 中（discord.tsのリファクタリング推奨）

---

## 注意点と改善推奨

### 推奨1: APIルーティングの分割

**現状の問題**:
`functions/api/[[path]].ts` が肥大化のリスク

**推奨**:
```
functions/api/
├── health.ts
├── articles/
│   └── [site].ts
├── ga/
│   └── [site].ts
├── gsc/
│   └── [site].ts
└── discord/
    └── notify.ts
```

**メリット**:
- 関心の分離
- ファイル単位でのデプロイ可能
- チーム開発時の競合軽減

---

### 推奨2: 認証ミドルウェアの適用

**現状の問題**:
各エンドポイントで認証チェックが重複

**推奨**:
```typescript
// 現在
app.post('/api/discord/notify', async (c) => {
  const adminEmails = parseAdminEmails(c.env.ADMIN_EMAILS);
  const userEmail = c.req.header('CF-Access-Authenticated-User-Email');
  if (!userEmail || !adminEmails.includes(userEmail)) { ... }
  // 処理
});

// 改善
app.use('/api/*', authMiddleware);
app.use('/api/admin/*', adminOnlyMiddleware);

app.post('/api/admin/discord/notify', async (c) => {
  // 認証済み前提で処理
});
```

---

### 推奨3: 設定の外部化

**現状の問題**:
サイトURLなどがコード内にハードコード

**推奨**:
```typescript
// 現在
export const SITE_URLS = {
  public: 'https://creators-jp.com',
  salon: 'https://salon.creators-jp.com',
} as const;

// 改善: D1またはKVから取得
async function getSiteConfig(db: D1Database, site: string) {
  return await db.prepare(
    'SELECT * FROM site_configs WHERE site = ?'
  ).bind(site).first();
}
```

---

### 推奨4: テスト基盤の整備

**推奨構成**:
```
portal/
├── tests/
│   ├── unit/
│   │   ├── kv-cache.test.ts
│   │   ├── scraper.test.ts
│   │   └── ga-client.test.ts
│   └── e2e/
│       ├── api.test.ts
│       └── auth.test.ts
├── vitest.config.ts
└── package.json (scripts追加)
```

---

## 拡張性チェックリスト

### 受託拡張時の確認事項

- [ ] 新機能は既存のモジュール構成に適合するか
- [ ] 型定義の追加・変更が必要か
- [ ] D1スキーマの変更が必要か（マイグレーション計画）
- [ ] KVキーの命名規則に従っているか
- [ ] エラーコードの追加が必要か
- [ ] 認証・認可の要件は満たしているか
- [ ] キャッシュ戦略は適切か
- [ ] フロントエンドへの影響は把握しているか

### 非互換変更を避けるためのルール

1. **APIレスポンス形式の維持**
   - `{ success, data, meta }` 形式を変更しない
   - 既存フィールドの削除は慎重に

2. **後方互換性**
   - 新パラメータはオプショナルに
   - 廃止予定の機能は deprecation warning を経由

3. **スキーマ変更**
   - 既存カラムの削除・型変更は避ける
   - 新カラムは DEFAULT 値を設定
