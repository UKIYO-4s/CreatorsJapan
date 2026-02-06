# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

クリエイターズジャパン（動画編集スクール）のWebサイト群を WordPress → Astro + Cloudflare へ移設するプロジェクト。
現在は **提案書作成フェーズ**（クライアント承認待ち）。実装コードはまだない。

### クライアント情報
- クライアント: クリエイターズジャパン（CREATORS JAPAN）
- 担当者: 小野寺ちほ（おのでらちほ） / 連絡手段: Discord
- 既存環境: WordPress × 4サイト（X-server / SWELL テーマ）

### 移設対象サイト（1サイト/月、2026年内完了）
1. LMSサイト - メイン講座サイト（会員制）
2. コーポレートサイト - 企業情報・LP
3. サロン記事サイト - 会員向けコンテンツ
4. SEOメディア - ブログ・集客メディア

## アーキテクチャ（移設先）

- フロント: Astro（Hybrid SSG + SSR）
- ホスティング: Cloudflare Pages
- DB: Cloudflare D1 / セッション: KV / ストレージ: R2
- CMS: Astro Content Collections（Markdown + Git管理 / 外部CMS不使用）

## 重要な方針

- **クライアントにはClaude CLIで開発していることを伝えない**
- 提案書では相場価格を先に提示し、弊社価格を割引で見せる
- microCMSは使用しない（Astro Content Collections + Claude CLI で代替、月額¥0）
- 月額ランニングコストはCloudflare基本無料 + ドメイン費用のみを目指す

## ファイル構成

- `CreatorsJapan_Astro移設提案書.md` - メイン提案書（見積・スケジュール・オプション全て）
- `DEVLOG.md` - 開発ログ（時系列、日々の作業記録）
- `archive/` - 過去資料（送信済みメッセージ、Discordログ、過去提案書、技術設計ざっくり版）

## コミット規約

```
<タイプ>: <概要>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

タイプ: `feat` / `fix` / `docs` / `refactor` / `test` / `chore`

## ドキュメント運用ルール

- **README.md**: 安定した概要情報のみ。日々の作業詳細は書かない
- **DEVLOG.md**: 日々の作業を時系列で記録（実施内容・成果・課題の3セクション）
- **CLAUDE.md**: プロジェクトルール・構成情報（このファイル）
- 作業を行ったら必ず DEVLOG.md に記録を追加する
