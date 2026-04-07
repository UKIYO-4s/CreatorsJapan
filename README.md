# CreatorsJapan Workspace

このリポジトリは、`クリエイターズジャパン` 関連の制作物と運用ルールを横断管理するための親ワークスペースです。

現在の役割は、過去の単発セキュリティ案件の保管場所ではなく、`記事` `コラム` `共通運用` を束ねる親 repo です。

ハーネスエンジニアリングの観点では、次の 3 点を重視します。

- 状態が観測できること
- 正本が一意に分かること
- 作業者が変わっても再現できること

そのため、作業開始前と作業完了時は、必ず対象フォルダの `README.md` を更新してください。

## GitHub 運用

- Parent repo: `UKIYO-4s/CreatorsJapan`
- GitHub Project: `CreatorsJapan Workspace`
- Project URL: `https://github.com/users/UKIYO-4s/projects/1`

この repo では、GitHub Project を `横断タスク管理` の正面入口として使います。

## 最初に見るファイル

- `MD運用台帳.md`
- `READMEテンプレート_案件.md`
- `docs/SUBMODULE運用ルール.md`
- `記事/README.md`
- `記事/00_運用ルール/フォルダ運用ルール.md`
- `コラム/README.md`
- `コラム/articles/README.md`

## ルート構成

- `記事/`
  - `https://creators-jp.com/` 向けの案件管理、記事制作、リライト、バナー、公開準備
- `コラム/`
  - `https://salon.creators-jp.com/` 向けのコラム記事制作と投稿運用

このルートは親 Git で管理し、`記事/` と `コラム/` は submodule として接続します。親 repo は `ポータル`, `横断ルール`, `全体台帳`, `運用ハブ` の責務を持ちます。

補足:

- `記事/` と `コラム/` は別運用、別文脈、別ルールがあるため、混在管理しない
- ただし `README.md` による状態管理の考え方は共通にする

## Markdown 管理ルール

各案件、各記事、各企画群では、`README.md` を `運用ハーネス` として使います。

最低限、以下を Markdown に残します。

- 対象サイト
- 状態
- 正本ファイル
- 公開 URL または予定 slug
- 関連素材、生成物、補助スクリプトの場所
- 次アクション
- 最終更新日

## 状態ラベル

このルートでは、状態名をできるだけ統一します。

- `準備中`
- `進行中`
- `確認待ち`
- `公開待ち`
- `公開済み`
- `保留`
- `アーカイブ`

## 正本管理ルール

- `正本ファイル` は `README.md` に明記する
- 一時生成物、古い案、テスト出力は `正本` と同列に置かない
- `images/` `scripts/` `archive/` などの補助フォルダを使う場合は、用途を `README.md` に書く
- 作業完了条件に `README 更新` を含める

## Git 管理方針

- 親 repo: `UKIYO-4s/CreatorsJapan`
- `記事/` submodule: `UKIYO-4s/creators-jp-articles`
- `コラム/` submodule: `UKIYO-4s/freelance-columns`

親 repo の責務:

- ルート README
- 全体台帳
- 共通テンプレート
- 横断ポータルや運用ハブ

submodule の責務:

- 各領域の制作物
- 領域固有のルール
- 領域ごとの履歴管理

## Project の使い方

GitHub Project `CreatorsJapan Workspace` には、親 repo で管理すべき横断タスクを積みます。

載せるもの:

- repo の役割整理
- ポータル要件
- submodule 更新ルール
- 親 repo に置く docs / templates / dashboard 整備

載せないもの:

- 記事本文の細かい制作差分
- コラム単体記事の編集ログ
- 領域固有 repo 内で閉じる作業メモ

## 変更時の基本手順

1. 対象フォルダの `README.md` を確認する
2. 正本ファイルと現在状態を確認する
3. 作業する
4. 状態、正本、次アクション、更新日を `README.md` に反映する
5. 必要なら `MD運用台帳.md` も更新する

submodule を含む更新手順は `docs/SUBMODULE運用ルール.md` を参照します。

## 直近の運用改善対象

- `CreatorsJapan` のトップ方針を現行運用に合わせる
- 親 repo で使うポータルの最小要件整理
- submodule 更新ルールの固定化
- `記事/` 側の案件 README の揃え込み
- `コラム/` 側のルート README 整備
- フォルダ単位での `状態` と `正本` の見える化

## 完了条件

このフォルダが Markdown で管理できている状態とは、次を満たす状態です。

- ルート README から迷わず目的地に行ける
- 各案件または各記事フォルダに `README.md` がある
- `README.md` を見れば、第三者が 3 分以内に状況把握できる
- 正本ファイルと次アクションが明記されている
