# Xissmie 独自仕様書

Xissmie は [Misskey](https://github.com/misskey-dev/misskey) をベースとしたフォークで、[Xfolio（クロスフォリオ）](https://xfolio.jp) の会員専用 SNS として運用されている。本書では Misskey 本家との差分（独自実装）を整理する。

---

## 1. Xfolio 連携

### 1.1 認証・ログイン

Xissmie のアカウントは Xfolio の会員に紐づいており、ログインフローが Misskey 本家と大きく異なる。

| 項目 | 内容 |
|------|------|
| **ログイン方法** | 「クロスフォリオでログインする」ボタンで `xfolio.jp/mypage/xissmie_setting` へ遷移し、Xfolio 側で認証後にワンタイムトークン付きで戻ってくる |
| **トークンログイン** | `POST /login-with-token` でワンタイムトークンを受け取り、`login-with-token` API でセッションを確立 |
| **新規登録** | Xissmie 独自の登録フォームはなく、「クロスフォリオに登録する」ボタンで Xfolio のマイページへ誘導。Xfolio 側で Xissmie ユーザー名を登録する |
| **パスワード忘れ** | Xfolio のマイページ（`xissmie_setting`）で ID/PASS を確認するよう案内 |
| **ID/PASS ログイン** | Xfolio 経由の他に、従来の ID/PASS でのサインインダイアログも残されている |

#### 関連ファイル

- **バックエンド**: `models/XissmeLoginToken.ts`, `endpoints/login-with-token.ts`, `core/SignupService.ts`, `endpoints/admin/accounts/get-login-token.ts`
- **フロントエンド**: `MkXfolioSigninDialog.vue`, `MkXfolioSignin.vue`, `MkXfolioSignin.input.vue`, `MkVisitorDashboard.vue`, `MkForgotPassword.vue`, `MkSignupDialog.rules.vue`, `pages/login-with-token.vue`

### 1.2 API トークン

Misskey 本家ではランダム文字列のトークンを使うが、Xissmie ではプレフィックス `Xissme` が付いたトークンを生成する。従来の 16 文字トークンとの後方互換も維持している。

```
// packages/backend/src/misc/token.ts
export default () => 'Xissme' + secureRndstr(32);
export const isNativeUserToken = (token: string) => token.length === 16 || token.startsWith('Xissme');
```

### 1.3 設定

バックエンドの設定ファイル（`default.yml`）に以下の独自キーが追加されている。

| キー | 説明 |
|------|------|
| `xfolioApiHost` | Xfolio API のホスト名（デフォルト: `xfolio.jp`） |
| `xfolioApiToken` | Xfolio API の認証トークン |

フロントエンドには HTML メタタグ `xfolio_api_host` 経由でホスト名が渡される。

---

## 2. ストア機能（絵文字・アバターデコレーション）

Xfolio のショップと連携し、カスタム絵文字やアバターデコレーションの販売・購入管理を行う。

### 2.1 概要

- Xfolio 側でクリエイターが絵文字・デコレーションを販売
- Xissmie のバックエンドが Xfolio API から商品一覧・購入情報を定期同期
- **未購入のストア絵文字/デコレーションは使用不可**（投稿・リアクション・プロフィール等で所有チェック）
- 未購入時は「Xfolioで購入する」への誘導を表示

### 2.2 独自 API エンドポイント

| エンドポイント | メソッド | 説明 |
|----------------|----------|------|
| `xissmie/store-emojis` | POST | ストア絵文字一覧を取得 |
| `xissmie/store-avatar-decorations` | POST | ストアデコレーション一覧を取得 |
| `xissmie/purchased-emojis` | POST | 購入済み絵文字を取得（同期実行含む） |
| `xissmie/purchased-avatar-decorations` | POST | 購入済みデコレーションを取得 |

### 2.3 HTTP ルート（リダイレクト）

| パス | 遷移先 |
|------|--------|
| `GET /xissmie/store/emojis/:emoji` | Xfolio のショップページ |
| `GET /xissmie/store/avatar-decorations/:decoration` | Xfolio のショップページ |

### 2.4 所有チェックが行われる箇所

| 箇所 | 説明 |
|------|------|
| **ノート投稿** (`NoteCreateService`) | MFM 内のストア絵文字（名前に `_e_` または `-store-` を含む）の所有を確認 |
| **リアクション** (`ReactionService`) | `isInStore` な絵文字でリアクションする際に `user_owned_emoji` を確認 |
| **プロフィール更新** (`endpoints/i/update.ts`) | 自己紹介 MFM 内のストア絵文字の所有チェック + 購入済みデコレーションのマージ |
| **ページ作成** (`PageService`) | ページ本文のストア絵文字チェック |
| **Play (Flash)** (`flash/create.ts`, `flash/update.ts`) | summary 内のストア絵文字チェック |

### 2.5 定期同期ジョブ

- ジョブ名: `xissmieSyncStoreContents`
- スケジュール: **毎時 0 分** (`0 * * * *`)
- 処理: Xfolio API から絵文字カタログ・デコレーションカタログを取得し、ローカル DB と同期

### 2.6 DB エンティティ（独自追加）

| テーブル | 説明 |
|----------|------|
| `user_owned_emoji` | ユーザーが購入した絵文字の所有情報 |
| `user_owned_avatar_decoration` | ユーザーが購入したアバターデコレーションの所有情報 |
| `xissme_login_token` | Xfolio からのワンタイムログイントークン |

### 2.7 既存テーブルへの追加カラム

**`emoji` テーブル**: `isInStore`, `isPublic`, `storeProductId`, `storeAuthorId`, `storeAuthorName`

**`avatar_decoration` テーブル**: `isInStore`, `isPublic`, `storeProductId`, `storeAuthorId`, `storeAuthorName`

#### 関連マイグレーション

- `1737701029100-xissmeLoginToken.js`
- `1758601428132-xissmie-store.js`
- `1760524557161-xissmie-store-2.js`
- `1760859360424-xissmie-store-3.js`
- `1764643060135-xissmie-store-public.js`
- `1769700000000-add-store-product-id.js`

---

## 3. 連合（フェデレーション）の非表示

Xissmie は Xfolio 会員専用の閉じた SNS として運用されるため、連合機能がデフォルトで無効化されている。

### 3.1 DB デフォルト

- マイグレーション `1754019326356-tweakDefaultFederationSettings.js` で `meta.federation` のデフォルト値を `'all'` → `'none'` に変更

### 3.2 グローバルタイムライン（GTL）の除外

`basicTimelineTypes` から `'global'` を除外し、`['home', 'local', 'social']` のみとなっている。

```
// packages/frontend/src/timelines.ts
export const basicTimelineTypes = ['home', 'local', 'social'] as const;
```

これにより、タイムラインタブ・チュートリアル等の標準 UI から GTL が表示されない。

### 3.3 連合オフ時に隠れる UI 要素

`instance.federation === 'none'` の条件で以下の UI が非表示になる。

| UI 要素 | ファイル | 挙動 |
|---------|----------|------|
| **ウィジェット** | `MkWidgets.vue`, `widgets/index.ts` | `federation`, `instanceCloud` ウィジェットを非表示 |
| **ステータスバー** | `statusbars.vue`, `statusbar.statusbar.vue` | 「Federation」種別を非表示 |
| **インスタンスティッカー** | `settings/preferences.vue` | 設定項目自体を非表示 |
| **探索ページ** | `explore.users.vue` | ローカル/連合ユーザー切替タブを非表示（ローカルのみ） |
| **ユーザー検索** | `search.user.vue` | origin 選択を非表示（`local` 固定） |
| **ノート検索** | `search.note.vue` | 連合前提の検索スコープを非表示 |
| **ミュート設定** | `settings/mute-block.vue` | インスタンスミュートフォルダを非表示 |
| **ユーザー選択** | `MkUserSelectDialog.vue` | リモートユーザー選択を無効化（`localOnly` 強制） |
| **統計** | `MkInstanceStats.vue` | 連合チャート・ヒートマップを非表示（モデレータは例外的に表示） |
| **プライバシー設定** | `settings/privacy.vue` | 連合に関する確認ダイアログを省略 |
| **ログイン誘導** | `please-login.ts` | リモートで開くオプションを非表示 |

### 3.4 ActivityPub リンクの抑制

連合が無効の場合、`note.pug` / `user.pug` で `application/activity+json` の `<link rel="alternate">` を出力しない。

---

## 4. UI の簡素化（連合以外）

Xissmie では閉じた会員向け SNS としての運用に不要な UI 要素が多数削除・非表示にされている。主に `253bd922f7`（xissmie用に要素を落とす）と `3563f44839`（デグレしていた非表示部分を戻す）のコミットで反映。

### 4.1 ビジターダッシュボード（未ログイン画面）

| 変更 | ファイル | 詳細 |
|------|----------|------|
| **サーバー統計の削除** | `MkVisitorDashboard.vue` | ユーザー数・ノート数の表示ブロックを削除 |
| **アクティブユーザーチャートの削除** | 同上 | `XActiveUsersChart` コンポーネントの表示を削除 |
| **「他のサーバーを探す」ボタンの削除** | 同上 | `exploreOtherServers` リンクを削除 |
| **招待制の警告の削除** | 同上 | `invitationRequiredToRegister` の `MkInfo` を削除 |
| **ロゴ画像の非表示** | 同上 | 背景色でロゴが見えなくなる問題でコメントアウト。テキストの `instanceName` のみ表示 |

### 4.2 ナビゲーションメニュー

| 変更 | ファイル | 詳細 |
|------|----------|------|
| **「照会」メニューの削除** | `navbar.ts` | `lookup`（照会）の定義自体を削除 |
| **「アンテナ」メニューの削除** | 同上 | `antennas`（アンテナ）の定義自体を削除 |
| **「ツール」メニューの削除** | 同上 + `common.ts` | `tools`（ツール）の定義と、インスタンスメニュー内のツールサブメニュー・お問い合わせリンクを削除 |

### 4.3 「このサーバーについて」ページ

| 変更 | ファイル | 詳細 |
|------|----------|------|
| **「連合」タブの削除** | `about.vue` | `federation` タブを削除 |
| **「チャート」タブの削除** | 同上 | `charts` タブ（`MkInstanceStats`）を削除。タブは `overview` と `emojis` の 2 つのみ |
| **サーバー統計セクションの削除** | `about.overview.vue` | ユーザー数・ノート数の `FormSection` を削除 |
| **Well-known resources の削除** | 同上 | `host-meta`, `nodeinfo`, `robots.txt` 等へのリンクセクションを削除 |

### 4.4 設定ページ

| 変更 | ファイル | 詳細 |
|------|----------|------|
| **「ドライブ」設定リンクの再表示** | `settings/index.vue` | 2025/02の調整で再追加され、現在はサイドメニューに表示される |
| **「アカウント引っ越し」設定の削除** | 同上 + `settings/other.vue` | サイドメニューの `accountMigration` リンクを削除。`other.vue` の引っ越しフォルダも削除 |
| **「パスワード変更」の削除** | `settings/security.vue` | パスワード変更セクションを丸ごと削除（Xfolio 経由でのログインが前提のため） |
| **「ログイントークン再生成」の削除** | 同上 | `regenerateLoginToken` ボタンとロジックを削除 |
| **「注目ノートをTLに表示」スイッチの非表示** | `settings/other.vue` | `showFeaturedNotesInTimeline` をコメントアウト |
| **「エラー報告を送る」スイッチの非表示** | 同上 | `reportError` をコメントアウト |

### 4.5 ウィジェット

| 変更 | ファイル | 詳細 |
|------|----------|------|
| **サーバーメトリクスの除外** | `widgets/index.ts` | `serverMetric` をウィジェット選択肢から削除 |
| **オンラインユーザー数の除外** | 同上 | `onlineUsers` を削除 |
| **ジョブキューの除外** | 同上 | `jobQueue` を削除 |
| **誕生日フォロイーの除外** | 同上 | `birthdayFollowings` を削除 |

### 4.6 ユーザーページ

| 変更 | ファイル | 詳細 |
|------|----------|------|
| **凍結・サイレンス警告の非表示** | `pages/user/home.vue` | `isSuspended` / `isSilenced` の警告バーをコメントアウト |

### 4.7 猫耳アバター

| 変更 | ファイル | 詳細 |
|------|----------|------|
| **猫耳の内部レイヤーの無効化** | `MkAvatar.vue` | 猫耳の `layer`（アバター画像を背景に使う装飾部分）を `v-if="false"` で非表示 |

### 4.8 ストリーム切断インジケーター

| 変更 | ファイル | 詳細 |
|------|----------|------|
| **切断メッセージの非表示** | `ui/_common_/common.vue` | `XStreamIndicator` をコメントアウトし、WebSocket 切断時のインジケーターを非表示に |

### 4.9 管理画面

| 変更 | ファイル | 詳細 |
|------|----------|------|
| **ジョブキュー操作ボタンの無効化** | `admin/job-queue.vue` | Add job / Resume / Pause ボタンをコメントアウト（Promote と Empty は残存） |

### 4.10 その他

| 変更 | ファイル | 詳細 |
|------|----------|------|
| **広告の「いいね」ボタンの非表示** | `MkAd.vue` | 広告メニュー内のいいねボタンをコメントアウト |
| **Drop and Fusion の SPACE モード非表示** | `drop-and-fusion.vue` | ゲームモード選択から SPACE オプションをコメントアウト |
| **entrance の MkInstanceCardMini 非表示** | `welcome.entrance.classic.vue` | 連合インスタンスのカード表示をコメントアウトし、アイコン+ホスト名のみの簡易表示に |

---

## 5. ナビゲーション・メニューの変更

### 5.1 独自メニュー項目

| 項目 | アイコン | 動作 |
|------|----------|------|
| **クロスフォリオ** | `ti-heart-share` | Xfolio のトップページを新しいタブで開く |
| **Xissmieを支援する** | `volunteer_activism` | Xfolio の Xissmie ファンコミュニティページを新しいタブで開く |

### 5.2 デフォルトメニュー構成

`store.ts` / `preferences/def.ts` でデフォルトメニューに `xfolio` および `xfolioSupport` が含まれている。Misskey 本家にある `lists`, `favorites`, `pages`, `play`, `gallery`, `games`, `about` 等はデフォルトには含まれない（設定で追加は可能）。

---

## 6. AI クローラー対策

`robots.txt` で主要な AI クローラーをブロックしている。

```
User-agent: Google-Extended   → Disallow: /
User-agent: GPTBot            → Disallow: /
User-agent: facebookbot       → Disallow: /
User-agent: anthropic-ai      → Disallow: /
User-agent: ClaudeBot          → Disallow: /
User-agent: Applebot-Extended  → Disallow: /
User-agent: meta-externalagent → Disallow: /
User-agent: cohere-ai          → Disallow: /
User-agent: CCBot              → Disallow: /
User-agent: omgili / omgilibot → Disallow: /
User-agent: Diffbot            → Disallow: /
```

それ以外のクローラー（`User-agent: *`）は `allow: /` としている。

---

## 7. フロントエンドのカスタム実装

### 7.1 絵文字ピッカー

- 購入済みストア絵文字をキャッシュし、検索で優先表示（`search-emoji.ts`）
- 未購入のストア絵文字をリアクションで使おうとした場合、購入誘導ダイアログを表示（`xissmie.ts`）

### 7.2 カスタム絵文字コンポーネント

- `MkCustomEmoji.vue`: 未購入のストア絵文字には「Xfolioで購入する」メニューを追加

### 7.3 絵文字一覧ページ

- `emojis.emoji.vue`: ストア絵文字の場合、「Xfolioで購入する」アクションを表示

### 7.4 アバターデコレーション設定

- `settings/avatar-decoration.vue`: `xissmie/*` API を使用し、購入必須のフローを実装

### 7.5 購入キャッシュ

- `store.ts` に `xissmiePurchasedEmojisCache` を保持し、毎回の API 呼び出しを回避

---

## 8. バックエンドのコアサービス

### 8.1 XissmieStoreService

Xfolio API との通信を担当する中核サービス。

| メソッド | 説明 |
|----------|------|
| `fetchStoreEmojis()` | 絵文字カタログを Xfolio から取得し DB に同期 |
| `fetchStoreDecorations()` | デコレーションカタログを同期 |
| `getPurchasedEmojis(userId)` | ユーザーの購入済み絵文字を取得（Xfolio に問い合わせ） |
| `getPurchasedDecorations(userId)` | 購入済みデコレーションを取得 |

### 8.2 通信先 Xfolio API

| パス | 説明 |
|------|------|
| `POST /api/v1/xissmie/emojis_list` | 絵文字カタログ取得 |
| `POST /api/v1/xissmie/decorations_list` | デコレーションカタログ取得 |
| `POST /api/v1/xissmie/users_purchased_emojis` | ユーザー購入絵文字 |
| `POST /api/v1/xissmie/users_purchased_decorations` | ユーザー購入デコレーション |

---

## 9. Service Worker の変更

- `packages/sw/src/sw.ts`: メンテナンス時の通知文言を「Xissmie」ブランドに変更

---

## 10. 埋め込みフロントエンド

- `frontend-embed/src/pages/note.vue`: リモートサーバーのノートを拒否
- `frontend-embed/src/pages/user-timeline.vue`: リモートユーザーを拒否

---

## 変更箇所の全体マップ

```
packages/
├── backend/
│   ├── src/
│   │   ├── config.ts                           # xfolioApiToken, xfolioApiHost 追加
│   │   ├── misc/token.ts                       # Xissme プレフィックストークン
│   │   ├── misc/is-native-token.ts             # トークン判定の拡張
│   │   ├── models/
│   │   │   ├── XissmeLoginToken.ts             # 新規テーブル
│   │   │   ├── UserOwnedEmoji.ts               # 新規テーブル
│   │   │   ├── UserOwnedAvatarDecoration.ts    # 新規テーブル
│   │   │   ├── Emoji.ts                        # ストア系カラム追加
│   │   │   └── AvatarDecoration.ts             # ストア系カラム追加
│   │   ├── core/
│   │   │   ├── XissmieStoreService.ts          # 新規サービス
│   │   │   ├── SignupService.ts                # ログイントークン作成追加
│   │   │   ├── NoteCreateService.ts            # ストア絵文字所有チェック追加
│   │   │   ├── ReactionService.ts              # ストア絵文字所有チェック追加
│   │   │   ├── PageService.ts                  # ストア絵文字所有チェック追加
│   │   │   ├── AvatarDecorationService.ts      # ストア対応
│   │   │   ├── entities/UserEntityService.ts   # 購入デコマージ
│   │   │   ├── CoreModule.ts                   # XissmieStoreService DI 登録
│   │   │   └── QueueService.ts                 # xissmieSyncStoreContents ジョブ追加
│   │   ├── server/
│   │   │   ├── api/endpoints/
│   │   │   │   ├── login-with-token.ts         # 新規エンドポイント
│   │   │   │   ├── admin/accounts/get-login-token.ts  # 新規
│   │   │   │   ├── xissmie/store-emojis.ts     # 新規
│   │   │   │   ├── xissmie/store-avatar-decorations.ts # 新規
│   │   │   │   ├── xissmie/purchased-emojis.ts # 新規
│   │   │   │   ├── xissmie/purchased-avatar-decorations.ts # 新規
│   │   │   │   ├── i/update.ts                 # ストア絵文字チェック追加
│   │   │   │   └── flash/create.ts, update.ts  # ストア絵文字チェック追加
│   │   │   └── web/
│   │   │       ├── ClientServerService.ts      # /login-with-token, ストアリダイレクト
│   │   │       └── views/
│   │   │           ├── base.pug                # xfolio_api_host メタタグ
│   │   │           ├── base-embed.pug          # 同上
│   │   │           ├── note.pug                # AP alternate 条件付き
│   │   │           └── user.pug                # AP alternate 条件付き
│   │   └── queue/
│   │       └── processors/
│   │           └── XissmieSyncStoreContentsProcessorService.ts  # 新規
│   ├── assets/robots.txt                       # AI クローラーブロック
│   └── migration/                              # xissmie 用マイグレーション多数
├── frontend/
│   ├── src/
│   │   ├── timelines.ts                        # GTL 除外
│   │   ├── navbar.ts                           # xfolio, xfolioSupport メニュー + lookup/antennas/tools 削除
│   │   ├── xissmie.ts                          # 購入誘導ヘルパー
│   │   ├── store.ts                            # 購入キャッシュ、メニュー既定
│   │   ├── components/
│   │   │   ├── MkXfolioSigninDialog.vue        # Xfolio ログインダイアログ
│   │   │   ├── MkXfolioSignin.vue              # ログインラッパー
│   │   │   ├── MkXfolioSignin.input.vue        # ログイン入力 UI
│   │   │   ├── MkVisitorDashboard.vue          # 統計・チャート・他サーバー削除
│   │   │   ├── MkForgotPassword.vue            # パスワード案内
│   │   │   ├── MkSignupDialog.rules.vue        # 登録案内
│   │   │   ├── MkCustomEmoji.vue               # 購入メニュー追加
│   │   │   ├── MkEmojiPicker.vue               # 購入キャッシュ連携
│   │   │   ├── MkWidgets.vue                   # 連合ウィジェット非表示
│   │   │   ├── MkUserSelectDialog.vue          # ローカル強制
│   │   │   ├── MkInstanceStats.vue             # 連合統計条件付き
│   │   │   ├── MkAvatar.vue                    # 猫耳レイヤー無効化
│   │   │   └── MkAd.vue                        # 広告いいねボタン非表示
│   │   ├── pages/
│   │   │   ├── login-with-token.vue            # トークンログインページ
│   │   │   ├── emojis.emoji.vue                # 購入動線
│   │   │   ├── about.vue                       # 連合・チャートタブ削除
│   │   │   ├── about.overview.vue              # 統計・Well-known 削除
│   │   │   ├── user/home.vue                   # 凍結・サイレンス警告非表示
│   │   │   ├── explore.users.vue               # 連合タブ非表示
│   │   │   ├── search.note.vue                 # 連合スコープ非表示
│   │   │   ├── search.user.vue                 # origin 固定
│   │   │   └── settings/
│   │   │       ├── index.vue                   # ドライブ設定は再表示、引っ越し設定は削除
│   │   │       ├── security.vue                # パスワード変更・トークン再生成削除
│   │   │       ├── other.vue                   # 引っ越し・注目ノート・エラー報告非表示
│   │   │       ├── avatar-decoration.vue       # ストア購入フロー
│   │   │       ├── preferences.vue             # ティッカー非表示
│   │   │       ├── mute-block.vue              # インスタンスミュート非表示
│   │   │       ├── statusbar.statusbar.vue     # Federation 非表示
│   │   │       └── privacy.vue                 # 確認ダイアログ省略
│   │   ├── ui/_common_/
│   │   │   ├── common.vue                      # ストリーム切断インジケーター非表示
│   │   │   └── common.ts                       # ツールメニュー・お問い合わせ削除
│   │   ├── utility/
│   │   │   ├── search-emoji.ts                 # 購入済み優先検索
│   │   │   ├── please-login.ts                 # リモートオプション非表示
│   │   │   └── lookup.ts                       # 連合不許可メッセージ
│   │   └── widgets/index.ts                    # federationWidgets + serverMetric 等削除
│   └── ...
├── frontend-embed/
│   └── src/pages/
│       ├── note.vue                            # リモートノート拒否
│       └── user-timeline.vue                   # リモートユーザー拒否
├── frontend-shared/
│   └── js/config.ts                            # xfolioApiHost, xfolioUrlOrigin
├── misskey-js/
│   └── src/autogen/                            # xissmie API の型定義（自動生成）
└── sw/
    └── src/sw.ts                               # Xissmie ブランド文言
```
