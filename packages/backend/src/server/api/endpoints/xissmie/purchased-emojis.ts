/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { IsNull } from 'typeorm';
import { Inject, Injectable } from '@nestjs/common';
import type { UserOwnedEmojisRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { DI } from '@/di-symbols.js';
import { XissmieStoreService } from '@/core/XissmieStoreService.js';

export const meta = {
	tags: ['meta'],

	requireCredential: true,

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			ref: 'EmojiSimple',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userOwnedEmojisRepository)
		private userOwnedEmojisRepository: UserOwnedEmojisRepository,

		private emojiEntityService: EmojiEntityService,
		private xissmieStoreService: XissmieStoreService,
	) {
		super(meta, paramDef, async (ps, me) => {
			//await this.xissmieStoreService.fetchPurchasedEmojisFromStore(me.id);

			const ownedEmojis = await this.userOwnedEmojisRepository.find({
				where: {
					userId: me.id,
				},
				relations: ['emoji'],
			});

			return this.emojiEntityService.packSimpleMany(ownedEmojis.map(e => e.emoji));
		});
	}
}
