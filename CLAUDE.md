# Creators JAPAN Project - AI CLI Guide

## プロジェクト概要

クリエイターズジャパン（動画編集スクール）のWebサイト群を WordPress から Astro + Cloudflare へ移設するプロジェクト。
提案書作成 → クライアント承認 → 実装 のフェーズで進行中。

### クライアント情報
- クライアント: クリエイターズジャパン（CREATORS JAPAN）
- 担当者: 小野寺ちほ（おのでらちほ）
- 連絡手段: Discord
- 既存サイト: WordPress × 4サイト（X-server / SWELL テーマ）

### 移設対象サイト
1. **LMSサイト** - メイン講座サイト（会員制）
2. **コーポレートサイト** - 企業情報・LP
3. **サロン記事サイト** - 会員向けコンテンツ
4. **SEOメディア** - ブログ・集客メディア

## ファイル構成

```
Astro/
├── CLAUDE.md                              ← このファイル
├── DEVLOG.md                              ← 開発ログ（時系列）
├── README.md                              ← プロジェクト概要
├── CreatorsJapan_Astro移設提案書.md        ← メイン提案書（見積・スケジュール）
├── cloudflare-astro-membership-architecture.md ← 会員制サイト技術設計
└── archive/                               ← 過去資料・参考資料
    ├── クライアント提案メッセージ.md          ← Discord送信済みメッセージ
    ├── 会話過去ログ.txt                     ← 小野寺さんとのDiscordログ
    ├── CreatorsJapan_セキュリティ対策/       ← 過去提案: WPセキュリティ
    └── CreatorsJapan_効率化/               ← 過去提案: 業務効率化（ポータルMVP含む）
```

## コミット規約

```
<タイプ>: <概要>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

タイプ: `feat` / `fix` / `docs` / `refactor` / `test` / `chore`

## プロジェクト固有ルール

### 技術スタック（移設先）
- フロント: Astro（Hybrid SSG + SSR）
- ホスティング: Cloudflare Pages
- DB: Cloudflare D1
- セッション: Cloudflare KV
- ストレージ: Cloudflare R2
- CMS: Astro Content Collections（Markdown / Git管理 / 外部CMS不使用）

### 重要な方針
- **クライアントにはClaude CLIで開発していることを伝えない**
- 相場価格を先に提示し、弊社価格を割引で見せる
- microCMSは使用しない（Astro Content Collections + Claude CLI で代替）
- 月額ランニングコストはCloudflare基本無料 + ドメイン費用のみを目指す
- 1サイト/月ペースで2026年内に全4サイト移行完了

### ドキュメント運用
- README.md: 安定した概要情報のみ
- DEVLOG.md: 日々の作業を時系列で記録
- CLAUDE.md: プロジェクトルール・構成情報
