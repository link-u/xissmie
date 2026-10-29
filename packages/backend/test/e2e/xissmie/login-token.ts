/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'node:assert';
import { describe, beforeAll, test } from 'vitest';
import { api, failedApiCall, relativeFetch, signup } from '../../utils.js';
import type * as misskey from 'misskey-js';

/*
 * Xissmie 独自のログイン仕様のテスト。
 * - サインアップで発行されるユーザートークンは "Xissme" プレフィックス付き
 * - Xfolio → Xissmie のワンタイムログイン (admin/accounts/get-login-token, login-with-token, POST /login-with-token)
 * - パスワード変更は無効化されている (Xfolio 側で管理するため)
 *
 * 本家 Misskey の取り込みでこれらが消えたり壊れたりしたら、ここが落ちる。
 */
describe('[Xissmie] ログイン', () => {
	let root: misskey.entities.SignupResponse;
	let alice: misskey.entities.SignupResponse;
	let bob: misskey.entities.SignupResponse;

	beforeAll(async () => {
		// 最初に作成したユーザーが管理者(root)になる
		root = await signup({ username: 'root' });
		alice = await signup({ username: 'alice', password: 'alice1234' });
		bob = await signup({ username: 'bob' });
	}, 1000 * 60 * 2);

	async function getLoginToken(userId: string): Promise<string> {
		const res = await api('admin/accounts/get-login-token', { userId }, root);
		assert.strictEqual(res.status, 200);
		assert.strictEqual(typeof res.body.loginToken, 'string');
		return res.body.loginToken;
	}

	describe('ユーザートークン', () => {
		test('サインアップで発行されるトークンは "Xissme" + 32文字', () => {
			assert.ok(alice.token.startsWith('Xissme'), alice.token);
			assert.strictEqual(alice.token.length, 'Xissme'.length + 32);
		});

		test('"Xissme" トークンで API を利用できる', async () => {
			const res = await api('i', {}, alice);
			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body.id, alice.id);
		});
	});

	describe('Xissmie 独自エンドポイントが登録されている', () => {
		test.each([
			'login-with-token',
			'admin/accounts/get-login-token',
			'xissmie/store-emojis',
			'xissmie/store-avatar-decorations',
			'xissmie/purchased-emojis',
			'xissmie/purchased-avatar-decorations',
		])('%s', async (endpoint) => {
			const res = await api('endpoint', { endpoint });
			assert.strictEqual(res.status, 200);
			assert.notStrictEqual(res.body, null, `${endpoint} が見つからない`);
		});
	});

	describe('admin/accounts/get-login-token', () => {
		test('管理者はユーザーのログイン用トークンを取得できる', async () => {
			const loginToken = await getLoginToken(alice.id);
			assert.ok(loginToken.length > 0);
		});

		test('一般ユーザーは取得できない', async () => {
			const res = await api('admin/accounts/get-login-token', { userId: alice.id }, bob);
			assert.strictEqual(res.status, 403);
		});

		test('未ログインでは取得できない', async () => {
			const res = await api('admin/accounts/get-login-token', { userId: alice.id });
			assert.strictEqual(res.status, 401);
		});
	});

	describe('login-with-token', () => {
		test('ログイン用トークンで本人としてログインでき、API トークンが返る', async () => {
			const loginToken = await getLoginToken(alice.id);

			const res = await api('login-with-token', { token: loginToken });
			assert.strictEqual(res.status, 200);
			const me = res.body as unknown as misskey.entities.MeDetailed & { token: string };
			assert.strictEqual(me.id, alice.id);
			assert.strictEqual(me.username, 'alice');
			assert.strictEqual(me.token, alice.token);
		});

		test('ログイン用トークンはワンタイムで、使用後は新しいトークンに差し替わる', async () => {
			const before = await getLoginToken(alice.id);
			assert.strictEqual((await api('login-with-token', { token: before })).status, 200);

			const after = await getLoginToken(alice.id);
			assert.notStrictEqual(after, before);

			// 使用済みトークンは再利用できない
			await failedApiCall({
				endpoint: 'login-with-token',
				parameters: { token: before },
				user: undefined,
			}, {
				status: 400,
				code: 'INVALID_LOGIN_TOKEN',
				id: 'b0a7f5f8-dc2f-4171-b91f-de88ad238e14',
			});

			// 差し替え後のトークンは使える
			assert.strictEqual((await api('login-with-token', { token: after })).status, 200);
		});

		test('存在しないトークンは INVALID_LOGIN_TOKEN になる', async () => {
			await failedApiCall({
				endpoint: 'login-with-token',
				parameters: { token: 'this-token-does-not-exist' },
				user: undefined,
			}, {
				status: 400,
				code: 'INVALID_LOGIN_TOKEN',
				id: 'b0a7f5f8-dc2f-4171-b91f-de88ad238e14',
			});
		});

		test('他人のトークンでは他人としてログインしない', async () => {
			const bobLoginToken = await getLoginToken(bob.id);
			const res = await api('login-with-token', { token: bobLoginToken });
			assert.strictEqual(res.status, 200);
			const me = res.body as unknown as misskey.entities.MeDetailed & { token: string };
			assert.strictEqual(me.id, bob.id);
			assert.notStrictEqual(me.token, alice.token);
		});
	});

	describe('POST /login-with-token (Xfolio からのフォーム送信)', () => {
		test('フォームで受け取ったトークンを clientCtx に載せた SPA を返す', async () => {
			const res = await relativeFetch('login-with-token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({ token: 'token-from-xfolio' }).toString(),
				redirect: 'manual',
			});

			assert.strictEqual(res.status, 200);
			assert.match(res.headers.get('content-type') ?? '', /^text\/html/);
			// トークンを含むページはキャッシュさせない
			assert.strictEqual(res.headers.get('cache-control'), 'no-store');

			const html = await res.text();
			const clientCtx = html.match(/<script type="application\/json" id="misskey_clientCtx"[^>]*>(.*?)<\/script>/s);
			assert.ok(clientCtx, 'misskey_clientCtx が出力されていない');
			assert.deepStrictEqual(JSON.parse(clientCtx[1]), { token: 'token-from-xfolio' });
			// 検索エンジンにインデックスさせない
			assert.match(html, /<meta name="robots" content="noindex"/);
		});

		test('トークンなしでも 200 を返し、clientCtx の token は null', async () => {
			const res = await relativeFetch('login-with-token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: '',
				redirect: 'manual',
			});

			assert.strictEqual(res.status, 200);
			const html = await res.text();
			const clientCtx = html.match(/<script type="application\/json" id="misskey_clientCtx"[^>]*>(.*?)<\/script>/s);
			assert.ok(clientCtx, 'misskey_clientCtx が出力されていない');
			assert.deepStrictEqual(JSON.parse(clientCtx[1]), { token: null });
		});
	});

	describe('i/change-password', () => {
		test('パスワードは変更されない (Xfolio 側で管理するため無効化)', async () => {
			const res = await api('i/change-password', {
				currentPassword: 'alice1234',
				newPassword: 'changed1234',
			}, alice);
			assert.strictEqual(res.status, 204);

			const signinWithOldPassword = await api('signin-flow', { username: 'alice', password: 'alice1234' });
			assert.strictEqual(signinWithOldPassword.status, 200);
			assert.strictEqual(signinWithOldPassword.body.finished, true);

			const signinWithNewPassword = await api('signin-flow', { username: 'alice', password: 'changed1234' });
			assert.notStrictEqual(signinWithNewPassword.status, 200);
		});
	});
});
