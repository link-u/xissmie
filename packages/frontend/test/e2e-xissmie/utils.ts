/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import type { BrowserContext, Locator, Page } from '@playwright/test';

/*
 * Xissmie 用 E2E テストのヘルパー。
 * 本家の test/e2e/shared.ts をベースにしているが、本家の変更に引きずられないよう、ここだけで完結させている。
 */

export const BASE_URL = 'http://localhost:61812';
export const ADMIN_SETUP_PASSWORD = 'example_password_please_change_this_or_you_will_get_hacked';

/** テスト環境では xfolioApiHost を設定していないため、フロントエンドは既定値の xfolio.jp を使う */
export const XFOLIO_ORIGIN = 'https://xfolio.jp';

export interface RegisteredUser {
	id: string;
	token: string;
}

//#region API
export async function api<T = unknown>(endpoint: string, body: Record<string, unknown> = {}): Promise<T> {
	const response = await fetch(`${BASE_URL}/api/${endpoint}`, {
		method: 'POST',
		body: JSON.stringify(body),
		headers: {
			'Content-Type': 'application/json',
		},
	});
	if (response.status < 200 || response.status >= 300) {
		throw new Error(`/api/${endpoint} failed: status=${response.status} body=${await response.text()}`);
	}
	if (response.status === 204) return null as T;
	return await response.json() as T;
}

export async function resetState(): Promise<void> {
	await api('reset-db');
}

export async function registerUser(username: string, password: string, isAdmin = false): Promise<RegisteredUser> {
	return await api<RegisteredUser>(isAdmin ? 'admin/accounts/create' : 'signup', {
		username,
		password,
		...(isAdmin ? { setupPassword: ADMIN_SETUP_PASSWORD } : {}),
	});
}

/** Xfolio から Xissmie にログインするときに使うワンタイムトークンを取得する */
export async function getLoginToken(admin: RegisteredUser, userId: string): Promise<string> {
	const res = await api<{ loginToken: string }>('admin/accounts/get-login-token', {
		i: admin.token,
		userId,
	});
	return res.loginToken;
}
//#endregion

//#region Locators
export function locateMkInput(page: Page, testId: string): Locator {
	return page.locator(`[data-testid="${testId}"] input`);
}

export function locateMkTextarea(page: Page, testId: string): Locator {
	return page.locator(`[data-testid="${testId}"] textarea`);
}
//#endregion

//#region Page helpers
export async function visitHome(page: Page): Promise<void> {
	await page.goto(`${BASE_URL}/`);
	await page.locator('button').first().waitFor({ state: 'visible', timeout: 30_000 });
}

export async function waitApiResponse(page: Page, path: string, timeout = 30_000): Promise<void> {
	await page.waitForResponse((response) => {
		return response.url().endsWith(path) && response.request().method() === 'POST';
	}, { timeout });
}

/** 訪問者向けトップの「ログイン」から、Xissmie のログイン方法選択ダイアログを開く */
export async function openSigninChooser(page: Page): Promise<void> {
	await visitHome(page);
	await page.getByTestId('signin').click();
	await page.getByTestId('xissmie-signin-page').waitFor({ state: 'visible', timeout: 10_000 });
}

/** ログイン方法選択ダイアログから「ID/PASSでログインする」を選び、ユーザー名入力まで進める */
export async function openPasswordSignin(page: Page): Promise<void> {
	await openSigninChooser(page);
	await page.getByTestId('xissmie-signin-with-password').click();
	await page.getByTestId('signin-page-input').waitFor({ state: 'visible', timeout: 10_000 });
}

/** ID/PASS でログインする(本家の signIn に相当) */
export async function signIn(page: Page, username: string, password: string): Promise<void> {
	await openPasswordSignin(page);
	await locateMkInput(page, 'signin-username').fill(username);
	await page.keyboard.press('Enter');
	await page.getByTestId('signin-page-password').waitFor({ state: 'visible', timeout: 10_000 });
	await locateMkInput(page, 'signin-password').fill(password);
	const signinResponse = waitApiResponse(page, '/api/signin-flow');
	await page.keyboard.press('Enter');
	await signinResponse;
}

/**
 * Xfolio がやっているのと同じように、ワンタイムトークンを form POST で /login-with-token に送る。
 * token を省略するとトークンなしで送る。
 */
export async function submitXfolioLoginForm(page: Page, token?: string): Promise<void> {
	const input = token == null ? '' : `<input type="hidden" name="token" value="${token}">`;
	await page.setContent(`<form id="xfolio" method="POST" action="${BASE_URL}/login-with-token">${input}</form>`);
	await Promise.all([
		page.waitForURL(`${BASE_URL}/login-with-token`, { waitUntil: 'commit' }),
		page.locator('#xfolio').evaluate((form: HTMLFormElement) => form.submit()),
	]);
}

// 表示に時間がかかるのでPlaywrightのデフォルトのタイムアウトだと間に合わない
export async function closeUserSetupDialog(page: Page, timeout = 30_000): Promise<void> {
	await page.locator('[data-testid="user-setup-dialog"] [data-testid="modal-window-close"]').click({ timeout });
	await page.getByTestId('modal-dialog-ok').click();
}

export async function postNote(page: Page, noteText: string, timeout = 15_000): Promise<void> {
	await page.getByTestId('open-post-form').waitFor({ state: 'visible' });
	await page.getByTestId('open-post-form').click();
	await page.getByTestId('post-form-text').fill(noteText);
	await page.getByTestId('post-form-submit').click();
	await page.getByText(noteText).waitFor({ timeout });
}
//#endregion

//#region Xfolio
/**
 * Xfolio(外部サイト)への遷移をスタブする。
 * CI からは Xfolio に到達できない/すべきでないので、遷移先 URL の確認だけができるようにする。
 */
export async function stubXfolio(context: BrowserContext): Promise<void> {
	await context.route(`${XFOLIO_ORIGIN}/**`, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'text/html; charset=utf-8',
			body: '<!doctype html><title>Xfolio (stub)</title><p>Xfolio (stub)</p>',
		});
	});
}
//#endregion
