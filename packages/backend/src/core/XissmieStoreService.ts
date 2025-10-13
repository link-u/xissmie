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
	) {
	}

	@bindThis
	public async fetchStoreDecorations(): Promise<void> {
		const params = new URLSearchParams({
			token: this.config.xfolioApiToken,
		});

		//const res = await this.httpRequestService.send('???/api/v1/xissmie/decorations_list', {
		//	method: 'POST',
		//	body: params.toString(),
		//	headers: {
		//		'Content-Type': 'application/x-www-form-urlencoded',
		//	},
		//});

		//const data = await res.json() as {
		//	id: string;
		//	name: string;
		//	imageUrl: string;
		//	authorId: string;
		//	authorName: string;
		//	updatedAt: number;
		//}[];

		const data = [{
			id: 'da',
			name: 'test',
			imageUrl: 'https://files-p1.a9z.dev/p1/ac48c0e4-5f1c-401f-8437-69e68a27c1d0.png',
			authorId: 'aa',
			authorName: 'syuilo',
			updatedAt: 0,
		}];

		await this.avatarDecorationsRepository.upsert(data.map((x) => ({
			id: x.id,
			name: `${x.name}-store-${x.id}`,
			description: '',
			url: x.imageUrl,
			updatedAt: new Date(x.updatedAt),
			isInStore: true,
		})), ['id']);
	}

	@bindThis
	public async fetchStoreEmojis(): Promise<void> {
		const params = new URLSearchParams({
			token: this.config.xfolioApiToken,
		});

		const res = await this.httpRequestService.send('???/api/v1/xissmie/emojis_list', {
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
			updatedAt: number;
		}[];

		//const data = [{
		//	id: 'ea',
		//	name: 'test',
		//	imageUrl: 'https://files-p1.a9z.dev/p1/webpublic-ec47e3e2-b77b-4e0b-92bb-028d4cd991aa.png',
		//	authorId: 'aa',
		//	authorName: 'syuilo',
		//	updatedAt: 0,
		//}];

		await this.emojisRepository.upsert(data.map((x) => ({
			id: x.id,
			name: `${x.name}-store-${x.id}`,
			originalUrl: x.imageUrl,
			publicUrl: x.imageUrl,
			updatedAt: new Date(x.updatedAt),
			isInStore: true,
		})), ['id']);
	}

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

		const res = await this.httpRequestService.send('???', {
			method: 'POST',
			body: params.toString(),
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const data = await res.json() as { avatarDecorations: { id: string; purchasedAt: number; }[] };

		const newDecorations = data.avatarDecorations.filter(x => !currentlyOwnedDecorationIds.has(x.id));

		if (newDecorations.length > 0) {
			// TODO: 当該コンテンツがまだfetchされていなかった場合のケア
			await this.userOwnedAvatarDecorationsRepository.insert(newDecorations.map((x) => ({
				id: this.idService.gen(),
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

		const res = await this.httpRequestService.send('???', {
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
			// TODO: 当該コンテンツがまだfetchされていなかった場合のケア
			await this.userOwnedEmojisRepository.insert(newEmojis.map((x) => ({
				id: this.idService.gen(),
				userId,
				emojiId: x.id,
				purchasedAt: new Date(x.purchasedAt),
			})));
		}
	}
}
