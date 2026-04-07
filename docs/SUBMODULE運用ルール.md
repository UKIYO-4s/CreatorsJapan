# SUBMODULE 運用ルール

この文書は、`CreatorsJapan` 親 repo と `記事/` `コラム/` submodule を安全に更新するための最小手順です。

## 構成

- 親 repo: `UKIYO-4s/CreatorsJapan`
- 記事 repo: `UKIYO-4s/creators-jp-articles`
- コラム repo: `UKIYO-4s/freelance-columns`

## 原則

- 作業対象の repo で先に commit する
- 親 repo は `submodule の参照先更新` だけを commit する
- 親 repo から submodule の中身を直接管理しない

## 更新順

### 記事またはコラムだけ更新する場合

1. `記事/` または `コラム/` に入る
2. 対象 repo で編集する
3. 対象 repo で commit / push する
4. 親 repo に戻る
5. submodule の差分を `git add 記事` または `git add コラム` で取り込む
6. 親 repo で commit / push する

### 親 repo だけ更新する場合

1. 親 repo 直下で編集する
2. 親 repo で commit / push する

## よくある見え方

- 親 repo の `git status` で `m 記事` や `m コラム` が出る
  - submodule 側に未反映の commit または未コミット差分がある
- 親 repo が clean でも submodule 側は dirty のことがある
  - 必ず submodule 側でも `git status` を見る

## 作業前チェック

- どの repo を更新しているか
- どの `README.md` が正本か
- push 先の remote が正しいか

## 完了条件

- 対象 repo が clean
- 親 repo が clean
- 必要な `README.md` が更新済み
