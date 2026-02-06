# Creators JAPAN Project

クリエイターズジャパンのWebサイト群を WordPress から **Astro + Cloudflare** へ移設するプロジェクト。

## 概要

| 項目 | 内容 |
|------|------|
| クライアント | クリエイターズジャパン（CREATORS JAPAN） |
| 現行環境 | WordPress × 4サイト / X-server / SWELL |
| 移行先 | Astro + Cloudflare Pages / D1 / KV / R2 |
| スケジュール | 2026年内 全4サイト移行完了（1サイト/月） |

## 対象サイト

1. **LMSサイト** - メイン講座・会員制サイト
2. **コーポレートサイト** - 企業情報・LP
3. **サロン記事サイト** - 会員向けコンテンツ
4. **SEOメディア** - ブログ・集客メディア

## ドキュメント

| ファイル | 内容 |
|----------|------|
| `CreatorsJapan_Astro移設提案書.md` | 移行計画・見積・スケジュール |
| `DEVLOG.md` | 開発ログ（時系列） |
| `CLAUDE.md` | AI CLI向けプロジェクトガイド |
| `archive/` | 過去提案書・参考資料 |

## 技術スタック

- **Astro** - SSG/SSR ハイブリッドフレームワーク
- **Cloudflare Pages** - ホスティング
- **Cloudflare D1** - データベース
- **Cloudflare KV** - セッション管理
- **Cloudflare R2** - ファイルストレージ
- **Astro Content Collections** - コンテンツ管理（Markdown / Git管理）
