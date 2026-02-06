# トラブルシューティングガイド

**作成日**: 2026年1月12日
**対象**: Creators Japan Portal MVP開発

---

## 目次

1. [Phase 1: 環境セットアップで発生したエラー](#phase-1-環境セットアップで発生したエラー)
2. [Phase 2: API実装で発生したエラー](#phase-2-api実装で発生したエラー)
3. [エラー究明の一般的手法](#エラー究明の一般的手法)
4. [今後発生しうるエラーと対策](#今後発生しうるエラーと対策)

---

## Phase 1: 環境セットアップで発生したエラー

### 1.1 Cloudflare Pages Functions エラー 1101

**症状**
```
curl https://xxx.creators-japan-portal.pages.dev/api/health
→ error code: 1101
```

**原因**
Cloudflare Pages FunctionsでHonoフレームワークを使用する際、`export const onRequest = app.fetch` という形式では正しく動作しなかった。

**究明方法**
1. シンプルなPages Function（Honoなし）を作成してテスト
2. シンプルな関数は動作 → Honoの設定問題と特定
3. Hono公式ドキュメントでPages Functions用の記法を確認

**解決策**
```typescript
// NG: 動作しない
export const onRequest = app.fetch;

// OK: 正しい形式
export const onRequest: PagesFunction<Env> = async (context) => {
  return app.fetch(context.request, context.env);
};
```

**教訓**
- Cloudflare Pages FunctionsとWorkersでは微妙に異なる記法が必要
- エラー1101はWorker内部のランタイムエラーを示す

---

### 1.2 TypeScript型インポートエラー

**症状**
```
error code: 1101 (デプロイ後)
```

**原因**
`functions/api/[[path]].ts` から `../../src/types` をインポートしていたが、
Pages Functionsのビルド時にパス解決に失敗していた。

**究明方法**
1. ビルドは成功するがデプロイ後にエラー
2. 型定義のインポートパスを疑う
3. インラインで型定義を記述してテスト → 成功

**解決策**
```typescript
// NG: 外部ファイルからインポート
import type { Env } from '../../src/types';

// OK: インラインで定義
interface Env {
  CACHE?: KVNamespace;
  DB?: D1Database;
  // ...
}
```

**教訓**
- Pages Functionsでは `functions/` ディレクトリ外のファイル参照に注意
- 共有型は `workers/` ディレクトリに配置して参照する方が安全

---

## Phase 2: API実装で発生したエラー

### 2.1 Hono ステータスコード型エラー

**症状**
```
error TS2769: No overload matches this call.
Argument of type 'number' is not assignable to parameter of type 'ContentfulStatusCode'
```

**原因**
Hono v4では `c.json(data, status)` の `status` パラメータに
`number` 型ではなく特定のHTTPステータスコードのユニオン型が必要。

**究明方法**
1. TypeScriptコンパイルエラーを確認
2. Honoの型定義を確認 → `ContentfulStatusCode` 型を発見
3. リテラル型での定義が必要と判明

**解決策**
```typescript
// NG: number型
function errorResponse(code: string, message: string, status: number) { ... }

// OK: リテラル型ユニオン
type StatusCode = 400 | 401 | 403 | 404 | 500 | 502;
function errorResponse(code: string, message: string, status: StatusCode) { ... }
```

**教訓**
- Honoの型システムは厳格なので、適切な型定義が必要
- HTTPステータスコードは明示的にリテラル型で定義する

---

### 2.2 未使用変数エラー

**症状**
```
error TS6133: 'period' is declared but its value is never read.
error TS6133: 'endDate' is declared but its value is never read.
error TS6133: 'publishedDate' is declared but its value is never read.
```

**原因**
TypeScriptのstrict設定で未使用変数が検出された。

**究明方法**
TypeScriptコンパイルエラーで行番号が示されるため、該当箇所を確認。

**解決策**
```typescript
// NG: 未使用の変数
const { startDate, endDate, period } = calculateDateRange();

// OK: 使わない変数を除外
const { startDate, endDate } = calculateDateRange();

// OK: アンダースコアプレフィックスで未使用を明示
function transform(startDate: string, _endDate: string) { ... }
```

**教訓**
- 分割代入では必要な変数のみ取得する
- 引数で受け取るが使わない場合は `_` プレフィックスを使う

---

### 2.3 スクレイピングエラー

**症状**
```json
{
  "success": false,
  "error": {
    "code": "SCRAPE_ERROR",
    "message": "記事データの取得に失敗しました"
  }
}
```

**原因**
1. 対象サイトのHTML構造が想定と異なる
2. ボット対策によるブロック
3. サイトが存在しない/アクセス不可

**究明方法**
1. `console.error` でエラー詳細を確認（Cloudflareログ）
2. 対象サイトに直接アクセスしてHTML構造を確認
3. curlでサイトにアクセスしてレスポンスを確認

**解決策（暫定）**
```typescript
// エラー時はモックデータを返す（開発継続のため）
} catch (error) {
  console.error('Scrape error:', error);
  const mockArticles = [...];
  return c.json(successResponse({
    articles: mockArticles,
    isMockData: true,
  }));
}
```

**本番対応時の手順**
1. 対象サイトのHTML構造を調査
2. セレクタを調整
3. 必要に応じてUser-Agent変更やリクエスト間隔調整

---

### 2.4 KV/D1バインディング未設定

**症状**
当初、Cloudflare Dashboardでの手動設定が必要と想定していたが、
`wrangler pages deploy` で自動設定されていた。

**究明方法**
Cloudflare Dashboard → Pages → Settings → Functions でバインディング状況を確認。

**結論**
- `wrangler.toml` に正しいID設定があれば、デプロイ時に自動反映される
- Dashboardでの手動設定は不要（ただし確認は有用）

---

## エラー究明の一般的手法

### 3.1 段階的切り分け

```
1. ローカルビルド確認
   npm run build → TypeScriptエラーの特定

2. ローカル実行確認
   npm run dev → ランタイムエラーの特定

3. デプロイ後確認
   curl API → 本番環境固有のエラー特定

4. ログ確認
   wrangler pages deployment tail → リアルタイムログ
```

### 3.2 シンプル化による切り分け

問題が複雑な場合：
1. 最小限のコードで動作確認
2. 機能を1つずつ追加
3. どの追加でエラーが発生するか特定

### 3.3 Cloudflare固有のデバッグ

```bash
# リアルタイムログ
wrangler pages deployment tail

# KVの内容確認
wrangler kv:key list --namespace-id=xxx

# D1のクエリ実行
wrangler d1 execute portal-db --command="SELECT * FROM settings"
```

---

## 今後発生しうるエラーと対策

### 4.1 Google API認証エラー

**予想される症状**
- 401 Unauthorized
- Invalid JWT signature

**対策**
1. サービスアカウントキーの形式確認（JSON）
2. GA4/GSCへの権限付与確認
3. JWTの有効期限確認（1時間）

### 4.2 レート制限

**予想される症状**
- 429 Too Many Requests
- Quota exceeded

**対策**
1. KVキャッシュの活用（TTL設定済み）
2. リクエスト間隔の調整
3. エクスポネンシャルバックオフの実装

### 4.3 CORS エラー

**予想される症状**
- ブラウザからAPIアクセス時にCORSエラー

**対策**
```typescript
// Honoミドルウェアでcors設定
import { cors } from 'hono/cors';
app.use('/*', cors());
```

### 4.4 Cloudflare Access認証エラー

**予想される症状**
- ログインしているのに401エラー

**対策**
1. CF-Access-Authenticated-User-Email ヘッダー確認
2. Access設定でアプリケーションドメイン確認
3. ポリシー設定確認

---

## 参考リンク

- [Cloudflare Pages Functions Docs](https://developers.cloudflare.com/pages/functions/)
- [Hono with Cloudflare](https://hono.dev/getting-started/cloudflare-pages)
- [GA4 Data API](https://developers.google.com/analytics/devguides/reporting/data/v1)
- [Search Console API](https://developers.google.com/webmaster-tools/search-console-api-original)
