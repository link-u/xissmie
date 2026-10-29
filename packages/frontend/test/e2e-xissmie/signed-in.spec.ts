/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { test, expect } from './fixtures.js';
import {
	BASE_URL, XFOLIO_ORIGIN,
	api, closeUserSetupDialog, locateMkInput, locateMkTextarea, postNote, registerUser, resetState, signIn,
} from './utils.js';
import type { RegisteredUser } from './utils.js';

// ナビゲーションバーを文字付きで表示させる(幅 1279px 以下だとアイコンのみになる)
test.use({ viewport: { width: 1400, height: 900 } });

test.describe('ログイン直後', () => {
	test.beforeEach(async ({ page }) => {
		await resetState();
		await registerUser('admin', 'pass', true);
		await registerUser('alice', 'alice1234');
		await signIn(page, 'alice', 'alice1234');
	});

	test('アカウントの初期設定ウィザードを最後まで進められる', async ({ page }) => {
		// 表示に時間がかかるのでデフォルト秒数だとタイムアウトする
		await page.getByTestId('user-setup-continue').click({ timeout: 30_000 });

		await locateMkInput(page, 'user-setup-user-name').fill('ありす');
		await locateMkTextarea(page, 'user-setup-user-description').fill('ほげ');
		await page.getByTestId('user-setup-continue').click();

		// プライバシー設定
		await page.getByTestId('user-setup-continue').click();

		// フォロー設定
		await page.getByTestId('user-setup-continue').click();

		// プッシュ通知設定
		await page.getByTestId('user-setup-continue').click();

		// 完了
		await page.getByTestId('user-setup-continue').click();
	});
});

test.describe('初期設定後', () => {
	let admin: RegisteredUser;

	test.beforeEach(async ({ page }) => {
		await resetState();
		admin = await registerUser('admin', 'pass', true);
		await registerUser('alice', 'alice1234');
		await signIn(page, 'alice', 'alice1234');
		await closeUserSetupDialog(page);
	});

	test.describe('基本機能', () => {
		test('ノートを投稿できる', async ({ page }) => {
			await postNote(page, 'Hello, Xissmie!');
		});

		test('ホットキー N で投稿フォームを開閉できる', async ({ page }) => {
			await page.getByTestId('open-post-form').waitFor({ state: 'visible' });
			await page.keyboard.press('KeyN');
			await page.getByTestId('post-form-text').waitFor({ state: 'visible' });
			await page.keyboard.press('Escape');
			await page.getByTestId('post-form-text').waitFor({ state: 'hidden' });
		});

		test('/redirect-test からユーザーページにリダイレクトされる', async ({ page }) => {
			await page.goto(`${BASE_URL}/redirect-test`);
			await page.waitForURL('**/@alice');
		});
	});

	test.describe('連合オフ', () => {
		test('タイムラインにグローバルタイムラインのタブがない', async ({ page }) => {
			// ローカルタイムラインのタブはある
			await expect(page.locator('.ti-planet').first()).toBeVisible();
			// グローバルタイムライン(ti-whirl)のタブはない
			await expect(page.locator('.ti-whirl')).toHaveCount(0);
		});

		test('投稿フォームに「連合なし」(ロケット)の切り替えがない', async ({ page }) => {
			await page.getByTestId('open-post-form').click();
			await page.getByTestId('post-form-text').waitFor({ state: 'visible' });
			await expect(page.getByTestId('post-form-submit')).toBeVisible();
			await expect(page.locator('.ti-rocket, .ti-rocket-off')).toHaveCount(0);
		});
	});

	test.describe('ナビゲーションバー', () => {
		// NOTE: ボタンのアクセシブルネームの先頭にはアイコンフォントの文字が入るので、末尾一致で探す
		test('「クロスフォリオ」で Xfolio を新しいタブで開く', async ({ page, context }) => {
			const [xfolio] = await Promise.all([
				context.waitForEvent('page'),
				page.getByRole('button', { name: /クロスフォリオ$/ }).click(),
			]);
			await xfolio.waitForURL(`${XFOLIO_ORIGIN}/`);
		});

		test('「Xissmieを支援する」で Xfolio のファンコミュニティを新しいタブで開く', async ({ page, context }) => {
			const [xfolio] = await Promise.all([
				context.waitForEvent('page'),
				page.getByRole('button', { name: /Xissmieを支援する$/ }).click(),
			]);
			await xfolio.waitForURL(`${XFOLIO_ORIGIN}/portfolio/xissmie/fan_community`);
		});

		test('「もっと！」に Xissmie で削除したメニュー(アンテナ・照会・ツール)がない', async ({ page }) => {
			await page.getByRole('button', { name: /More!$/ }).click();
			// 削除していないメニューは出ている(画面外に隠れている同名の要素は除く)
			await expect(page.getByText('Lists', { exact: true }).filter({ visible: true })).toBeVisible();

			for (const removed of ['Antennas', 'Lookup', 'Tools']) {
				await expect(page.getByText(removed, { exact: true }).filter({ visible: true })).toHaveCount(0);
			}
		});
	});

	test.describe('設定', () => {
		test('「メール」の項目と、メールアドレス未設定の警告がない', async ({ page }) => {
			// 本家ではメール配信が有効でメールアドレスが未設定だと、設定のトップに警告が出る
			await api('admin/update-meta', { i: admin.token, enableEmail: true });

			await page.goto(`${BASE_URL}/settings`);
			await expect(page.locator('a[href="/settings/notifications"]')).toBeVisible();

			await expect(page.locator('a[href="/settings/email"]')).toHaveCount(0);
			await expect(page.getByText('Email address not set.')).toHaveCount(0);
		});

		test('セキュリティに「パスワード変更」「ログイントークン再生成」がない', async ({ page }) => {
			await page.goto(`${BASE_URL}/settings/security`);
			await expect(page.getByText('Login history').first()).toBeVisible();

			await expect(page.getByText('Change password')).toHaveCount(0);
			await expect(page.getByText('Regenerate login token')).toHaveCount(0);
		});

		test('その他に「アカウントの引っ越し」がない', async ({ page }) => {
			await page.goto(`${BASE_URL}/settings/other`);
			await expect(page.getByText('Close account').first()).toBeVisible();

			await expect(page.getByText('Account Migration')).toHaveCount(0);
		});
	});
});
