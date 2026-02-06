
# Cloudflare × Astro 本気構成  
## 会員制（ログイン / マイページ）アーキテクチャ設計

---

## 概要
Cloudflare × Astro を使って  
**高速・安全・拡張しやすい会員制サイト** を構築するための実践構成。

- フロント：Astro（Hybrid：静的 + SSR）
- ホスティング：Cloudflare Pages
- 認証：Astro Sessions（Cloudflare KV）
- バックエンド処理：Astro Actions / Pages Functions
- DB：Cloudflare D1
- ストレージ：Cloudflare R2

---

## 全体アーキテクチャ

```
Browser
  ↓
Cloudflare Edge
  ├ Pages（静的HTML / SSR）
  ├ Pages Functions / Workers
  ├ KV（セッション）
  ├ D1（ユーザーDB）
  └ R2（ファイル）
```

### 基本思想
- **セッション情報**：KV（短期・高速）
- **永続データ**：D1（正）
- **重いJSは最小限**（必要な部分だけ island 化）

---

## ルーティング設計

### 公開ページ（静的）
- `/`
- `/pricing`
- `/blog/*`
- `/faq`

```ts
export const prerender = true;
```

### 会員ページ（SSR）
- `/login`
- `/app`
- `/app/account`
- `/app/settings`
- `/app/billing`

```ts
export const prerender = false;
```

---

## 認証方式（推奨）

### 採用方式
- Cookie ベースセッション（HttpOnly）
- Astro Sessions + Cloudflare KV

### セッション内容例
```ts
session.set("userId", user.id);
```

---

## ディレクトリ構成（実践）

```
src/
├ middleware.ts
├ pages/
│  ├ login.astro
│  └ app/
│     ├ index.astro
│     ├ account.astro
│     └ settings.astro
├ actions/
│  ├ auth.ts
│  └ profile.ts
├ lib/
│  ├ db.ts
│  └ auth.ts
```

---

## セキュリティ対策（必須）

- HttpOnly / Secure Cookie
- CSRF 対策
- レート制限
- Cloudflare Turnstile
- ログイン監査ログ

---

## 運用・デプロイ

- Cloudflare Pages（GitHub連携）
- Preview / Production 環境分離
- D1 / KV / R2 分離管理

---
