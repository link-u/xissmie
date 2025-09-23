/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { UserOwnedAvatarDecorationsRepository, UserOwnedEmojisRepository } from '@/models/_.js';
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
}
