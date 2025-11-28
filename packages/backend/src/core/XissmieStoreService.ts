/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { MiUser, UserOwnedAvatarDecorationsRepository, UserOwnedEmojisRepository, EmojisRepository, AvatarDecorationsRepository } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { CacheService } from '@/core/CacheService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import type { Config } from '@/config.js';
import { DriveService } from '@/core/DriveService.js';

@Injectable()
export class XissmieStoreService {
	constructor(
		@Inject(DI.userOwnedAvatarDecorationsRepository)
		private userOwnedAvatarDecorationsRepository: UserOwnedAvatarDecorationsRepository,

		@Inject(DI.userOwnedEmojisRepository)
		private userOwnedEmojisRepository: UserOwnedEmojisRepository,

		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		@Inject(DI.avatarDecorationsRepository)
		private avatarDecorationsRepository: AvatarDecorationsRepository,

		@Inject(DI.config)
		private config: Config,

		private idService: IdService,
		private cacheService: CacheService,
		private httpRequestService: HttpRequestService,
		private driveService: DriveService,
	) {
	}

	@bindThis
	public async fetchStoreDecorations(): Promise<void> {
		const params = new URLSearchParams({
			token: this.config.xfolioApiToken,
		});

		const res = await this.httpRequestService.send(`https://${this.config.xfolioApiHost}/api/v1/xissmie/decorations_list`, {
			method: 'POST',
			body: params.toString(),
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const data = await res.json() as {
			id: string;
			name: string;
			imageUrl: string;
			authorId: string;
			authorName: string;
			productId: string;
			updatedAt: number;
			// 検索用キーワード（配列）
			keywords?: string[];
		}[];

		//const data = [{
		//	id: 'da',
		//	name: 'おうかん',
		//	imageUrl: 'https://files-p1.a9z.dev/p1/ac48c0e4-5f1c-401f-8437-69e68a27c1d0.png',
		//	authorId: 'aa',
		//	authorName: 'syuilo',
		//	updatedAt: 0,
		//}, {
		//	id: 'db',
		//	name: 'はーと',
		//	imageUrl: 'https://files-p1.a9z.dev/p1/3ea6bbe8-5feb-4a8a-82fd-6771fe298414.png',
		//	authorId: 'aa',
		//	authorName: 'syuilo',
		//	updatedAt: 0,
		//}];

		// 既存データの更新日時を取得して無駄な再保存を回避
		const existing = await this.avatarDecorationsRepository.findBy({ id: In(data.map(d => d.id)) });
		const existingMap = new Map(existing.map(e => [e.id, e]));

		const rows = [] as {
			id: string;
			name: string;
			description: string;
			url: string;
			updatedAt: Date;
			isInStore: boolean;
			storeProductId: string | null;
			storeAuthorId: string;
			storeAuthorName: string;
		}[];

		for (const x of data) {
			const incomingUpdatedAt = new Date(x.updatedAt);
			const ex = existingMap.get(x.id);
			let stableUrl: string | null = ex?.url ?? null;

			if (!(ex && ex.updatedAt && ex.updatedAt >= incomingUpdatedAt && ex.url)) {
				// 画像をDriveに取り込み（オブジェクトストレージ設定ならそちら、無ければ内部保存）
				const file = await this.driveService.uploadFromUrl({
					url: x.imageUrl,
					user: null,
					isLink: false,
					comment: `decoration:${x.id}`,
				});
				stableUrl = file.webpublicUrl ?? file.url;
			}

			rows.push({
				id: x.id,
				name: `${x.name}_d_${x.authorId}`,
				description: '',
				url: stableUrl ?? x.imageUrl,
				updatedAt: incomingUpdatedAt,
				isInStore: true,
				storeProductId: x.productId ?? null,
				storeAuthorId: x.authorId,
				storeAuthorName: x.authorName,
			});
		}

		await this.avatarDecorationsRepository.upsert(rows, ['id']);
	}

	@bindThis
	public async fetchStoreEmojis(): Promise<void> {
		const params = new URLSearchParams({
			token: this.config.xfolioApiToken,
		});

		const res = await this.httpRequestService.send(`https://${this.config.xfolioApiHost}/api/v1/xissmie/emojis_list`, {
			method: 'POST',
			body: params.toString(),
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const data = await res.json() as {
			id: string;
			name: string;
			imageUrl: string;
			authorId: string;
			authorName: string;
			productId: string;
			updatedAt: number;
			keywords?: string[];
		}[];

		//const data = [{
		//	id: 'ea',
		//	name: 'test',
		//	imageUrl: 'https://files-p1.a9z.dev/p1/webpublic-ec47e3e2-b77b-4e0b-92bb-028d4cd991aa.png',
		//	authorId: 'aa',
		//	authorName: 'syuilo',
		//	updatedAt: 0,
		//}, {
		//	id: 'eb',
		//	name: 'test2',
		//	imageUrl: 'https://files-p1.a9z.dev/p1/a6afb8c7-5db0-47fe-ae33-5e5efe7fa1f6.png',
		//	authorId: 'aa',
		//	authorName: 'syuilo',
		//	updatedAt: 0,
		//}];

		// 既存データの更新日時を取得して無駄な再保存を回避
		const existing = await this.emojisRepository.findBy({ id: In(data.map(d => d.id)) });
		const existingMap = new Map(existing.map(e => [e.id, e]));

		const rows = [] as {
			id: string;
			name: string;
			originalUrl: string;
			publicUrl: string;
			updatedAt: Date;
			category: string | null;
			license: string | null;
			localOnly: boolean;
			isSensitive: boolean;
			isInStore: boolean;
			storeProductId: string | null;
			storeAuthorId: string;
			storeAuthorName: string;
			aliases?: string[];
		}[];

		for (const x of data) {
			const incomingUpdatedAt = new Date(x.updatedAt);
			const ex = existingMap.get(x.id);
			let publicUrl: string | null = ex?.publicUrl ?? '';

			if (!(ex && ex.updatedAt && ex.updatedAt >= incomingUpdatedAt && ex.publicUrl)) {
				const file = await this.driveService.uploadFromUrl({
					url: x.imageUrl,
					user: null,
					isLink: false,
					comment: `emoji:${x.id}`,
				});
				publicUrl = file.webpublicUrl ?? file.url;
			}

			// 検索用キーワード（配列）をエイリアスとして取り込む
			const keywordsInput: string[] = Array.isArray(x.keywords) ? x.keywords : [];
			const keywords = keywordsInput.map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
			const aliasSet = new Set<string>((ex?.aliases ?? []).map(a => a.toLowerCase()));
			// 元名も検索できるように追加（サフィックスなしで検索可能に）
			aliasSet.add(x.name.toLowerCase());
			for (const k of keywords) aliasSet.add(k);
			const aliases = Array.from(aliasSet);

			rows.push({
				id: x.id,
				name: `${x.name}_e_${x.authorId}`,
				originalUrl: x.imageUrl,
				publicUrl: publicUrl || x.imageUrl,
				updatedAt: incomingUpdatedAt,
				category: '★creator★',
				license: x.authorName,
				localOnly: true,
				isSensitive: false,
				isInStore: true,
				storeProductId: x.productId ?? null,
				storeAuthorId: x.authorId,
				storeAuthorName: x.authorName,
				aliases,
			});
		}

		await this.emojisRepository.upsert(rows, ['id']);
	}

	/* unused
	@bindThis
	public async avatarDecorationPurchased(userId: MiUser['id'], avatarDecorationIds: string[], purchasedAt: Date | null = null): Promise<void> {
		await this.userOwnedAvatarDecorationsRepository.insert(avatarDecorationIds.map((avatarDecorationId) => ({
			id: this.idService.gen(),
			userId,
			avatarDecorationId,
			purchasedAt: purchasedAt ?? new Date(),
		})));
	}

	@bindThis
	public async emojiPurchased(userId: MiUser['id'], emojiIds: string[], purchasedAt: Date | null = null): Promise<void> {
		await this.userOwnedEmojisRepository.insert(emojiIds.map((emojiId) => ({
			id: this.idService.gen(),
			userId,
			emojiId,
			purchasedAt: purchasedAt ?? new Date(),
		})));
	}
	*/

	@bindThis
	public async fetchPurchasedAvatarDecorationsFromStore(userId: MiUser['id']) {
		const currentlyOwned = await this.userOwnedAvatarDecorationsRepository.find({
			where: {
				userId,
			},
		});
		const currentlyOwnedDecorationIds = new Set(currentlyOwned.map(x => x.avatarDecorationId));

		const params = new URLSearchParams({
			userId,
			token: this.config.xfolioApiToken,
		});

		const res = await this.httpRequestService.send(`https://${this.config.xfolioApiHost}/api/v1/xissmie/users_purchased_decorations`, {
			method: 'POST',
			body: params.toString(),
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const data = await res.json() as { avatarDecorations: { id: string; purchasedAt: number; }[] };

		//const data = { avatarDecorations: [{ id: 'da', purchasedAt: 0 }] };

		const newDecorations = data.avatarDecorations.filter(x => !currentlyOwnedDecorationIds.has(x.id));

		if (newDecorations.length > 0) {
			// TODO: 当該コンテンツがまだfetchされていなかった場合のケア
			await this.userOwnedAvatarDecorationsRepository.insert(newDecorations.map((x) => ({
				id: this.idService.gen(x.purchasedAt),
				userId,
				avatarDecorationId: x.id,
				purchasedAt: new Date(x.purchasedAt),
			})));
		}
	}

	@bindThis
	public async fetchPurchasedEmojisFromStore(userId: MiUser['id']) {
		const currentlyOwned = await this.userOwnedEmojisRepository.find({
			where: {
				userId,
			},
		});
		const currentlyOwnedEmojiIds = new Set(currentlyOwned.map(x => x.emojiId));

		const params = new URLSearchParams({
			userId,
			token: this.config.xfolioApiToken,
		});

		const res = await this.httpRequestService.send(`https://${this.config.xfolioApiHost}/api/v1/xissmie/users_purchased_emojis`, {
			method: 'POST',
			body: params.toString(),
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const data = await res.json() as { emojis: { id: string; purchasedAt: number; }[] };

		//const data = { emojis: [{ id: 'ea', purchasedAt: 0 }] };

		const newEmojis = data.emojis.filter(x => !currentlyOwnedEmojiIds.has(x.id));

		if (newEmojis.length > 0) {
			const foundEmojis = await this.emojisRepository.findBy({
				id: In(newEmojis.map(x => x.id)),
			});

			await this.userOwnedEmojisRepository.insert(foundEmojis.map((x) => ({
				id: this.idService.gen(newEmojis.find(e => e.id === x.id)!.purchasedAt),
				userId,
				emojiId: x.id,
				emojiName: x.name,
				purchasedAt: new Date(newEmojis.find(e => e.id === x.id)!.purchasedAt),
			})));
		}
	}

	@bindThis
	public async getPurchasedDecorations(userId: MiUser['id']) {
		const ownedDecorations = await this.userOwnedAvatarDecorationsRepository.find({
			where: {
				userId,
			},
			relations: ['avatarDecoration'],
		});

		return ownedDecorations.map(x => x.avatarDecoration).filter((x): x is NonNullable<typeof x> => x != null);
	}
}
