<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

# Xissmie 用 E2E テスト

Misskey 本家を取り込んだときに **Xissmie 独自の機能が消えたり壊れたりしていないか** を CI で検知するためのテストです。

| 対象 | 場所 | 実行方法 |
| --- | --- | --- |
| フロントエンド (Playwright) | `packages/frontend/test/e2e-xissmie/` | `pnpm start-server-and-test start:test http://localhost:61812 "pnpm --filter frontend test:e2e"` |
| バックエンド (Vitest) | `packages/backend/test/e2e/xissmie/` | `pnpm --filter backend test:e2e test/e2e/xissmie` |

どちらも GitHub Actions の既存ジョブ (`E2E tests (frontend)` / `E2E tests (backend)`) でそのまま実行されます。

## 方針

- 本家の `packages/frontend/test/e2e/` は **編集しない**。Xissmie はログイン・新規登録を Xfolio 経由に置き換えているため本家のシナリオは通らないが、
  手を入れると本家の取り込みのたびにコンフリクトするので、`playwright.config.ts` の `testDir` だけを `./test/e2e-xissmie` に向けている。
- このディレクトリのテストは本家のファイルを import せず、ここだけで完結させる(本家のヘルパーが変わっても巻き込まれないように)。
- Xissmie 独自のコンポーネントに付ける `data-testid` は `xissmie-` から始める。
- Xfolio (外部サイト) への遷移は `fixtures.ts` で常にスタブしている。遷移先 URL の確認だけを行い、外部には出ない。
- Xfolio API に問い合わせる処理 (`xissmie/purchased-*`、ストアの同期ジョブ) はテスト環境から到達できないので対象外。
  ストア絵文字はバックエンドのテストで DB に直接用意して、所有チェックを確認している。

## カバーしている Xissmie 独自仕様

- 新規登録が Xfolio での登録案内になっている / ログインが「クロスフォリオでログイン」と「ID/PASS でログイン」の選択になっている
- 「クロスフォリオでログインする」「クロスフォリオに登録する」で Xfolio に遷移する
- パスキーでのログインボタンがない
- Xfolio からのワンタイムトークンログイン (`POST /login-with-token`)。使用済み・トークンなしの場合のエラー表示
- 連合オフ: グローバルタイムラインのタブ・投稿フォームの「連合なし」切り替えがない
- ナビゲーションバーの「クロスフォリオ」「Xissmieを支援する」
- 削除したメニュー (アンテナ・照会・ツール)、設定 (パスワード変更・ログイントークン再生成・アカウントの引っ越し) が復活していない
- (バックエンド) ログイン用トークン、`Xissme` トークン、パスワード変更の無効化、ストア絵文字の所有チェック、
  ストア一覧 API、Xfolio 商品ページへのリダイレクト、robots.txt の AI クローラーブロック、`xfolio_api_host` meta タグ

## 本家を取り込むときにやること

1. 取り込み後、このテストとバックエンドの `test/e2e/xissmie/` を実行する。落ちたら「Xissmie の機能が消えた/壊れた」か「本家の仕様変更でテストの直しが必要」かを切り分ける。
2. 本家の `packages/frontend/test/e2e/` にシナリオが増えていたら、Xissmie でも意味のあるものをここへ移植する
   (`git diff <前回の本家タグ> <今回の本家タグ> -- packages/frontend/test/e2e` で確認できる)。
3. 本家のコンポーネントの `data-testid` が変わったら `utils.ts` を直す。
4. Xissmie に独自機能を追加・変更したら、ここかバックエンドの `test/e2e/xissmie/` にテストを追加する。
