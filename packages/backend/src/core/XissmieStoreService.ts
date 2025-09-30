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

@Injectable()
export class XissmieStoreService {
	constructor(
		@Inject(DI.userOwnedAvatarDecorationsRepository)
		private userOwnedAvatarDecorationsRepository: UserOwnedAvatarDecorationsRepository,

		@Inject(DI.userOwnedEmojisRepository)
		private userOwnedEmojisRepository: UserOwnedEmojisRepository,

		private idService: IdService,
		private cacheService: CacheService,
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
}
