/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { MiUser, UserOwnedAvatarDecorationsRepository, UserOwnedEmojisRepository } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import { DI } from '@/di-symbols.js';
import { bindThis } from '@/decorators.js';
import { CacheService } from '@/core/CacheService.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';

@Injectable()
export class XissmieStoreService {
	constructor(
		@Inject(DI.userOwnedAvatarDecorationsRepository)
		private userOwnedAvatarDecorationsRepository: UserOwnedAvatarDecorationsRepository,

		@Inject(DI.userOwnedEmojisRepository)
		private userOwnedEmojisRepository: UserOwnedEmojisRepository,

		private idService: IdService,
		private cacheService: CacheService,
		private httpRequestService: HttpRequestService,
	) {
	}

	@bindThis
	public async fetchStoreDecorations(): Promise<void> {
		// TODO: make http request to xfolio
	}

	@bindThis
	public async fetchStoreEmojis(): Promise<void> {
		// TODO: make http request to xfolio
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
			token: process.env.XFOLIO_API_TOKEN,
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
			token: process.env.XFOLIO_API_TOKEN,
		});

		const res = await this.httpRequestService.send('???', {
			method: 'POST',
			body: params.toString(),
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		});

		const data = await res.json() as { emojis: { id: string; purchasedAt: number; }[] };

		const newEmojis = data.emojis.filter(x => !currentlyOwnedEmojiIds.has(x.id));

		if (newEmojis.length > 0) {
			await this.userOwnedEmojisRepository.insert(newEmojis.map((x) => ({
				id: this.idService.gen(),
				userId,
				emojiId: x.id,
				purchasedAt: new Date(x.purchasedAt),
			})));
		}
	}
}
