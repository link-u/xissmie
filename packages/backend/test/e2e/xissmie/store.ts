/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

process.env.NODE_ENV = 'test';

import * as assert from 'node:assert';
import { describe, beforeAll, afterAll, test } from 'vitest';
import { MiAvatarDecoration } from '@/models/AvatarDecoration.js';
import { MiEmoji } from '@/models/Emoji.js';
import { MiNote } from '@/models/Note.js';
import { MiUserOwnedEmoji } from '@/models/UserOwnedEmoji.js';
import { genAidx } from '@/misc/id/aidx.js';
import { api, failedApiCall, initTestDb, origin, post, signup, simpleGet } from '../../utils.js';
import type { DataSource, Repository } from 'typeorm';
import type * as misskey from 'misskey-js';

/*
 * Xissmie 独自のストア(Xfolio で販売している絵文字・アバターデコレーション)仕様のテスト。
 * Xfolio API には繋がない(テスト環境では到達できない)ので、ストア絵文字は DB に直接用意する。
 *
 * - 未購入のストア絵文字はノート・リアクション・プロフィール・Play で使えない
 * - 購入済みなら使える
 * - xissmie/store-emojis でストア絵文字だけを一覧でき、購入済みを除外できる
 * - /xissmie/store/... から Xfolio の商品ページへリダイレクトする
 */
describe('[Xissmie] ストア', () => {
	const STORE_EMOJI = 'xissmie_e_storetest';
	const NORMAL_EMOJI = 'xissmie_normal';

	let db: DataSource;
	let Notes: Repository<MiNote>;

	let root: misskey.entities.SignupResponse;
	let alice: misskey.entities.SignupResponse; // 未購入
	let bob: misskey.entities.SignupResponse; // 購入済み

	let storeEmoji: MiEmoji;
	let storeDecoration: MiAvatarDecoration;

	function createEmoji(name: string, store: Partial<MiEmoji> = {}): MiEmoji {
		return {
			id: genAidx(Date.now()),
			updatedAt: new Date(),
			name,
			host: null,
			category: null,
			originalUrl: `${origin}/files/${name}`,
			publicUrl: `${origin}/files/${name}`,
			uri: null,
			type: 'image/png',
			aliases: [],
			license: null,
			localOnly: false,
			isSensitive: false,
			isInStore: false,
			isPublic: true,
			storeProductId: null,
			storeAuthorId: null,
			storeAuthorName: null,
			roleIdsThatCanBeUsedThisEmojiAsReaction: [],
			...store,
		};
	}

	beforeAll(async () => {
		// 前のテストファイルが Redis に残したカスタム絵文字キャッシュの影響を受けないよう、DB と Redis をリセットする
		await api('reset-db', {});

		db = await initTestDb(true);
		Notes = db.getRepository(MiNote);

		root = await signup({ username: 'root' });
		alice = await signup({ username: 'alice' });
		bob = await signup({ username: 'bob' });

		// API(admin/emoji/add)経由だと isInStore を立てる前の状態がキャッシュされるため、DB に直接作る
		storeEmoji = createEmoji(STORE_EMOJI, {
			isInStore: true,
			storeProductId: 'product-1',
			storeAuthorId: 'author-1',
			storeAuthorName: 'Author',
		});
		await db.getRepository(MiEmoji).insert(storeEmoji);
		await db.getRepository(MiEmoji).insert(createEmoji(NORMAL_EMOJI));

		await db.getRepository(MiUserOwnedEmoji).insert({
			id: genAidx(Date.now()),
			purchasedAt: new Date(),
			userId: bob.id,
			emojiId: storeEmoji.id,
			emojiName: storeEmoji.name,
		});

		storeDecoration = {
			id: genAidx(Date.now()),
			updatedAt: new Date(),
			url: `${origin}/files/decoration`,
			name: 'store decoration',
			description: '',
			isInStore: true,
			isPublic: true,
			storeProductId: 'deco-product-1',
			storeAuthorId: 'author-1',
			storeAuthorName: 'Author',
			roleIdsThatCanBeUsedThisDecoration: [],
			category: null,
		};
		await db.getRepository(MiAvatarDecoration).insert(storeDecoration);
	}, 1000 * 60 * 2);

	afterAll(async () => {
		await db.destroy();
	});

	const EMOJI_NOT_OWNED = {
		status: 403,
		code: 'EMOJI_NOT_OWNED',
		id: '0fcbe7ef-8d42-41b2-8204-aafd9f16293d',
	};

	describe('ノート', () => {
		test('未購入のストア絵文字を含むノートは投稿できない', async () => {
			const text = `未購入 :${STORE_EMOJI}:`;
			const res = await api('notes/create', { text }, alice);

			// NOTE: 現状は NoteCreateService の IdentifiableError がエンドポイントで ApiError に変換されず 500 になる。
			//       将来 4xx の ApiError に直しても通るよう、ステータスは「成功しないこと」だけを見る。
			assert.ok(res.status >= 400, `status=${res.status}`);
			assert.strictEqual(await Notes.countBy({ userId: alice.id, text }), 0);
		});

		test('購入済みのストア絵文字を含むノートは投稿できる', async () => {
			const res = await api('notes/create', { text: `購入済み :${STORE_EMOJI}:` }, bob);
			assert.strictEqual(res.status, 200);
		});

		test('通常のカスタム絵文字は誰でも使える', async () => {
			const res = await api('notes/create', { text: `通常 :${NORMAL_EMOJI}:` }, alice);
			assert.strictEqual(res.status, 200);
		});
	});

	describe('リアクション', () => {
		let note: misskey.entities.Note;

		beforeAll(async () => {
			note = await post(root, { text: 'react to me' });
		});

		test('未購入のストア絵文字ではリアクションできない (PURCHASE_REQUIRED)', async () => {
			await failedApiCall({
				endpoint: 'notes/reactions/create',
				parameters: { noteId: note.id, reaction: `:${STORE_EMOJI}:` },
				user: alice,
			}, {
				status: 400,
				code: 'PURCHASE_REQUIRED',
				id: '95fa25e5-2259-4e45-8e8f-25f7479169b0',
			});
		});

		test('購入済みのストア絵文字ならリアクションできる', async () => {
			const res = await api('notes/reactions/create', { noteId: note.id, reaction: `:${STORE_EMOJI}:` }, bob);
			assert.strictEqual(res.status, 204);

			const shown = await api('notes/show', { noteId: note.id }, bob);
			assert.strictEqual(shown.body.reactions[`:${STORE_EMOJI}@.:`], 1);
		});

		test('通常のカスタム絵文字は誰でもリアクションできる', async () => {
			const res = await api('notes/reactions/create', { noteId: note.id, reaction: `:${NORMAL_EMOJI}:` }, alice);
			assert.strictEqual(res.status, 204);
		});
	});

	describe('プロフィール (i/update)', () => {
		test('未購入のストア絵文字は名前に使えない (EMOJI_NOT_OWNED)', async () => {
			await failedApiCall({
				endpoint: 'i/update',
				parameters: { name: `alice :${STORE_EMOJI}:` },
				user: alice,
			}, EMOJI_NOT_OWNED);
		});

		test('未購入のストア絵文字は自己紹介に使えない (EMOJI_NOT_OWNED)', async () => {
			await failedApiCall({
				endpoint: 'i/update',
				parameters: { description: `よろしく :${STORE_EMOJI}:` },
				user: alice,
			}, EMOJI_NOT_OWNED);
		});

		test('購入済みなら使える', async () => {
			const res = await api('i/update', { name: `bob :${STORE_EMOJI}:` }, bob);
			assert.strictEqual(res.status, 200);
			assert.strictEqual(res.body.name, `bob :${STORE_EMOJI}:`);
		});
	});

	describe('Play (flash/create)', () => {
		const flash = {
			title: 'test',
			script: '/// @ 0.19.0\n',
			permissions: [],
		};

		test('未購入のストア絵文字は概要に使えない (EMOJI_NOT_OWNED)', async () => {
			await failedApiCall({
				endpoint: 'flash/create',
				parameters: { ...flash, summary: `:${STORE_EMOJI}:` },
				user: alice,
			}, EMOJI_NOT_OWNED);
		});

		test('購入済みなら使える', async () => {
			const res = await api('flash/create', { ...flash, summary: `:${STORE_EMOJI}:` }, bob);
			assert.strictEqual(res.status, 200);
		});
	});

	describe('xissmie/store-emojis', () => {
		test('ストア絵文字だけが返る', async () => {
			const res = await api('xissmie/store-emojis', {});
			assert.strictEqual(res.status, 200);
			const names = res.body.map(e => e.name);
			assert.deepStrictEqual(names, [STORE_EMOJI]);
		});

		test('excludePurchased で購入済みを除外できる', async () => {
			const forAlice = await api('xissmie/store-emojis', { excludePurchased: true }, alice);
			assert.deepStrictEqual(forAlice.body.map(e => e.name), [STORE_EMOJI]);

			const forBob = await api('xissmie/store-emojis', { excludePurchased: true }, bob);
			assert.deepStrictEqual(forBob.body.map(e => e.name), []);
		});
	});

	describe('Xfolio の商品ページへのリダイレクト', () => {
		test('/xissmie/store/emojis/:name', async () => {
			const res = await simpleGet(`/xissmie/store/emojis/${STORE_EMOJI}`);
			assert.strictEqual(res.status, 302);
			assert.ok(res.location);
			assert.strictEqual(new URL(res.location).pathname, '/portfolio/author-1/shop/product-1');
		});

		test('/xissmie/store/emojis/:name (存在しない絵文字は 404)', async () => {
			const res = await simpleGet('/xissmie/store/emojis/does_not_exist');
			assert.strictEqual(res.status, 404);
		});

		test('/xissmie/store/avatar-decorations/:id', async () => {
			const res = await simpleGet(`/xissmie/store/avatar-decorations/${storeDecoration.id}`);
			assert.strictEqual(res.status, 302);
			assert.ok(res.location);
			assert.strictEqual(new URL(res.location).pathname, '/portfolio/author-1/shop/deco-product-1');
		});

		test('/xissmie/store/avatar-decorations/:id (存在しないデコは 404)', async () => {
			const res = await simpleGet('/xissmie/store/avatar-decorations/doesnotexist');
			assert.strictEqual(res.status, 404);
		});
	});
});
