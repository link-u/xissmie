/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { test, expect } from './fixtures.js';
import {
	ADMIN_SETUP_PASSWORD, XFOLIO_ORIGIN,
	api, locateMkInput, openPasswordSignin, openSigninChooser, registerUser, resetState, signIn, visitHome, waitApiResponse,
} from './utils.js';
import type { RegisteredUser } from './utils.js';

test.describe('サーバー初期設定', () => {
	test.beforeEach(async () => {
		await resetState();
	});

	test('初期設定ウィザードで管理者を作成し、サーバー名を設定できる', async ({ page }) => {
		await visitHome(page);

		await locateMkInput(page, 'admin-initial-password').fill(ADMIN_SETUP_PASSWORD);
		await locateMkInput(page, 'admin-username').fill('admin');
		await locateMkInput(page, 'admin-password').fill('admin1234');

		const signupResponse = waitApiResponse(page, '/api/admin/accounts/create');
		await page.getByTestId('admin-ok').click();
		await signupResponse;

		await page.getByTestId('next').click();
		await locateMkInput(page, 'server-setup-server-name').fill('Xissmie');
		const updateMetaResponse = waitApiResponse(page, '/api/admin/update-meta');
		await page.getByTestId('server-setup-wizard-apply').click();
		await updateMetaResponse;
	});
});

test.describe('訪問者', () => {
	test.beforeEach(async () => {
		await resetState();
		await registerUser('admin', 'pass', true);
	});

	test('トップページに登録・ログインボタンがある', async ({ page }) => {
		await visitHome(page);
		await expect(page.getByTestId('signup')).toBeVisible();
		await expect(page.getByTestId('signin')).toBeVisible();
	});

	test('新規登録は Misskey の登録フォームではなく、Xfolio での登録案内になる', async ({ page }) => {
		await visitHome(page);
		await page.getByTestId('signup').click();

		const registerOnXfolio = page.getByTestId('xissmie-signup-with-xfolio');
		await expect(registerOnXfolio).toBeVisible();
		await expect(registerOnXfolio).toHaveAttribute('href', `${XFOLIO_ORIGIN}/mypage/xissmie_setting`);

		// 本家のサーバールール同意・登録フォームは出ない
		await expect(page.getByTestId('signup-rules-continue')).toHaveCount(0);
		await expect(page.getByTestId('signup-username')).toHaveCount(0);

		// ボタンを押すと Xfolio に遷移する
		await registerOnXfolio.click();
		await page.waitForURL(`${XFOLIO_ORIGIN}/mypage/xissmie_setting`);
	});

	test('ログインは Xfolio でのログインと ID/PASS でのログインを選ぶダイアログになる', async ({ page }) => {
		await openSigninChooser(page);

		await expect(page.getByTestId('xissmie-signin-with-xfolio')).toHaveAttribute('href', `${XFOLIO_ORIGIN}/mypage/xissmie_setting?from_xissmie=yes`);
		await expect(page.getByTestId('xissmie-signin-find-credentials')).toHaveAttribute('href', `${XFOLIO_ORIGIN}/mypage/xissmie_setting`);
		await expect(page.getByTestId('xissmie-signin-with-password')).toBeVisible();

		// いきなり本家のユーザー名入力にはならない
		await expect(page.getByTestId('signin-page-input')).toHaveCount(0);
	});

	test('「クロスフォリオでログインする」で Xfolio に遷移する', async ({ page }) => {
		await openSigninChooser(page);
		await page.getByTestId('xissmie-signin-with-xfolio').click();
		await page.waitForURL(`${XFOLIO_ORIGIN}/mypage/xissmie_setting?from_xissmie=yes`);
	});
});

test.describe('ID/PASS でのログイン', () => {
	let admin: RegisteredUser;
	let alice: RegisteredUser;

	test.beforeEach(async () => {
		await resetState();
		admin = await registerUser('admin', 'pass', true);
		alice = await registerUser('alice', 'alice1234');
	});

	test('パスキーでのログインボタンは出ない', async ({ page }) => {
		await openPasswordSignin(page);
		await expect(locateMkInput(page, 'signin-username')).toBeVisible();
		await expect(page.getByText('Sign in with Passkey')).toHaveCount(0);
	});

	test('ログインできる', async ({ page }) => {
		await signIn(page, 'alice', 'alice1234');
		// 表示に時間がかかるのでデフォルト秒数だとタイムアウトする
		await page.getByTestId('user-setup-continue').waitFor({ state: 'visible', timeout: 30_000 });
	});

	test('凍結されたアカウントはログインできない', async ({ page }) => {
		await api('admin/suspend-user', { i: admin.token, userId: alice.id });

		await openPasswordSignin(page);
		await locateMkInput(page, 'signin-username').fill('alice');
		await page.keyboard.press('Enter');

		await page.getByText('This account has been suspended due to').waitFor({ timeout: 10_000 });
	});
});
