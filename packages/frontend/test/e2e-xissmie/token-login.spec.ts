/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { test, expect } from './fixtures.js';
import { BASE_URL, api, getLoginToken, registerUser, resetState, submitXfolioLoginForm } from './utils.js';
import type { RegisteredUser } from './utils.js';

// Xfolio のマイページから Xissmie にワンタイムトークンでログインする流れ
test.describe('Xfolio からのログイン (POST /login-with-token)', () => {
	let admin: RegisteredUser;
	let alice: RegisteredUser;

	test.beforeEach(async () => {
		await resetState();
		admin = await registerUser('admin', 'pass', true);
		alice = await registerUser('alice', 'alice1234');
	});

	test('トークンでログインし、タイムラインに遷移する', async ({ page }) => {
		const token = await getLoginToken(admin, alice.id);

		await submitXfolioLoginForm(page, token);
		await page.waitForURL(`${BASE_URL}/timeline`, { timeout: 30_000 });

		// alice としてログインしている
		await expect(page.getByTestId('open-post-form')).toBeVisible({ timeout: 30_000 });
		const account = await page.evaluate(() => JSON.parse(window.localStorage.getItem('account') ?? 'null'));
		expect(account?.id).toBe(alice.id);
	});

	test('使用済みのトークンではログインできない', async ({ page }) => {
		const token = await getLoginToken(admin, alice.id);
		// 先に一度使っておく(トークンはワンタイムで、使うと差し替わる)
		await api('login-with-token', { token });

		await submitXfolioLoginForm(page, token);
		await expect(page.getByText('ログイン用トークンが無効です。再度ログインしてください。')).toBeVisible({ timeout: 30_000 });
		expect(await page.evaluate(() => window.localStorage.getItem('account'))).toBeNull();
	});

	test('トークンがなければログインできない', async ({ page }) => {
		await submitXfolioLoginForm(page);
		await expect(page.getByText('ログイン情報が不正です')).toBeVisible({ timeout: 30_000 });
		expect(await page.evaluate(() => window.localStorage.getItem('account'))).toBeNull();
	});
});
